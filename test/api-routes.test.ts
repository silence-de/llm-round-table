import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getAgents } from '@/app/api/agents/route';
import { GET as listSessionsRoute } from '@/app/api/sessions/route';
import {
  GET as getSessionRoute,
  DELETE as deleteSessionRoute,
  PATCH as patchSessionRoute,
} from '@/app/api/sessions/[id]/route';
import { PATCH as patchActionItemRoute } from '@/app/api/sessions/[id]/action-items/[itemId]/route';
import { POST as rerunResearchRoute } from '@/app/api/sessions/[id]/research/route';
import { PATCH as patchResearchSourceRoute } from '@/app/api/sessions/[id]/research/sources/[sourceId]/route';
import { POST as resumePreviewRoute } from '@/app/api/sessions/[id]/resume-preview/route';
import { POST as followUpPreviewRoute } from '@/app/api/sessions/[id]/follow-up/route';
import { POST as startSessionRoute } from '@/app/api/sessions/[id]/start/route';
import { POST as stopSessionRoute } from '@/app/api/sessions/[id]/stop/route';
import { POST as interjectionRoute } from '@/app/api/sessions/[id]/interjections/route';
import {
  appendMessage,
  createSession,
  getSessionStatus,
  updateSessionStatus,
  upsertDecisionSummary,
} from '@/lib/db/repository';
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
  process.env.DEEPSEEK_API_KEY = 'test-deepseek';
  process.env.MOONSHOT_API_KEY = 'test-moonshot';

  const response = await getAgents();
  const payload = await response.json();

  assert.ok(Array.isArray(payload.agents));
  assert.ok(Array.isArray(payload.personaPresets));
  assert.equal(
    payload.agents.find((agent: { id: string }) => agent.id === 'gpt')?.available,
    true
  );
  assert.equal(
    payload.agents.find((agent: { id: string }) => agent.id === 'deepseek')
      ?.available,
    true
  );
  assert.equal(
    payload.agents.find((agent: { id: string }) => agent.id === 'kimi')?.available,
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
  assert.deepEqual(
    detail.actionItems.map((item: { content: string }) => item.content),
    ['扩 schema', '补 UI']
  );
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
              domainPolicy: 'prefer',
              maxSources: 4,
              maxReruns: 2,
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

test('research rerun route refreshes sources and source selection persists', async () => {
  process.env.TAVILY_API_KEY = 'test-tavily';

  await createSession({
    id: 'research-rerun-session',
    topic: 'research rerun',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
    researchConfig: {
      enabled: true,
      mode: 'guided',
      userQueries: ['research rerun manual query'],
      preferredDomains: ['example.com'],
      domainPolicy: 'prefer',
      maxSources: 4,
      maxReruns: 2,
    },
  });

  await withMockedTavilyResults(
    [
      {
        title: 'Official update',
        url: 'https://docs.example.com/a',
        content: 'Documentation update for validation and rollout.',
        score: 0.88,
        published_date: '2026-03-08',
      },
      {
        title: 'Market news',
        url: 'https://news.example.com/b',
        content: 'News coverage on the main downside risk.',
        score: 0.79,
        published_date: '2026-03-05',
      },
    ],
    async () => {
      const rerunResponse = await rerunResearchRoute(
        new Request('http://localhost/api/sessions/research-rerun-session/research', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'research-rerun-session' }) }
      );

      assert.equal(rerunResponse.status, 200);
      const rerunPayload = await rerunResponse.json();
      assert.equal(rerunPayload.status, 'completed');
      assert.equal(rerunPayload.sources.length, 2);

      const sourceResponse = await patchResearchSourceRoute(
        new Request(
          `http://localhost/api/sessions/research-rerun-session/research/sources/${rerunPayload.sources[0].id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              selected: false,
              pinned: true,
              rank: 1,
              excludedReason: 'manual_exclude',
            }),
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        {
          params: Promise.resolve({
            id: 'research-rerun-session',
            sourceId: rerunPayload.sources[0].id,
          }),
        }
      );

      assert.equal(sourceResponse.status, 200);
      const sourcePayload = await sourceResponse.json();
      assert.equal(sourcePayload.selected, false);
      assert.equal(sourcePayload.pinned, true);
      assert.equal(sourcePayload.rank, 1);
      assert.equal(sourcePayload.excludedReason, 'manual_exclude');
    }
  );

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/research-rerun-session'),
    { params: Promise.resolve({ id: 'research-rerun-session' }) }
  );
  const detail = await detailResponse.json();

  assert.equal(detail.researchRun.sources[0].selected, false);
  assert.equal(detail.researchRun.sources[0].pinned, true);
  assert.equal(detail.researchRun.sources[0].excludedReason, 'manual_exclude');
  assert.equal(detail.researchRun.queryPlan.length >= 3, true);
});

test('research rerun route enforces max rerun budget', async () => {
  process.env.TAVILY_API_KEY = 'test-tavily';
  await createSession({
    id: 'research-rerun-budget-session',
    topic: 'research budget',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
    researchConfig: {
      enabled: true,
      mode: 'auto',
      userQueries: [],
      preferredDomains: [],
      domainPolicy: 'prefer',
      maxSources: 4,
      maxReruns: 1,
    },
  });

  await withMockedTavilyResults(
    [
      {
        title: 'Budget doc',
        url: 'https://example.com/rerun-budget',
        content: 'rerun budget sample',
        score: 0.8,
        published_date: '2026-03-09',
      },
    ],
    async () => {
      const first = await rerunResearchRoute(
        new Request(
          'http://localhost/api/sessions/research-rerun-budget-session/research',
          {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        { params: Promise.resolve({ id: 'research-rerun-budget-session' }) }
      );
      assert.equal(first.status, 200);

      const second = await rerunResearchRoute(
        new Request(
          'http://localhost/api/sessions/research-rerun-budget-session/research',
          {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        { params: Promise.resolve({ id: 'research-rerun-budget-session' }) }
      );
      assert.equal(second.status, 429);
      const payload = await second.json();
      assert.equal(payload.code, 'RATE_LIMITED');
    }
  );
});

test('start route can safely resume a failed session from the last stable phase', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.OPENAI_API_KEY = 'test-openai';

  await createSession({
    id: 'failed-source-session',
    topic: 'resume test',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await appendMessage({
    sessionId: 'failed-source-session',
    role: 'moderator',
    agentId: 'moderator',
    displayName: 'Moderator',
    phase: 'opening',
    content: '主持人开场',
  });
  await appendMessage({
    sessionId: 'failed-source-session',
    role: 'agent',
    agentId: 'gpt',
    displayName: 'GPT',
    phase: 'initial_responses',
    content: '参与者初始观点',
  });
  await updateSessionStatus('failed-source-session', 'failed');

  const streamPrompts: string[] = [];
  installFakeProviders(
    new FakeProvider({
      streamChat: async function* (params) {
        streamPrompts.push(params.messages[0]?.content ?? '');
        if (params.messages[0]?.content.includes('会议纪要')) {
          yield* streamText('# 恢复后的纪要');
          return;
        }

        yield* streamText('不应重新执行 opening 或 initial');
      },
      chat: async () => ({
        content: JSON.stringify({
          agreements: [],
          disagreements: [],
          shouldConverge: true,
          moderatorNarrative: '恢复后直接从分析继续。',
        }),
        usage: { inputTokens: 8, outputTokens: 12 },
      }),
    })
  );

  const response = await startSessionRoute(
    new Request('http://localhost/api/sessions/resumed-session/start', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'resume test',
        agentIds: ['claude', 'gpt'],
        moderatorAgentId: 'claude',
        resumeFromSessionId: 'failed-source-session',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'resumed-session' }) }
  );

  assert.equal(response.status, 200);
  const events = await readSSEEvents(response);
  assert.equal(events.at(-1)?.type, 'discussion_complete');

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/resumed-session'),
    { params: Promise.resolve({ id: 'resumed-session' }) }
  );
  const detail = await detailResponse.json();

  assert.equal(detail.parentSession.id, 'failed-source-session');
  assert.equal(detail.resumeMeta.snapshot.nextPhase, 'analysis');
  assert.equal(detail.resumeMeta.snapshot.inherited.includes('opening'), true);
  assert.equal(detail.resumeMeta.snapshot.discarded.includes('analysis'), true);
  assert.equal(
    detail.messages.some((message: { phase: string }) => message.phase === 'opening'),
    false
  );
  assert.equal(
    detail.messages.some(
      (message: { phase: string }) => message.phase === 'initial_responses'
    ),
    false
  );
  assert.equal(
    detail.messages.some((message: { phase: string }) => message.phase === 'analysis'),
    true
  );
  assert.equal(
    streamPrompts.some((prompt) => prompt.includes('请就以下议题发表你的观点')),
    false
  );
});

test('resume preview route returns explainable snapshot for failed sessions', async () => {
  await createSession({
    id: 'resume-preview-source',
    topic: 'resume preview',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });
  await appendMessage({
    sessionId: 'resume-preview-source',
    role: 'moderator',
    agentId: 'moderator',
    displayName: 'Moderator',
    phase: 'opening',
    content: '主持人开场',
  });
  await updateSessionStatus('resume-preview-source', 'failed');

  const response = await resumePreviewRoute(
    new Request('http://localhost/api/sessions/preview-target/resume-preview', {
      method: 'POST',
      body: JSON.stringify({ resumeFromSessionId: 'resume-preview-source' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'preview-target' }) }
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.resumeSnapshot.nextPhase, 'initial_responses');
  assert.equal(payload.resumeSnapshot.discarded.includes('analysis'), true);
  assert.equal(payload.resumeSnapshot.reason.length > 0, true);
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

test('follow-up sessions carry forward unfinished action items', async () => {
  await createSession({
    id: 'parent-session',
    topic: 'parent',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await upsertDecisionSummary('parent-session', {
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: ['Validate demand', 'Prepare launch checklist'],
    confidence: 72,
    evidence: [],
  });

  const parentDetailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/parent-session'),
    { params: Promise.resolve({ id: 'parent-session' }) }
  );
  const parentDetail = await parentDetailResponse.json();
  const firstItemId = parentDetail.actionItems[0].id as string;

  await patchActionItemRoute(
    new Request(`http://localhost/api/sessions/parent-session/action-items/${firstItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_progress',
        note: 'Owner: PM',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'parent-session', itemId: firstItemId }) }
  );

  const secondItemId = parentDetail.actionItems[1].id as string;
  await patchActionItemRoute(
    new Request(`http://localhost/api/sessions/parent-session/action-items/${secondItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_progress',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'parent-session', itemId: secondItemId }) }
  );
  await patchActionItemRoute(
    new Request(`http://localhost/api/sessions/parent-session/action-items/${secondItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'verified',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'parent-session', itemId: secondItemId }) }
  );

  await createSession({
    id: 'child-session',
    topic: 'child',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
    parentSessionId: 'parent-session',
    carryForwardMode: 'all_open',
  });

  const childDetailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/child-session'),
    { params: Promise.resolve({ id: 'child-session' }) }
  );
  const childDetail = await childDetailResponse.json();

  assert.equal(childDetail.parentSession.id, 'parent-session');
  assert.equal(childDetail.actionItems.length, 1);
  assert.equal(childDetail.actionItems[0].content, 'Validate demand');
  assert.equal(childDetail.actionItems[0].source, 'carried_forward');
  assert.equal(childDetail.actionItems[0].status, 'in_progress');
  assert.equal(childDetail.actionItems[0].carriedFromSessionId, 'parent-session');
  assert.equal(childDetail.actionItems[0].note, 'Owner: PM');
});

