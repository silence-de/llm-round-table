import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getAgents } from '@/app/api/agents/route';
import { GET as listSessionsRoute } from '@/app/api/sessions/route';
import {
  GET as getSessionRoute,
  DELETE as deleteSessionRoute,
  PATCH as patchSessionRoute,
} from '@/app/api/sessions/[id]/route';
import { POST as startSessionRoute } from '@/app/api/sessions/[id]/start/route';
import { POST as stopSessionRoute } from '@/app/api/sessions/[id]/stop/route';
import { POST as interjectionRoute } from '@/app/api/sessions/[id]/interjections/route';
import { createSession, getSessionStatus } from '@/lib/db/repository';
import {
  FakeProvider,
  cleanupTestDatabaseFile,
  installFakeProviders,
  readSSEEvents,
  resetTestEnvironment,
  streamText,
} from './test-helpers.ts';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetTestEnvironment();
});

after(() => {
  cleanupTestDatabaseFile();
});

function withMockedTavilyResults(
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }>,
  fn: () => Promise<unknown>
) {
  globalThis.fetch = async (input, init) => {
    if (
      typeof input === 'string' &&
      input.includes('https://api.tavily.com/search')
    ) {
      return new Response(
        JSON.stringify({
          query: 'mock',
          results,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return originalFetch(input, init);
  };

  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

test('agents route exposes availability and persona presets', async () => {
  process.env.OPENAI_API_KEY = 'test-openai';

  const response = await getAgents();
  const payload = await response.json();

  assert.ok(Array.isArray(payload.agents));
  assert.ok(Array.isArray(payload.personaPresets));
  assert.equal(
    payload.agents.find((agent: { id: string }) => agent.id === 'gpt')?.available,
    true
  );
});

test('start route rejects missing topic and missing runnable moderator', async () => {
  const missingTopicResponse = await startSessionRoute(
    new Request('http://localhost/api/sessions/test/start', {
      method: 'POST',
      body: JSON.stringify({ topic: ' ', agentIds: [] }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'missing-topic' }) }
  );
  assert.equal(missingTopicResponse.status, 400);

  process.env.OPENAI_API_KEY = 'test-openai';

  const missingModeratorResponse = await startSessionRoute(
    new Request('http://localhost/api/sessions/test/start', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'moderator key missing',
        agentIds: ['gpt'],
        moderatorAgentId: 'claude',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'missing-moderator' }) }
  );

  assert.equal(missingModeratorResponse.status, 400);
  assert.match(await missingModeratorResponse.text(), /No runnable agent set/);
});

test('start route streams a completed discussion and persists history', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.OPENAI_API_KEY = 'test-openai';
  installFakeProviders(
    new FakeProvider({
      streamChat: async function* (params) {
        if (params.messages[0]?.content.includes('会议纪要')) {
          yield* streamText('# 圆桌讨论纪要');
          return;
        }

        if (params.messages[0]?.content.includes('请就以下议题发表你的观点')) {
          yield* streamText('参与者回答');
          return;
        }

        yield* streamText('主持人回答');
      },
      chat: async (params) => {
        if (params.messages[0]?.content.includes('"recommendedOption"')) {
          return {
            content: JSON.stringify({
              summary: '建议先补产品工作流。',
              recommendedOption: '先完成 brief 和 decision card。',
              why: ['便于复用'],
              risks: ['页面更复杂'],
              openQuestions: ['后续协作如何做'],
              nextActions: ['扩 schema', '补 UI'],
              confidence: 78,
              evidence: [],
            }),
            usage: { inputTokens: 6, outputTokens: 12 },
          };
        }

        return {
          content: JSON.stringify({
            agreements: [],
            disagreements: [],
            shouldConverge: true,
            moderatorNarrative: '直接进入总结。',
          }),
          usage: { inputTokens: 8, outputTokens: 16 },
        };
      },
    })
  );

  const response = await startSessionRoute(
    new Request('http://localhost/api/sessions/test/start', {
      method: 'POST',
      body: JSON.stringify({
        topic: '功能补完测试',
        brief: {
          topic: '功能补完测试',
          goal: '形成产品化路线',
          background: '已有基础圆桌能力',
          constraints: '先做单人工作流',
          decisionType: 'product',
          desiredOutput: 'recommendation',
          templateId: 'product-direction',
        },
        agenda: {
          focalQuestions: '优先补什么',
          requiredDimensions: '复用、结果沉淀',
          requireResearch: false,
          requestRecommendation: true,
        },
        agentIds: ['claude', 'gpt'],
        moderatorAgentId: 'claude',
        maxDebateRounds: 3.8,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'route-start-success' }) }
  );

  assert.equal(response.status, 200);
  const events = await readSSEEvents(response);
  assert.equal(events.at(-1)?.type, 'discussion_complete');

  const listResponse = await listSessionsRoute();
  const sessions = await listResponse.json();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].maxDebateRounds, 3);
  assert.equal(sessions[0].templateId, 'product-direction');
  assert.equal(sessions[0].goal, '形成产品化路线');

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/route-start-success'),
    { params: Promise.resolve({ id: 'route-start-success' }) }
  );
  const detail = await detailResponse.json();

  assert.equal(detail.session.status, 'completed');
  assert.equal(detail.session.decisionType, 'product');
  assert.ok(detail.messages.length >= 3);
  assert.match(detail.minutes.content, /圆桌讨论纪要/);
  assert.equal(detail.decisionSummary.recommendedOption, '先完成 brief 和 decision card。');
  assert.equal(detail.researchRun.status, 'skipped');
});

