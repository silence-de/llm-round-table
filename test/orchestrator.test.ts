import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DiscussionOrchestrator } from '@/lib/orchestrator/orchestrator';
import { DiscussionPhase } from '@/lib/orchestrator/types';
import type { SessionAgent } from '@/lib/agents/types';
import {
  DEFAULT_DECISION_BRIEF,
  DEFAULT_DISCUSSION_AGENDA,
} from '@/lib/decision/utils';
import { DEFAULT_RESEARCH_CONFIG } from '@/lib/search/utils';
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
const originalFetch = globalThis.fetch;

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
  const decisionSummaries: string[] = [];

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-main-flow',
    topic: '如何完善多智能体讨论应用',
    brief: {
      ...DEFAULT_DECISION_BRIEF,
      topic: '如何完善多智能体讨论应用',
      goal: '形成下一阶段产品路线',
    },
    agenda: DEFAULT_DISCUSSION_AGENDA,
    researchConfig: DEFAULT_RESEARCH_CONFIG,
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
    onDecisionSummaryPersist: async (summary) => {
      decisionSummaries.push(summary.recommendedOption);
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
  assert.equal(decisionSummaries.length, 1);
  assert.ok(usageDeltas.length >= 3);
});

test('orchestrator executes all configured analysis rounds before summary', async () => {
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
        yield* streamText('主持人输出');
      },
      chat: async () => ({
        content: JSON.stringify({
          agreements: [],
          disagreements: [],
          shouldConverge: true,
          moderatorNarrative: '当前观点已经较为收敛。',
        }),
        usage: { inputTokens: 8, outputTokens: 16 },
      }),
    })
  );

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-full-rounds',
    topic: '验证固定轮次',
    brief: {
      ...DEFAULT_DECISION_BRIEF,
      topic: '验证固定轮次',
    },
    agenda: DEFAULT_DISCUSSION_AGENDA,
    researchConfig: DEFAULT_RESEARCH_CONFIG,
    agents: buildAgents(),
    moderatorAgentId: 'claude',
    maxDebateRounds: 3,
    shouldStop: () => false,
  });

  const events = [];
  for await (const event of orchestrator.run()) {
    events.push(event);
  }

  const analysisRounds = events
    .filter((event) => event.type === 'phase_change' && event.phase === DiscussionPhase.ANALYSIS)
    .map((event) => event.round);
  assert.deepEqual(analysisRounds, [0, 1, 2]);
  const summaryIndex = events.findIndex(
    (event) => event.type === 'phase_change' && event.phase === DiscussionPhase.SUMMARY
  );
  const lastAnalysisIndex = events
    .map((event, index) =>
      event.type === 'phase_change' && event.phase === DiscussionPhase.ANALYSIS
        ? index
        : -1
    )
    .filter((index) => index >= 0)
    .at(-1);
  assert.ok(summaryIndex > (lastAnalysisIndex ?? -1));
});