test('follow-up sessions can inherit only high-priority open action items', async () => {
  await createSession({
    id: 'priority-parent-session',
    topic: 'parent',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await upsertDecisionSummary('priority-parent-session', {
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: ['High impact follow-up', 'Routine cleanup'],
    confidence: 75,
    evidence: [],
  });

  const parentDetailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/priority-parent-session'),
    { params: Promise.resolve({ id: 'priority-parent-session' }) }
  );
  const parentDetail = await parentDetailResponse.json();

  await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/priority-parent-session/action-items/${parentDetail.actionItems[0].id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ priority: 'high' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'priority-parent-session',
        itemId: parentDetail.actionItems[0].id,
      }),
    }
  );
  await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/priority-parent-session/action-items/${parentDetail.actionItems[1].id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ priority: 'medium' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'priority-parent-session',
        itemId: parentDetail.actionItems[1].id,
      }),
    }
  );

  await createSession({
    id: 'priority-child-session',
    topic: 'child',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
    parentSessionId: 'priority-parent-session',
    carryForwardMode: 'high_priority_only',
  });

  const childDetailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/priority-child-session'),
    { params: Promise.resolve({ id: 'priority-child-session' }) }
  );
  const childDetail = await childDetailResponse.json();

  assert.equal(childDetail.actionItems.length, 1);
  assert.equal(childDetail.actionItems[0].content, 'High impact follow-up');
  assert.equal(childDetail.actionItems[0].priority, 'high');
});

