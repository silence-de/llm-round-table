import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST as startSessionRoute } from '@/app/api/sessions/[id]/start/route';
import { POST as interjectionRoute } from '@/app/api/sessions/[id]/interjections/route';
import { POST as resumePreviewRoute } from '@/app/api/sessions/[id]/resume-preview/route';
import { cleanupTestDatabaseFile, resetTestEnvironment } from './test-helpers.ts';

beforeEach(() => {
  resetTestEnvironment();
});

after(() => {
  cleanupTestDatabaseFile();
});

test('smoke: start route returns structured INVALID_INPUT error', async () => {
  const response = await startSessionRoute(
    new Request('http://localhost/api/sessions/smoke/start', {
      method: 'POST',
      body: JSON.stringify({ topic: '', agentIds: [] }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'smoke-start' }) }
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.code, 'INVALID_INPUT');
  assert.equal(typeof payload.error, 'string');
});

test('smoke: interjection route returns structured NOT_FOUND error', async () => {
  const response = await interjectionRoute(
    new Request('http://localhost/api/sessions/missing/interjections', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'missing-session' }) }
  );

  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.code, 'NOT_FOUND');
});

test('smoke: resume preview validates required params', async () => {
  const response = await resumePreviewRoute(
    new Request('http://localhost/api/sessions/preview/resume-preview', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 'preview' }) }
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.code, 'INVALID_INPUT');
});
