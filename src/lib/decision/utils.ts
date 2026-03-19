import type {
  ActionItemStatus,
  DecisionConfidenceMeta,
  DecisionBrief,
  DecisionControlType,
  DecisionSummaryEvidence,
  DecisionStatus,
  DecisionSummary,
  DesiredOutput,
  DiscussionAgenda,
  DecisionType,
} from './types';
import type { ResearchSource } from '../search/types';
import {
  findResearchSourceByCitation,
  getResearchSourceCitationLabel,
} from '../search/utils';
import { validateDecisionSummary } from './validators';

const ACTION_ITEM_TRANSITIONS: Record<ActionItemStatus, ActionItemStatus[]> = {
  pending: ['pending', 'in_progress'],
  in_progress: ['in_progress', 'verified', 'discarded'],
  verified: ['verified'],
  discarded: ['discarded'],
};

export function isValidActionItemTransition(
  current: ActionItemStatus,
  next: ActionItemStatus
) {
  return ACTION_ITEM_TRANSITIONS[current].includes(next);
}

export function getAllowedActionItemTransitions(current: ActionItemStatus) {
  return [...ACTION_ITEM_TRANSITIONS[current]];
}

export const DEFAULT_DECISION_BRIEF: DecisionBrief = {
  topic: '',
  goal: '',
  background: '',
  constraints: '',
  timeHorizon: '',
  nonNegotiables: '',
  acceptableDownside: '',
  reviewAt: '',
  decisionType: 'general',
  desiredOutput: 'recommendation',
  templateId: null,
};

export const DEFAULT_DISCUSSION_AGENDA: DiscussionAgenda = {
  focalQuestions: '',
  requiredDimensions: '',
  requireResearch: true,
  requestRecommendation: true,
};

export const DECISION_STATUS_OPTIONS: DecisionStatus[] = [
  'draft',
  'completed',
  'adopted',
  'discarded',
  'needs_follow_up',
  'degraded',
];

export const ACTION_ITEM_STATUS_OPTIONS: ActionItemStatus[] = [
  'pending',
  'in_progress',
  'verified',
  'discarded',
];

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  pending: '待执行',
  in_progress: '执行中',
  verified: '已验证',
  discarded: '已废弃',
};

export const DECISION_CONTROL_LABELS: Record<DecisionControlType, string> = {
  general: '补充问题',
  add_constraint: '新增约束',
  ask_comparison: '要求比较',
  force_converge: '要求收敛',
  continue_debate: '继续辩论',
};

export function normalizeDecisionBrief(
  value?: Partial<DecisionBrief> & { topic?: string }
): DecisionBrief {
  return {
    topic: value?.topic?.trim() ?? '',
    goal: value?.goal?.trim() ?? '',
    background: value?.background?.trim() ?? '',
    constraints: value?.constraints?.trim() ?? '',
    timeHorizon: value?.timeHorizon?.trim() ?? '',
    nonNegotiables: value?.nonNegotiables?.trim() ?? '',
    acceptableDownside: value?.acceptableDownside?.trim() ?? '',
    reviewAt: value?.reviewAt?.trim() ?? '',
    decisionType: normalizeDecisionType(value?.decisionType),
    desiredOutput: normalizeDesiredOutput(value?.desiredOutput),
    templateId: value?.templateId?.trim() || null,
  };
}

export function normalizeDiscussionAgenda(
  value?: Partial<DiscussionAgenda>
): DiscussionAgenda {
  return {
    focalQuestions: value?.focalQuestions?.trim() ?? '',
    requiredDimensions: value?.requiredDimensions?.trim() ?? '',
    requireResearch: value?.requireResearch ?? true,
    requestRecommendation: value?.requestRecommendation ?? true,
  };
}

export function normalizeDecisionStatus(
  value?: string | null
): DecisionStatus {
  return DECISION_STATUS_OPTIONS.includes(value as DecisionStatus)
    ? (value as DecisionStatus)
    : 'draft';
}

export function normalizeActionItemStatus(
  value?: string | null
): ActionItemStatus {
  return ACTION_ITEM_STATUS_OPTIONS.includes(value as ActionItemStatus)
    ? (value as ActionItemStatus)
    : 'pending';
}