test('orchestrator exits early when stop is requested before opening', async () => {
  installFakeProviders(new FakeProvider());

  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-stop',
    topic: 'stop test',
    brief: {
      ...DEFAULT_DECISION_BRIEF,
      topic: 'stop test',
    },
    agenda: DEFAULT_DISCUSSION_AGENDA,
    researchConfig: DEFAULT_RESEARCH_CONFIG,
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
    brief: {
      ...DEFAULT_DECISION_BRIEF,
      topic: 'research skip',
    },
    agenda: DEFAULT_DISCUSSION_AGENDA,
    researchConfig: DEFAULT_RESEARCH_CONFIG,
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

test('orchestrator persists guided research run and uses stable source ids', async () => {
  process.env.TAVILY_API_KEY = 'test-tavily';

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
      chat: async (params) => {
        if (params.messages[0]?.content.includes('"recommendedOption"')) {
          return {
            content: JSON.stringify({
              summary: '继续推进。',
              recommendedOption: '先验证外部风险。',
              why: ['有来源支撑'],
              risks: ['域名集中'],
              openQuestions: [],
              nextActions: ['继续补 research'],
              alternativesRejected: ['暂不直接落地'],
              redLines: ['若证据失效则暂停'],
              revisitTriggers: ['补充更多反例来源后重评'],
              confidence: 72,
              evidence: [{ claim: '风险判断有证据', sourceIds: ['R1'] }],
            }),
            usage: { inputTokens: 6, outputTokens: 10 },
          };
        }

        return {
          content: JSON.stringify({
            agreements: [],
            disagreements: [],
            shouldConverge: true,
            moderatorNarrative: '可以总结。',
          }),
          usage: { inputTokens: 12, outputTokens: 20 },
        };
      },
    })
  );

  globalThis.fetch = async (input, init) => {
    if (
      typeof input === 'string' &&
      input.includes('https://api.tavily.com/search')
    ) {
      return new Response(
        JSON.stringify({
          query: 'mock',
          results: [
            {
              title: 'Risk note',
              url: 'https://example.com/risk',
              content: 'Risk and verification context for the topic.',
              score: 0.92,
              published_date: '2026-03-05',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return originalFetch(input, init);
  };

  const researchRuns: Array<{ status: string; queryPlan: string[] }> = [];
  const researchSourceBatches: string[][] = [];
  const decisionSummaries: string[][] = [];

  try {
    const orchestrator = new DiscussionOrchestrator({
      sessionId: 'orchestrator-research-guided',
      topic: 'research guided',
      brief: {
        ...DEFAULT_DECISION_BRIEF,
        topic: 'research guided',
        constraints: '需要最新来源',
      },
      agenda: DEFAULT_DISCUSSION_AGENDA,
      researchConfig: {
        ...DEFAULT_RESEARCH_CONFIG,
        mode: 'guided',
        userQueries: ['research guided 反例 风险'],
      },
      agents: buildAgents(),
      moderatorAgentId: 'claude',
      maxDebateRounds: 1,
      shouldStop: () => false,
      onResearchRunPersist: async (run) => {
        researchRuns.push({ status: run.status, queryPlan: run.queryPlan });
      },
      onResearchSourcesPersist: async (_id, sources) => {
        researchSourceBatches.push(
          sources.map((source) => source.citationLabel ?? source.id)
        );
      },
      onDecisionSummaryPersist: async (summary) => {
        decisionSummaries.push(summary.evidence.map((item) => item.sourceIds[0]));
      },
    });

    const events = [];
    for await (const event of orchestrator.run()) {
      events.push(event);
    }

    assert.equal(events.some((event) => event.type === 'research_result'), true);
    assert.equal(researchRuns.at(-1)?.status, 'completed');
    assert.equal(researchRuns.at(-1)?.queryPlan.length >= 3, true);
    assert.deepEqual(researchSourceBatches.at(-1), ['R1']);
    assert.deepEqual(decisionSummaries.at(-1), ['R1']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('orchestrator marks agent as degraded after timeout-like errors', async () => {
  process.env.ROUND_TABLE_AGENT_DEGRADE_TIMEOUT_THRESHOLD = '1';
  installFakeProviders(
    new FakeProvider({
      streamChat: async function* (params) {
        if (params.messages[0]?.content.includes('请就以下议题发表你的观点')) {
          yield {
            type: 'error',
            content: 'Agent timed out',
            errorCode: 'startup_timeout',
            timeoutType: 'startup',
          };
          return;
        }

        if (params.messages[0]?.content.includes('会议纪要')) {
          yield* streamText('# 圆桌讨论纪要');
          return;
        }

        yield* streamText('主持人继续');
      },
      chat: async () => ({
        content: JSON.stringify({
          agreements: [],
          disagreements: [],
          shouldConverge: true,
          moderatorNarrative: '进入总结。',
        }),
        usage: { inputTokens: 10, outputTokens: 14 },
      }),
    })
  );

  const sessionEvents: Array<{ type: string; timeoutType?: string; agentId?: string }> =
    [];
  const events = [];
  const orchestrator = new DiscussionOrchestrator({
    sessionId: 'orchestrator-degrade',
    topic: 'degrade test',
    brief: {
      ...DEFAULT_DECISION_BRIEF,
      topic: 'degrade test',
    },
    agenda: DEFAULT_DISCUSSION_AGENDA,
    researchConfig: DEFAULT_RESEARCH_CONFIG,
    agents: buildAgents(),
    moderatorAgentId: 'claude',
    maxDebateRounds: 1,
    shouldStop: () => false,
    onSessionEventPersist: async (event) => {
      sessionEvents.push({
        type: event.type,
        timeoutType: event.timeoutType,
        agentId: event.agentId,
      });
    },
  });

  for await (const event of orchestrator.run()) {
    events.push(event);
  }

  assert.equal(events.some((event) => event.type === 'agent_degraded'), true);
  assert.equal(
    sessionEvents.some((event) => event.type === 'timeout' && event.timeoutType === 'startup'),
    true
  );
  assert.equal(
    sessionEvents.some((event) => event.type === 'agent_degraded' && event.agentId === 'gpt'),
    true
  );
});

function buildAgents(): SessionAgent[] {
  return [{ definition: claude }, { definition: gpt }];
}

function getRequiredAgent(agentId: string) {
  const agent = getAgentDefinition(agentId);
  assert.ok(agent, `missing agent ${agentId}`);
  return agent;
}
