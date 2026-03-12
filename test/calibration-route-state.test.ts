import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getCalibrationRoute } from '@/app/api/sessions/calibration/route';
import {
  createSession,
  upsertDecisionSummary,
} from '@/lib/db/repository';
import {
  cleanupTestDatabaseFile,
  resetTestEnvironment,
} from './test-helpers.ts';

beforeEach(() => {
  resetTestEnvironment();
});

after(() => {
  cleanupTestDatabaseFile();
});

test('calibration route returns a stable empty-state payload', async () => {
  const response = await getCalibrationRoute(
    new Request('http://localhost/api/sessions/calibration?window=all')
  );
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.reviewedSessions, 0);
  assert.deepEqual(payload.byTemplate, []);
  assert.deepEqual(payload.byDecisionType, []);
  assert.deepEqual(payload.agentModelDrift, []);
  assert.equal(payload.confidencePenaltyGuidance.length >= 1, true);
  assert.equal(payload.mostReliableTemplate, '');
  assert.equal(payload.largestBlindSpot, '');
  assert.equal(payload.sampleLabel, 'insufficient');
  assert.equal(typeof payload.sampleNote, 'string');
});

test('calibration route keeps low-data breakdowns well-formed', async () => {
  await createSession({
    id: 'calibration-low-data',
    moderatorAgentId: 'claude',
    maxDebateRounds: 2,
    selectedAgentIds: ['claude'],
    modelSelections: { claude: 'claude-sonnet' },
    personaSelections: {},
    personas: {},
    brief: {
      topic: 'low data',
      goal: '',
      background: '',
      constraints: '',
      timeHorizon: '',
      nonNegotiables: '',
      acceptableDownside: '',
      reviewAt: '',
      decisionType: 'career',
      desiredOutput: 'recommendation',
      templateId: 'offer-choice',
    },
  });

  await upsertDecisionSummary('calibration-low-data', {
    summary: 'summary',
    recommendedOption: 'option',
    why: ['why'],
    risks: ['risk'],
    openQuestions: ['question'],
    nextActions: ['action'],
    alternativesRejected: ['alternative'],
    redLines: ['red line'],
    revisitTriggers: ['trigger'],
    confidence: 73,
    evidence: [{ claim: 'claim', sourceIds: ['R1'], gapReason: '' }],
  });

  const patchRoute = await import('@/app/api/sessions/[id]/route');
  await patchRoute.PATCH(
    new Request('http://localhost/api/sessions/calibration-low-data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcomeSummary: 'good outcome',
        actualOutcome: 'recommendation held',
        outcomeConfidence: 68,
      }),
    }),
    { params: Promise.resolve({ id: 'calibration-low-data' }) }
  );

  const response = await getCalibrationRoute(
    new Request('http://localhost/api/sessions/calibration?window=all')
  );
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.reviewedSessions, 1);
  assert.equal(payload.byTemplate.length, 1);
  assert.equal(payload.byDecisionType.length, 1);
  assert.equal(typeof payload.sourcedVsUnsourced.delta, 'number');
  assert.equal(payload.timeline.length, 1);
  assert.equal(payload.agentModelDrift.length, 1);
  assert.equal(payload.sampleLabel, 'insufficient');
  assert.equal(typeof payload.sampleNote, 'string');
});