export function formatControlInstruction(
  controlType: DecisionControlType,
  content: string
) {
  switch (controlType) {
    case 'add_constraint':
      return `新增约束：${content}`;
    case 'ask_comparison':
      return `请重点比较：${content}`;
    case 'force_converge':
      return `请主持人优先收敛并给出建议：${content}`;
    case 'continue_debate':
      return `请继续围绕该分歧深入辩论：${content}`;
    case 'general':
    default:
      return `补充问题：${content}`;
  }
}

export function parseDecisionSummary(
  content: string,
  fallbackSummary?: string,
  researchSources: ResearchSource[] = [],
  brief?: DecisionBrief
): DecisionSummary {
  try {
    let jsonStr = content;
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      jsonStr = fenced[1];
    }

    const brace = jsonStr.match(/\{[\s\S]*\}/);
    if (brace) {
      jsonStr = brace[0];
    }

    const parsed = JSON.parse(jsonStr) as Partial<DecisionSummary>;
    const evidence = normalizeEvidence(parsed.evidence, researchSources);
    const confidenceMeta = buildDecisionConfidenceMeta(
      parsed.rawConfidence ?? parsed.confidence,
      evidence,
      researchSources
    );
    const decisionSummary = ensureDecisionDossierMinimums(
      {
      summary: parsed.summary?.trim() || fallbackSummary || '未能生成结构化总结。',
      recommendedOption: parsed.recommendedOption?.trim() || '暂无明确建议',
      why: normalizeStringArray(parsed.why),
      risks: normalizeStringArray(parsed.risks),
      openQuestions: normalizeStringArray(parsed.openQuestions),
      nextActions: normalizeStringArray(parsed.nextActions),
      alternativesRejected: normalizeStringArray(parsed.alternativesRejected),
      redLines: normalizeStringArray(parsed.redLines),
      revisitTriggers: normalizeStringArray(parsed.revisitTriggers),
      evidence,
      rawConfidence: confidenceMeta.rawConfidence,
      confidence: confidenceMeta.adjustedConfidence,
    },
      brief
    );
    const validationResult = validateDecisionSummary(decisionSummary, brief ?? {
      topic: '', goal: '', background: '', constraints: '',
      timeHorizon: '', nonNegotiables: '', acceptableDownside: '',
      reviewAt: '', decisionType: 'general', desiredOutput: 'recommendation',
    }, 0);
    decisionSummary.trustViolations = validationResult.violations;
    return decisionSummary;
  } catch {
    const decisionSummary = ensureDecisionDossierMinimums(
      {
      summary: fallbackSummary || content.slice(0, 500) || '未能生成结构化总结。',
      recommendedOption: '暂无明确建议',
      why: [],
      risks: [],
      openQuestions: [],
      nextActions: [],
      alternativesRejected: [],
      redLines: [],
      revisitTriggers: [],
      rawConfidence: 40,
      confidence: 40,
      evidence: [],
    },
      brief
    );
    const validationResult = validateDecisionSummary(decisionSummary, brief ?? {
      topic: '', goal: '', background: '', constraints: '',
      timeHorizon: '', nonNegotiables: '', acceptableDownside: '',
      reviewAt: '', decisionType: 'general', desiredOutput: 'recommendation',
    }, 0);
    decisionSummary.trustViolations = validationResult.violations;
    return decisionSummary;
  }
}

export function normalizePersistedDecisionSummary(
  value: DecisionSummary,
  researchSources: ResearchSource[] = [],
  brief?: DecisionBrief
): DecisionSummary {
  const evidence = normalizeEvidence(value.evidence, researchSources);
  const confidenceMeta = buildDecisionConfidenceMeta(
    value.rawConfidence ?? value.confidence,
    evidence,
    researchSources
  );
  return ensureDecisionDossierMinimums({
    ...value,
    summary: value.summary?.trim() || '未能生成结构化总结。',
    recommendedOption: value.recommendedOption?.trim() || '暂无明确建议',
    why: normalizeStringArray(value.why),
    risks: normalizeStringArray(value.risks),
    openQuestions: normalizeStringArray(value.openQuestions),
    nextActions: normalizeStringArray(value.nextActions),
    alternativesRejected: normalizeStringArray(value.alternativesRejected),
    redLines: normalizeStringArray(value.redLines),
    revisitTriggers: normalizeStringArray(value.revisitTriggers),
    evidence,
    rawConfidence: confidenceMeta.rawConfidence,
    confidence: confidenceMeta.adjustedConfidence,
    // Preserve persisted frozen values so they are not discarded during normalization
    adjustedConfidence: value.adjustedConfidence,
    confidenceFrozenAt: value.confidenceFrozenAt,
  }, brief);
}