test('start route persists research run, sources, and source-backed evidence', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.TAVILY_API_KEY = 'test-tavily';

  installFakeProviders(
    new FakeProvider({
      streamChat: async function* (params) {
        if (params.messages[0]?.content.includes('会议纪要')) {
          yield* streamText('# 圆桌讨论纪要');
          return;
        }

        if (params.messages[0]?.content.includes('请就以下议题发表你的观点')) {
          yield* streamText('参与者回答');
          return;
        }

        yield* streamText('主持人回答');
      },
      chat: async (params) => {
        if (params.messages[0]?.content.includes('"recommendedOption"')) {
          return {
            content: JSON.stringify({
              summary: '建议继续推进。',
              recommendedOption: '优先验证最关键的外部风险。',
              why: ['已有研究来源支持'],
              risks: ['证据仍偏少'],
              openQuestions: ['域名是否足够多样'],
              nextActions: ['继续补充反例研究'],
              confidence: 74,
              evidence: [
                {
                  claim: '关键外部风险已有来源支撑',
                  sourceIds: ['R1'],
                },
              ],
            }),
            usage: { inputTokens: 8, outputTokens: 14 },
          };
        }

        return {
          content: JSON.stringify({
            agreements: [],
            disagreements: [],
            shouldConverge: true,
            moderatorNarrative: '直接进入总结。',
          }),
          usage: { inputTokens: 6, outputTokens: 12 },
        };
      },
    })
  );

  await withMockedTavilyResults(
    [
      {
        title: 'Market update',
        url: 'https://example.com/a',
        content: 'Latest developments and external risks for this market.',
        score: 0.91,
        published_date: '2026-03-01',
      },
      {
        title: 'Counterpoint analysis',
        url: 'https://news.example.org/b',
        content: 'A counterpoint discussing downside scenarios and validation.',
        score: 0.82,
        published_date: '2026-02-26',
      },
    ],
    async () => {
      const response = await startSessionRoute(
        new Request('http://localhost/api/sessions/test/start', {
          method: 'POST',
          body: JSON.stringify({
            brief: {
              topic: 'Research intelligence test',
              goal: '验证研究资产持久化',
              constraints: '需要高时效来源',
            },
            agenda: {
              focalQuestions: '哪些风险最值得追踪',
              requiredDimensions: '风险、验证、反例',
              requireResearch: true,
              requestRecommendation: true,
            },
            researchConfig: {
              enabled: true,
              mode: 'guided',
              userQueries: ['Research intelligence test 反例 风险'],
              preferredDomains: ['example.com', 'example.org'],
              maxSources: 4,
            },
            agentIds: ['claude', 'gpt'],
            moderatorAgentId: 'claude',
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'route-start-research' }) }
      );

      assert.equal(response.status, 200);
      const events = await readSSEEvents(response);
      assert.equal(events.at(-1)?.type, 'discussion_complete');

      const detailResponse = await getSessionRoute(
        new Request('http://localhost/api/sessions/route-start-research'),
        { params: Promise.resolve({ id: 'route-start-research' }) }
      );
      const detail = await detailResponse.json();

      assert.equal(detail.researchRun.status, 'completed');
      assert.equal(detail.researchRun.sources.length, 2);
      assert.equal(detail.researchRun.queryPlan.length >= 3, true);
      assert.equal(detail.researchRun.searchConfig.mode, 'guided');
      assert.equal(detail.decisionSummary.evidence[0].sourceIds[0], 'R1');
    }
  );
});