test('session patch route persists review fields and action item route updates execution items', async () => {
  await createSession({
    id: 'review-session',
    topic: 'history',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await upsertDecisionSummary('review-session', {
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: ['Ship decision log'],
    confidence: 70,
    evidence: [],
  });

  const patchResponse = await patchSessionRoute(
    new Request('http://localhost/api/sessions/review-session', {
      method: 'PATCH',
      body: JSON.stringify({
        decisionStatus: 'needs_follow_up',
        actualOutcome: 'Rollout stabilized after hotfix.',
        outcomeConfidence: 68,
        outcomeSummary: 'Initial rollout completed.',
        retrospectiveNote: 'Need stronger ownership mapping.',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'review-session' }) }
  );
  assert.equal(patchResponse.status, 200);

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/review-session'),
    { params: Promise.resolve({ id: 'review-session' }) }
  );
  const detail = await detailResponse.json();
  const itemId = detail.actionItems[0].id as string;
  await patchActionItemRoute(
    new Request(`http://localhost/api/sessions/review-session/action-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_progress',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'review-session', itemId }) }
  );

  const actionItemResponse = await patchActionItemRoute(
    new Request(`http://localhost/api/sessions/review-session/action-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'verified',
        note: 'Closed on March 10, 2026.',
        owner: 'Eng Lead',
        priority: 'high',
        verificationNote: 'Validated with production telemetry.',
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'review-session', itemId }) }
  );
  assert.equal(actionItemResponse.status, 200);
  const updatedItem = await actionItemResponse.json();
  assert.equal(updatedItem.status, 'verified');
  assert.equal(updatedItem.note, 'Closed on March 10, 2026.');
  assert.equal(updatedItem.owner, 'Eng Lead');
  assert.equal(updatedItem.priority, 'high');
  assert.equal(updatedItem.verificationNote, 'Validated with production telemetry.');
  assert.ok(updatedItem.verifiedAt);

  const refreshedResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/review-session'),
    { params: Promise.resolve({ id: 'review-session' }) }
  );
  const refreshed = await refreshedResponse.json();

  assert.equal(refreshed.session.decisionStatus, 'needs_follow_up');
  assert.equal(refreshed.session.actualOutcome, 'Rollout stabilized after hotfix.');
  assert.equal(refreshed.session.outcomeConfidence, 68);
  assert.equal(refreshed.session.outcomeSummary, 'Initial rollout completed.');
  assert.equal(
    refreshed.session.retrospectiveNote,
    'Need stronger ownership mapping.'
  );
  assert.equal(refreshed.actionItems[0].status, 'verified');
  assert.equal(refreshed.actionItems[0].note, 'Closed on March 10, 2026.');
  assert.equal(refreshed.actionItems[0].owner, 'Eng Lead');
  assert.equal(refreshed.actionStats.total, refreshed.actionItems.length);
  assert.equal(refreshed.actionStats.verified, 1);
});