function ensureDecisionDossierMinimums(
  value: DecisionSummary,
  brief?: DecisionBrief
): DecisionSummary {
  const fallbackNextActions =
    value.nextActions.length > 0
      ? value.nextActions
      : [
          brief?.reviewAt
            ? `在 ${brief.reviewAt} 前复核关键假设、行动项 owner 与执行进度`
            : '确认执行 owner、验证方式与最近一次检查时间',
        ];
  const fallbackRedLines =
    value.redLines.length > 0
      ? value.redLines
      : [
          brief?.nonNegotiables
            ? `若无法满足这些不可妥协项，则停止推进：${brief.nonNegotiables}`
            : brief?.acceptableDownside
              ? `若下行超过可接受范围，则停止推进：${brief.acceptableDownside}`
              : '一旦关键假设失真或执行成本超出可承受范围，应暂停推进。',
        ];
  const fallbackRevisitTriggers =
    value.revisitTriggers.length > 0
      ? value.revisitTriggers
      : [
          brief?.reviewAt
            ? `在 ${brief.reviewAt} 进行固定复盘，检查结果与前提是否仍成立`
            : '出现新证据、关键风险变化或执行偏差时重新讨论。',
        ];
  const fallbackAlternativesRejected =
    value.alternativesRejected.length > 0
      ? value.alternativesRejected
      : ['其他备选方案暂缺足够证据或当前约束下性价比更低，因此不优先推进。'];

  return {
    ...value,
    nextActions: fallbackNextActions,
    redLines: fallbackRedLines,
    revisitTriggers: fallbackRevisitTriggers,
    alternativesRejected: fallbackAlternativesRejected,
  };
}

export function classifyEvidenceStatus(
  evidence: DecisionSummaryEvidence
): 'evidence_backed' | 'extracted' | 'captured' | 'inferred' | 'ungrounded' {
  // Use explicit verificationStatus if present
  if (evidence.verificationStatus) return evidence.verificationStatus;
  if (evidence.sourceIds.length > 0) return 'extracted';
  const reason = evidence.gapReason?.toLowerCase() ?? '';
  if (/待验证|验证|核验|确认|check|verify|unknown|missing|unclear/.test(reason)) {
    return 'inferred';
  }
  return 'ungrounded';
}

function normalizeDecisionType(value?: string): DecisionType {
  const allowed: DecisionType[] = [
    'general',
    'investment',
    'product',
    'career',
    'life',
    'risk',
  ];
  return allowed.includes(value as DecisionType)
    ? (value as DecisionType)
    : 'general';
}

function normalizeDesiredOutput(value?: string): DesiredOutput {
  const allowed: DesiredOutput[] = [
    'recommendation',
    'comparison',
    'risk_assessment',
    'action_plan',
    'consensus',
  ];
  return allowed.includes(value as DesiredOutput)
    ? (value as DesiredOutput)
    : 'recommendation';
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];
}

function normalizeConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeEvidence(value: unknown, researchSources: ResearchSource[]) {
  if (!Array.isArray(value)) return [];

  const evidence = value.map((item) => normalizeEvidenceItem(item, researchSources));
  return evidence.filter((item) => item.claim.trim().length > 0);
}

function normalizeGapReason(record: Record<string, unknown>) {
  if (typeof record.gapReason !== 'string') return '';
  return record.gapReason.trim();
}