test('stop and interjection routes handle running, completed, and missing sessions', async () => {
  await createSession({
    id: 'running-session',
    topic: 'running',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  const interjectionResponse = await interjectionRoute(
    new Request('http://localhost/api/sessions/running/interjections', {
      method: 'POST',
      body: JSON.stringify({
        content: '请补充风险分析',
        controlType: 'add_constraint',
        phase: 'analysis',
        round: 0,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'running-session' }) }
  );
  assert.equal(interjectionResponse.status, 200);
  const interjectionPayload = await interjectionResponse.json();
  assert.equal(interjectionPayload.controlType, 'add_constraint');

  const stopRunningResponse = await stopSessionRoute(
    new Request('http://localhost/api/sessions/running/stop', { method: 'POST' }),
    { params: Promise.resolve({ id: 'running-session' }) }
  );
  assert.equal(stopRunningResponse.status, 200);
  assert.equal(await getSessionStatus('running-session'), 'stopped');

  const stopMissingResponse = await stopSessionRoute(
    new Request('http://localhost/api/sessions/missing/stop', { method: 'POST' }),
    { params: Promise.resolve({ id: 'missing-session' }) }
  );
  assert.equal(stopMissingResponse.status, 404);

  const interjectionMissingResponse = await interjectionRoute(
    new Request('http://localhost/api/sessions/missing/interjections', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'missing-session' }) }
  );
  assert.equal(interjectionMissingResponse.status, 404);

  await createSession({
    id: 'completed-session',
    topic: 'completed',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  const completedStopResponse = await stopSessionRoute(
    new Request('http://localhost/api/sessions/completed/stop', { method: 'POST' }),
    { params: Promise.resolve({ id: 'completed-session' }) }
  );
  assert.equal(completedStopResponse.status, 200);
});

test('session detail and delete routes cover found and missing history', async () => {
  await createSession({
    id: 'history-session',
    topic: 'history',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  const foundResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/history-session'),
    { params: Promise.resolve({ id: 'history-session' }) }
  );
  assert.equal(foundResponse.status, 200);
  const foundPayload = await foundResponse.json();
  assert.equal(foundPayload.parentSession, null);

  const patchResponse = await patchSessionRoute(
    new Request('http://localhost/api/sessions/history-session', {
      method: 'PATCH',
      body: JSON.stringify({ decisionStatus: 'adopted' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'history-session' }) }
  );
  assert.equal(patchResponse.status, 200);

  const missingResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/missing-session'),
    { params: Promise.resolve({ id: 'missing-session' }) }
  );
  assert.equal(missingResponse.status, 404);

  const deleteResponse = await deleteSessionRoute(
    new Request('http://localhost/api/sessions/history-session', { method: 'DELETE' }),
    { params: Promise.resolve({ id: 'history-session' }) }
  );
  assert.equal(deleteResponse.status, 200);

  const listResponse = await listSessionsRoute();
  const sessions = await listResponse.json();
  assert.equal(sessions.length, 0);
});
