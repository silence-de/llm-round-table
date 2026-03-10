import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useDiscussionStore } from '@/stores/discussion-store';

beforeEach(() => {
  useDiscussionStore.getState().reset();
});

test('store reset clears live and replay state while preserving stage mode', () => {
  const store = useDiscussionStore.getState();

  store.setStageMode('mobile-hybrid');
  store.setSessionId('session-1');
  store.setRunning(true);
  store.setPhase('analysis');
  store.setRound(2);
  store.startAgent('gpt', 'analysis');
  store.appendAgentToken('gpt', 'streaming');
  store.startModerator('summary');
  store.appendModeratorToken('minutes');
  store.addInterjection({ content: 'follow-up' });
  store.setDecisionSummary({
    summary: 'summary',
    recommendedOption: 'option',
    why: [],
    risks: [],
    openQuestions: [],
    nextActions: [],
    confidence: 70,
    evidence: [],
  });
  store.setResearchStatus('completed');
  store.setResearchBriefText('brief');
  store.setResearchRun({
    id: 'session-1',
    sessionId: 'session-1',
    status: 'completed',
    queryPlan: ['query'],
    searchConfig: {
      enabled: true,
      mode: 'auto',
      userQueries: [],
      preferredDomains: [],
      maxSources: 6,
    },
    summary: 'research summary',
    evaluation: null,
    sources: [],
  });
  store.setReplayStatus('playing');
  store.setReplayCursor(3);

  useDiscussionStore.getState().reset();
  const next = useDiscussionStore.getState();

  assert.equal(next.sessionId, null);
  assert.equal(next.isRunning, false);
  assert.equal(next.phase, '');
  assert.equal(next.agentMessages.size, 0);
  assert.equal(next.moderatorMessages.length, 0);
  assert.equal(next.interjections.length, 0);
  assert.equal(next.decisionSummary, null);
  assert.equal(next.research.status, 'idle');
  assert.equal(next.research.run, null);
  assert.equal(next.replay.status, 'idle');
  assert.equal(next.ui.stageMode, 'mobile-hybrid');
});

test('replay cursor stops at the end of the timeline', () => {
  const store = useDiscussionStore.getState();

  store.setReplayStatus('playing');
  store.setReplayCursor(0);
  store.advanceReplayCursor(1);
  assert.equal(useDiscussionStore.getState().replay.cursor, 1);
  assert.equal(useDiscussionStore.getState().replay.status, 'playing');

  useDiscussionStore.getState().advanceReplayCursor(1);
  assert.equal(useDiscussionStore.getState().replay.cursor, 1);
  assert.equal(useDiscussionStore.getState().replay.status, 'paused');
});

test('finalizeAgent hands active speaker to the next streaming agent', () => {
  const store = useDiscussionStore.getState();

  store.startAgent('gpt', 'analysis');
  store.startAgent('claude', 'analysis');
  assert.equal(useDiscussionStore.getState().ui.activeSpeakerId, 'claude');

  store.finalizeAgent('claude');
  assert.equal(useDiscussionStore.getState().ui.activeSpeakerId, 'gpt');

  store.finalizeAgent('gpt');
  assert.equal(useDiscussionStore.getState().ui.activeSpeakerId, null);
});