function normalizeEvidenceItem(
  item: unknown,
  researchSources: ResearchSource[]
): DecisionSummaryEvidence {
  const record =
    item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const directSourceIds = normalizeStringArray(record.sourceIds)
    .map((sourceId) => findResearchSourceByCitation(sourceId, researchSources))
    .filter((source): source is ResearchSource => Boolean(source))
    .map((source) => getResearchSourceCitationLabel(source));
  const legacySourceIndices = Array.isArray(record.sourceIndices)
    ? record.sourceIndices
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0)
    : [];
  const mappedSourceIds = legacySourceIndices
    .map((index) =>
      researchSources[index] ? getResearchSourceCitationLabel(researchSources[index]) : null
    )
    .filter((sourceId): sourceId is string => Boolean(sourceId));
  const unresolvedSourceIndices = legacySourceIndices.filter(
    (index) => !researchSources[index]?.id
  );
  const sourceIds = Array.from(new Set([...directSourceIds, ...mappedSourceIds]));
  const gapReason = normalizeGapReason(record);

  return {
    claim:
      (typeof record.claim === 'string' ? record.claim : '').trim() ||
      '未命名证据',
    sourceIds,
    ...(sourceIds.length === 0
      ? { gapReason: gapReason || '缺少可解析证据来源' }
      : gapReason
        ? { gapReason }
        : {}),
    ...(unresolvedSourceIndices.length > 0
      ? { unresolvedSourceIndices }
      : {}),
  };
}

export function buildDecisionConfidenceMeta(
  value: unknown,
  evidence: DecisionSummaryEvidence[],
  researchSources: ResearchSource[]
) : DecisionConfidenceMeta {
  const rawConfidence = normalizeConfidence(value);
  let adjustedConfidence = rawConfidence;
  if (evidence.length === 0) {
    return {
      rawConfidence,
      adjustedConfidence,
      totalPenalty: 0,
      adjustments: [],
      evidenceBackedClaims: 0,
      unsupportedClaims: 0,
      citedSources: 0,
      citedDomains: 0,
      staleSources: 0,
    };
  }

  const unsupportedClaims = evidence.filter((item) => item.sourceIds.length === 0).length;
  const citedSources = evidence
    .flatMap((item) =>
      item.sourceIds
        .map((sourceId) => findResearchSourceByCitation(sourceId, researchSources))
        .filter((source): source is ResearchSource => Boolean(source))
    );
  const uniqueCitedSources = new Map(citedSources.map((source) => [source.id, source]));
  const uniqueDomains = new Set(citedSources.map((source) => source.domain).filter(Boolean));
  const staleCount = citedSources.filter((source) => source.stale).length;
  const adjustments = [];

  if (unsupportedClaims > 0) {
    const delta = Math.min(unsupportedClaims * 8, 24);
    adjustedConfidence -= delta;
    adjustments.push({
      kind: 'unsupported_claims' as const,
      label: 'Unsupported claims',
      reason: `${unsupportedClaims} claim(s) have no persisted citation mapping.`,
      delta,
    });
  }

  if (citedSources.length > 0 && staleCount / citedSources.length >= 0.5) {
    adjustedConfidence -= 10;
    adjustments.push({
      kind: 'stale_sources' as const,
      label: 'Stale sources',
      reason: 'At least half of the cited sources are marked stale for this decision type.',
      delta: 10,
    });
  }
  if (citedSources.length >= 2 && uniqueDomains.size <= 1) {
    adjustedConfidence -= 6;
    adjustments.push({
      kind: 'single_domain_sources' as const,
      label: 'Low source diversity',
      reason: 'Multiple citations collapse to a single domain, so source diversity is weak.',
      delta: 6,
    });
  }

  const normalizedAdjusted = normalizeConfidence(adjustedConfidence);
  return {
    rawConfidence,
    adjustedConfidence: normalizedAdjusted,
    totalPenalty: Math.max(0, rawConfidence - normalizedAdjusted),
    adjustments,
    evidenceBackedClaims: Math.max(0, evidence.length - unsupportedClaims),
    unsupportedClaims,
    citedSources: uniqueCitedSources.size,
    citedDomains: uniqueDomains.size,
    staleSources: staleCount,
  };
}