test('action item route enforces transition rules and discard validation', async () => {
  await createSession({
    id: 'action-validation-session',
    topic: 'validation',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await upsertDecisionSummary('action-validation-session', {
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: ['Validate integration'],
    confidence: 70,
    evidence: [],
  });

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/action-validation-session'),
    { params: Promise.resolve({ id: 'action-validation-session' }) }
  );
  const detail = await detailResponse.json();
  const itemId = detail.actionItems[0].id as string;

  const invalidTransition = await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/action-validation-session/action-items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'verified' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'action-validation-session',
        itemId,
      }),
    }
  );
  assert.equal(invalidTransition.status, 409);
  const invalidPayload = await invalidTransition.json();
  assert.equal(invalidPayload.code, 'ACTION_INVALID_TRANSITION');

  await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/action-validation-session/action-items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'action-validation-session',
        itemId,
      }),
    }
  );

  const missingDiscardNote = await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/action-validation-session/action-items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'discarded' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'action-validation-session',
        itemId,
      }),
    }
  );
  assert.equal(missingDiscardNote.status, 400);
  const missingDiscardNotePayload = await missingDiscardNote.json();
  assert.equal(missingDiscardNotePayload.code, 'ACTION_VALIDATION_FAILED');

  const discardedResponse = await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/action-validation-session/action-items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'discarded',
          verificationNote: 'Blocked by legal dependency',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'action-validation-session',
        itemId,
      }),
    }
  );
  assert.equal(discardedResponse.status, 200);
});

test('follow-up preview route reports inheritance counts and skip reasons', async () => {
  await createSession({
    id: 'followup-preview-parent',
    topic: 'parent',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude', 'gpt'],
    modelSelections: {},
    personaSelections: {},
    personas: {},
  });

  await upsertDecisionSummary('followup-preview-parent', {
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: ['High priority item', 'Medium priority item'],
    confidence: 80,
    evidence: [],
  });

  const parentDetailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/followup-preview-parent'),
    { params: Promise.resolve({ id: 'followup-preview-parent' }) }
  );
  const parentDetail = await parentDetailResponse.json();

  await patchActionItemRoute(
    new Request(
      `http://localhost/api/sessions/followup-preview-parent/action-items/${parentDetail.actionItems[0].id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ priority: 'high', status: 'in_progress' }),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
    {
      params: Promise.resolve({
        id: 'followup-preview-parent',
        itemId: parentDetail.actionItems[0].id,
      }),
    }
  );

  const previewResponse = await followUpPreviewRoute(
    new Request('http://localhost/api/sessions/followup-preview-parent/follow-up', {
      method: 'POST',
      body: JSON.stringify({ carryForwardMode: 'high_priority_only' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'followup-preview-parent' }) }
  );
  assert.equal(previewResponse.status, 200);
  const previewPayload = await previewResponse.json();
  assert.equal(previewPayload.inheritedActionCount, 1);
  assert.ok(Array.isArray(previewPayload.skippedReason));
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
