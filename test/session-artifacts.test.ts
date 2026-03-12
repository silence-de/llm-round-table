import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDecisionDossierMarkdown,
  buildDecisionSummaryMarkdown,
  buildExecutionChecklistMarkdown,
  buildTranscriptMarkdown,
} from '@/lib/session-artifacts';

test('buildTranscriptMarkdown renders topic, status, message count, and timeline', () => {
  const markdown = buildTranscriptMarkdown({
    topic: '  产品功能补齐  ',
    status: 'completed',
    messages: [
      {
        role: 'moderator',
        phase: 'summary',
        content: '形成了明确结论。',
        displayName: 'Moderator',
        createdAt: 1_700_000_000_000,
      },
      {
        role: 'user',
        phase: 'analysis',
        content: '请补充风险项。',
        displayName: 'User',
      },
    ],
  });

  assert.match(markdown, /# Round Table Transcript/);
  assert.match(markdown, /## Topic\n产品功能补齐/);
  assert.match(markdown, /- Status: completed/);
  assert.match(markdown, /- Messages: 2/);
  assert.match(markdown, /### \[summary\] Moderator/);
  assert.match(markdown, /### \[analysis\] User/);
  assert.match(markdown, /形成了明确结论。/);
});

test('buildTranscriptMarkdown handles empty transcript state', () => {
  const markdown = buildTranscriptMarkdown({
    topic: '',
    messages: [],
  });

  assert.match(markdown, /Untitled session/);
  assert.match(markdown, /_No messages captured._/);
});

test('buildDecisionSummaryMarkdown renders structured decision card sections', () => {
  const markdown = buildDecisionSummaryMarkdown({
    topic: '阶段路线',
    status: 'adopted',
    decisionSummary: {
      summary: '建议优先完成产品化工作流。',
      recommendedOption: '先补 brief、decision card 和历史决策链。',
      why: ['这能提升复用性'],
      risks: ['实现复杂度上升'],
      openQuestions: ['如何做多人协作'],
      nextActions: ['补充 schema', '调整 UI'],
      alternativesRejected: ['暂不做多人协作'],
      redLines: ['如果缺少关键证据就暂停'],
      revisitTriggers: ['一周后补新证据复盘'],
      confidence: 82,
      evidence: [{ claim: '研究支持该方向', sourceIds: ['R1', 'R2'] }],
    },
  });

  assert.match(markdown, /# Round Table Decision Card/);
  assert.match(markdown, /Confidence: 82%/);
  assert.match(markdown, /## Recommended Option/);
  assert.match(markdown, /先补 brief、decision card 和历史决策链。/);
  assert.match(markdown, /## Alternatives Rejected/);
  assert.match(markdown, /## Red Lines/);
  assert.match(markdown, /## Evidence Links/);
  assert.match(markdown, /R1, R2/);
});

test('buildExecutionChecklistMarkdown renders status and notes', () => {
  const markdown = buildExecutionChecklistMarkdown({
    topic: '执行闭环',
    status: 'needs_follow_up',
    actionItems: [
      {
        id: 'a1',
        content: 'Ship review panel',
        status: 'verified',
        source: 'generated',
        carriedFromSessionId: null,
        note: 'Completed on March 10, 2026.',
        owner: 'PM',
        dueAt: 1_700_000_000_000,
        verifiedAt: 1_700_000_000_000,
        verificationNote: 'Validated in production rollout.',
        priority: 'high',
        sortOrder: 0,
      },
      {
        id: 'a2',
        content: 'Carry unresolved risks',
        status: 'in_progress',
        source: 'carried_forward',
        carriedFromSessionId: 'session-1',
        note: '',
        owner: '',
        dueAt: null,
        verifiedAt: null,
        verificationNote: '',
        priority: 'medium',
        sortOrder: 1,
      },
    ],
  });

  assert.match(markdown, /# Round Table Execution Checklist/);
  assert.match(markdown, /- Status: needs_follow_up/);
  assert.match(markdown, /\[x\] Ship review panel/);
  assert.match(markdown, /source=carried_forward/);
  assert.match(markdown, /Completed on March 10, 2026/);
});

test('buildDecisionDossierMarkdown includes parent comparison and claim map', () => {
  const markdown = buildDecisionDossierMarkdown({
    topic: '重大职业选择',
    status: 'needs_follow_up',
    brief: {
      goal: '比较两份 offer',
      timeHorizon: '2 years',
      nonNegotiables: '不能离开上海',
      acceptableDownside: '最多接受 20% 现金波动',
      reviewAt: '2026-06-01',
    },
    decisionSummary: {
      summary: '建议先选更稳的 offer。',
      recommendedOption: 'Offer A',
      why: ['现金流更稳'],
      risks: ['成长速度略慢'],
      openQuestions: ['团队负责人风格待验证'],
      nextActions: ['约一次 manager follow-up'],
      alternativesRejected: ['Offer B 的下行更深'],
      redLines: ['如果现金流不确定则不推进'],
      revisitTriggers: ['半年后复盘成长兑现情况'],
      confidence: 74,
      evidence: [
        { claim: '现金流更稳', sourceIds: ['R1'] },
        { claim: '文化匹配度', sourceIds: [], gapReason: '待验证用人经理风格' },
      ],
    },
    actionItems: [
      {
        id: 'a1',
        content: '约 manager follow-up',
        status: 'pending',
        source: 'generated',
        carriedFromSessionId: null,
        note: '',
        owner: 'self',
        dueAt: null,
        verifiedAt: null,
        verificationNote: '',
        priority: 'high',
        sortOrder: 0,
      },
    ],
    parentReviewComparison: {
      topic: '上次 offer 选择',
      recommendedOption: 'Offer C',
      predictedConfidence: 80,
      outcomeSummary: '成长性低于预期',
      actualOutcome: '半年后重新找工作',
      outcomeConfidence: 48,
      retrospectiveNote: '高估了 manager 质量',
    },
    review: {
      outcomeSummary: '尚未落地，等待终面反馈',
      actualOutcome: '',
      outcomeConfidence: 0,
      retrospectiveNote: '下一轮需要更早问清团队文化',
    },
  });

  assert.match(markdown, /# Round Table Decision Dossier/);
  assert.match(markdown, /## Previous Prediction Vs Reality/);
  assert.match(markdown, /\[supported\] 现金流更稳/);
  assert.match(markdown, /\[verify\] 文化匹配度/);
  assert.match(markdown, /## Execution Checklist/);
});
