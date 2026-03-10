import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DiscussionOrchestrator } from '@/lib/orchestrator/orchestrator';
import { DiscussionPhase } from '@/lib/orchestrator/types';
import type { SessionAgent } from '@/lib/agents/types';
import { getAgentDefinition } from '@/lib/agents/registry';
import {
  FakeProvider,
  cleanupTestDatabaseFile,
  installFakeProviders,
  resetTestEnvironment,
  streamText,
} from './test-helpers.ts';

const claude = getRequiredAgent('claude');
const gpt = getRequiredAgent('gpt');

beforeEach(() => {
  resetTestEnvironment();
});

after(() => {
  cleanupTestDatabaseFile();
});

test('orchestrator completes the main phases and persists summary hooks', async () => {
  installFakeProviders(
    new FakeProvider({
      streamChat: async function* (params) {
        if (params.messages[0]?.content.includes('会议纪要')) {
          yield* streamText('# 圆桌讨论纪要');
          return;
        }

        if (params.messages[0]?.content.includes('请就以下议题发表你的观点')) {
          yield* streamText('参与者观点输出');
          return;
        }

        yield* streamText('主持人开场');
      },
      chat: async () => ({
        content: JSON.stringify({
          agreements: [{ point: '一致同意先验证', supporters: ['gpt'] }],
          disagreements: [],
          shouldConverge: true,
          moderatorNarrative: '分歧已经足够小，可以直接总结。',
        }),
        usage: { inputTokens: 12, outputTokens: 24 },
      }),
    })
  );

  const persistedMessages: Array<{ role: string; phase: string; content: string }> = [];
  const usageDeltas: Array<{ inputTokens?: number; outputTokens?: number }> = [];
  const summaries: string[] = [];

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-main-flow',
    topic: '如何完善多智能体讨论应用',
    agents: buildAgents(),
    moderatorAgentId: 'claude',
    maxDebateRounds: 1,
    shouldStop: () => false,
    onMessagePersist: async (message) => {
      persistedMessages.push(message);
    },
    onSummaryPersist: async (summary) => {
      summaries.push(summary);
    },
    onUsagePersist: async (usage) => {
      usageDeltas.push(usage);
    },
  });

  const events = [];
  for await (const event of orchestrator.run()) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.type === 'phase_change').map((event) => event.phase),
    [
      DiscussionPhase.OPENING,
      DiscussionPhase.INITIAL_RESPONSES,
      DiscussionPhase.ANALYSIS,
      DiscussionPhase.SUMMARY,
      DiscussionPhase.COMPLETED,
    ]
  );
  assert.equal(events.at(-1)?.type, 'discussion_complete');
  assert.ok(
    persistedMessages.some(
      (message) =>
        message.role === 'moderator' && message.phase === DiscussionPhase.SUMMARY
    )
  );
  assert.equal(summaries.length, 1);
  assert.ok(usageDeltas.length >= 3);
});

test('orchestrator exits early when stop is requested before opening', async () => {
  installFakeProviders(new FakeProvider());

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-stop',
    topic: 'stop test',
    agents: buildAgents(),
    moderatorAgentId: 'claude',
    maxDebateRounds: 1,
    shouldStop: () => true,
  });

  const events = [];
  for await (const event of orchestrator.run()) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ['phase_change', 'discussion_complete']
  );
  assert.equal(events[0]?.phase, DiscussionPhase.COMPLETED);
});

test('orchestrator skips research cleanly when Tavily is not configured', async () => {
  installFakeProviders(new FakeProvider());

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-research-skip',
    topic: 'research skip',
    agents: buildAgents(),
    moderatorAgentId: 'claude',
    maxDebateRounds: 1,
    shouldStop: () => true,
  });

  const events = [];
  for await (const event of orchestrator.run()) {
    events.push(event);
  }

  assert.equal(events[0]?.type, 'phase_change');
  assert.equal(events[0]?.phase, DiscussionPhase.COMPLETED);
});

function buildAgents(): SessionAgent[] {
  return [{ definition: claude }, { definition: gpt }];
}

function getRequiredAgent(agentId: string) {
  const agent = getAgentDefinition(agentId);
  assert.ok(agent, `missing agent ${agentId}`);
  return agent;
}
