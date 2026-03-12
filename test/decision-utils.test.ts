import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEvidenceStatus,
  normalizePersistedDecisionSummary,
  parseDecisionSummary,
} from '@/lib/decision/utils';

test('normalizePersistedDecisionSummary restores citation labels from source ids', () => {
  const normalized = normalizePersistedDecisionSummary(
    {
      summary: 'summary',
      recommendedOption: 'option',
      why: [],
      risks: [],
      openQuestions: [],
      nextActions: [],
      alternativesRejected: [],
      redLines: [],
      revisitTriggers: [],
      confidence: 80,
      evidence: [{ claim: 'claim', sourceIds: ['src-1'] }],
    },
    [
      {
        id: 'src-1',
        title: 'Source',
        url: 'https://example.com/source',
        domain: 'example.com',
        snippet: 'snippet',
        score: 0.9,
        selected: true,
        pinned: false,
        rank: 1,
        stale: false,
        qualityFlags: [],
      },
    ]
  );

  assert.deepEqual(normalized.evidence[0].sourceIds, ['R1']);
});

test('normalizePersistedDecisionSummary lowers confidence for unsupported and stale evidence', () => {
  const normalized = normalizePersistedDecisionSummary(
    {
      summary: 'summary',
      recommendedOption: 'option',
      why: [],
      risks: [],
      openQuestions: [],
      nextActions: [],
      alternativesRejected: [],
      redLines: [],
      revisitTriggers: [],
      confidence: 84,
      evidence: [
        { claim: 'supported but stale', sourceIds: ['R1'] },
        { claim: 'unsupported', sourceIds: [], gapReason: 'missing proof' },
      ],
    },
    [
      {
        id: 'src-1',
        title: 'Stale source',
        url: 'https://example.com/stale',
        domain: 'example.com',
        snippet: 'snippet',
        score: 0.8,
        selected: true,
        pinned: false,
        rank: 1,
        stale: true,
        qualityFlags: ['stale_source'],
      },
    ]
  );

  assert.equal(normalized.evidence[0].sourceIds[0], 'R1');
  assert.equal(normalized.confidence < 84, true);
});

test('parseDecisionSummary backfills dossier fields from brief when missing', () => {
  const summary = parseDecisionSummary(
    JSON.stringify({
      summary: 'summary',
      recommendedOption: 'option',
      why: [],
      risks: [],
      openQuestions: [],
      nextActions: [],
      alternativesRejected: [],
      redLines: [],
      revisitTriggers: [],
      confidence: 72,
      evidence: [],
    }),
    'fallback',
    [],
    {
      topic: '职业选择',
      goal: '判断是否换工作',
      background: '',
      constraints: '',
      timeHorizon: '2年',
      nonNegotiables: '不能大幅降薪',
      acceptableDownside: '最多接受 3 个月试错成本',
      reviewAt: '2026-06-01',
      decisionType: 'career',
      desiredOutput: 'recommendation',
      templateId: 'career-choice',
    }
  );

  assert.equal(summary.nextActions.length > 0, true);
  assert.equal(summary.redLines[0].includes('不能大幅降薪'), true);
  assert.equal(summary.revisitTriggers[0].includes('2026-06-01'), true);
  assert.equal(summary.alternativesRejected.length > 0, true);
});

test('classifyEvidenceStatus differentiates supported inference and verify states', () => {
  assert.equal(
    classifyEvidenceStatus({ claim: 'supported', sourceIds: ['R1'] }),
    'supported'
  );
  assert.equal(
    classifyEvidenceStatus({
      claim: 'verify',
      sourceIds: [],
      gapReason: '待验证关键财务数据',
    }),
    'verify'
  );
  assert.equal(
    classifyEvidenceStatus({
      claim: 'inference',
      sourceIds: [],
      gapReason: '基于讨论推断，暂无直接证据',
    }),
    'inference'
  );
});
