import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getAgents } from '@/app/api/agents/route';
import { GET as listSessionsRoute } from '@/app/api/sessions/route';
import { GET as getSessionRoute, DELETE as deleteSessionRoute } from '@/app/api/sessions/[id]/route';
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

beforeEach(() => {
  resetTestEnvironment();
});

after(() => {
  cleanupTestDatabaseFile();
});

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
      chat: async () => ({
        content: JSON.stringify({
          agreements: [],
          disagreements: [],
          shouldConverge: true,
          moderatorNarrative: '直接进入总结。',
        }),
        usage: { inputTokens: 8, outputTokens: 16 },
      }),
    })
  );

  const response = await startSessionRoute(
    new Request('http://localhost/api/sessions/test/start', {
      method: 'POST',
      body: JSON.stringify({
        topic: '功能补完测试',
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

  const detailResponse = await getSessionRoute(
    new Request('http://localhost/api/sessions/route-start-success'),
    { params: Promise.resolve({ id: 'route-start-success' }) }
  );
  const detail = await detailResponse.json();

  assert.equal(detail.session.status, 'completed');
  assert.ok(detail.messages.length >= 3);
  assert.match(detail.minutes.content, /圆桌讨论纪要/);
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
      body: JSON.stringify({ content: '请补充风险分析', phase: 'analysis', round: 0 }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'running-session' }) }
  );
  assert.equal(interjectionResponse.status, 200);

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
