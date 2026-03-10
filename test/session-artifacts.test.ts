import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDecisionSummaryMarkdown,
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
      confidence: 82,
      evidence: [{ claim: '研究支持该方向', sourceIds: ['R1', 'R2'] }],
    },
  });

  assert.match(markdown, /# Round Table Decision Card/);
  assert.match(markdown, /Confidence: 82%/);
  assert.match(markdown, /## Recommended Option/);
  assert.match(markdown, /先补 brief、decision card 和历史决策链。/);
  assert.match(markdown, /## Evidence Links/);
  assert.match(markdown, /R1, R2/);
});
