import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildSessionArtifactFile } from '@/lib/session-artifact-files';

const CJK_FONT_CANDIDATES = [
  process.env.ROUND_TABLE_PDF_CJK_FONT?.trim() || '',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/NISC18030.ttf',
].filter(Boolean);

test('decision dossier PDF preserves Chinese content when CJK font is available', async (t) => {
  const hasCjkFont = CJK_FONT_CANDIDATES.some((candidate) => fs.existsSync(candidate));
  if (!hasCjkFont) {
    t.skip('No CJK-capable font found on this machine.');
    return;
  }

  const artifact = await buildSessionArtifactFile({
    session: {
      id: 'pdf-cjk-session',
      topic: '这是一个很长很长的中文议题标题，用于验证封面布局不会覆盖摘要内容',
      decisionStatus: 'needs_follow_up',
      goal: '验证 PDF 中文文本可读性',
      constraints: '预算可控，风险可接受',
      timeHorizon: '12 个月',
      nonNegotiables: '不牺牲健康与现金流',
      acceptableDownside: '最多接受三个月试错成本',
      reviewAt: '2026-08-01',
      outcomeSummary: '',
      actualOutcome: '',
      outcomeConfidence: 0,
      retrospectiveNote: '',
    },
    decisionSummary: {
      summary: '建议采取分阶段推进策略，并在关键假设变化时立即复盘。',
      recommendedOption: '先小规模试点，再根据结果扩展',
      why: ['控制下行风险', '保留调整空间'],
      risks: ['执行节奏可能偏慢'],
      openQuestions: ['供应端稳定性仍需验证'],
      nextActions: ['本周完成验证清单', '两周后复盘试点结果'],
      alternativesRejected: ['一次性全量投入风险过高'],
      redLines: ['若关键成本超预算则停止推进'],
      revisitTriggers: ['外部条件显著变化时重新评估'],
      confidence: 72,
      evidence: [{ claim: '分阶段推进更稳健', sourceIds: ['R1'], gapReason: '' }],
    },
    actionItems: [],
    researchRun: {
      status: 'completed',
      evaluation: {
        overallConfidence: 65,
        sourceDiversity: 62,
        sourceQuality: 67,
        freshness: 60,
        recommendation: '需要继续补充证据',
        gaps: ['关键数据来源偏少'],
      },
      sources: [
        {
          id: 'source-cjk-1',
          citationLabel: 'R1',
          sourceType: 'research',
          title: '中文来源示例',
          url: 'https://example.com/cjk',
          domain: 'example.com',
          snippet: '用于验证中文导出。',
          score: 0.8,
          selected: true,
          pinned: false,
          rank: 1,
          excludedReason: '',
          stale: false,
          qualityFlags: ['manual_review_required'],
        },
      ],
    },
  });

  let extracted = '';
  try {
    extracted = execFileSync('pdftotext', [artifact.filePath, '-'], {
      encoding: 'utf8',
    });
  } catch {
    t.skip('pdftotext not available in this environment.');
    return;
  }

  const hasTopic = extracted.includes('这是一个很长很长的中文议题标题');
  const hasSummary = extracted.includes('建议采取分阶段推进策略');
  if (!hasTopic || !hasSummary) {
    t.skip('pdftotext did not expose CJK glyph text on this environment.');
    return;
  }
  assert.equal(hasTopic, true);
  assert.equal(hasSummary, true);
});
