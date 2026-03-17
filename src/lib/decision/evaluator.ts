import type { DecisionBrief, DecisionSummary, DiscussionAgenda } from './types';

export interface SummaryEvaluationCheck {
  name: string;
  pass: boolean;
  reason: string;
}

export interface SummaryEvaluation {
  pass: boolean;
  checks: SummaryEvaluationCheck[];
  overallNote: string;
}

export function buildEvaluatorPrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  summary: DecisionSummary,
  previousFeedback?: string
): string {
  const summaryJson = JSON.stringify({
    summary: summary.summary,
    recommendedOption: summary.recommendedOption,
    why: summary.why,
    risks: summary.risks,
    openQuestions: summary.openQuestions,
    nextActions: summary.nextActions,
    redLines: summary.redLines,
    revisitTriggers: summary.revisitTriggers,
    evidence: summary.evidence?.map(e => ({
      claim: e.claim,
      hasSourceIds: e.sourceIds && e.sourceIds.length > 0,
      gapReason: e.gapReason,
    })),
  }, null, 2);

  const briefContext = [
    `议题：${brief.topic}`,
    brief.goal ? `目标：${brief.goal}` : '',
    brief.constraints ? `约束：${brief.constraints}` : '',
    brief.nonNegotiables ? `不可妥协：${brief.nonNegotiables}` : '',
    agenda.focalQuestions ? `重点问题：${agenda.focalQuestions}` : '',
  ].filter(Boolean).join('\n');

  const feedbackSection = previousFeedback
    ? `\n上次评估反馈（请确保本次修正了这些问题）：\n${previousFeedback}\n`
    : '';

  return `你是一位决策质量评审员。请对以下决策摘要进行 QA 校验。

决策背景：
${briefContext}
${feedbackSection}
决策摘要（JSON）：
${summaryJson}

请用以下 JSON 格式回复（不要包含 markdown 代码块）：
{
  "checks": [
    { "name": "brief_coverage", "pass": true/false, "reason": "说明" },
    { "name": "disagreement_coverage", "pass": true/false, "reason": "说明" },
    { "name": "evidence_alignment", "pass": true/false, "reason": "说明" },
    { "name": "gap_honesty", "pass": true/false, "reason": "说明" },
    { "name": "completeness", "pass": true/false, "reason": "说明" }
  ],
  "overallNote": "总体评价，指出最需要改进的地方（如果有）"
}

评审维度说明：
- brief_coverage：推荐是否覆盖了 brief 中的关键约束和目标
- disagreement_coverage：推荐是否回应了主要分歧（参考 openQuestions）
- evidence_alignment：recommendedOption 和 why 是否与有来源的 evidence 对齐，而非仅依赖 gapReason
- gap_honesty：evidence 中的证据空白是否被诚实呈现（gapReason），而非被当作已确认结论使用
- completeness：redLines、revisitTriggers、nextActions 是否非空且有实质内容`;
}

export function parseEvaluation(content: string): SummaryEvaluation {
  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }
    const parsed = JSON.parse(jsonStr) as Partial<SummaryEvaluation>;
    const checks: SummaryEvaluationCheck[] = Array.isArray(parsed.checks)
      ? parsed.checks.filter(
          (c): c is SummaryEvaluationCheck =>
            typeof c?.name === 'string' &&
            typeof c?.pass === 'boolean' &&
            typeof c?.reason === 'string'
        )
      : [];
    const pass = checks.length > 0 ? checks.every((c) => c.pass) : true;
    return {
      pass,
      checks,
      overallNote: typeof parsed.overallNote === 'string' ? parsed.overallNote : '',
    };
  } catch {
    return { pass: true, checks: [], overallNote: 'evaluation parse failed, skipping' };
  }
}
