import type {
  ActionItemStatus,
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
  researchSources: ResearchSource[] = []
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
    return {
      summary: parsed.summary?.trim() || fallbackSummary || '未能生成结构化总结。',
      recommendedOption: parsed.recommendedOption?.trim() || '暂无明确建议',
      why: normalizeStringArray(parsed.why),
      risks: normalizeStringArray(parsed.risks),
      openQuestions: normalizeStringArray(parsed.openQuestions),
      nextActions: normalizeStringArray(parsed.nextActions),
      confidence: normalizeConfidence(parsed.confidence),
      evidence: normalizeEvidence(parsed.evidence, researchSources),
    };
  } catch {
    return {
      summary: fallbackSummary || content.slice(0, 500) || '未能生成结构化总结。',
      recommendedOption: '暂无明确建议',
      why: [],
      risks: [],
      openQuestions: [],
      nextActions: [],
      confidence: 40,
      evidence: [],
    };
  }
}

export function normalizePersistedDecisionSummary(
  value: DecisionSummary,
  researchSources: ResearchSource[] = []
): DecisionSummary {
  return {
    ...value,
    summary: value.summary?.trim() || '未能生成结构化总结。',
    recommendedOption: value.recommendedOption?.trim() || '暂无明确建议',
    why: normalizeStringArray(value.why),
    risks: normalizeStringArray(value.risks),
    openQuestions: normalizeStringArray(value.openQuestions),
    nextActions: normalizeStringArray(value.nextActions),
    confidence: normalizeConfidence(value.confidence),
    evidence: normalizeEvidence(value.evidence, researchSources),
  };
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

function resolveEvidenceSourceSet(researchSources: ResearchSource[]) {
  const activeSourceIds = new Set(
    researchSources
      .filter((source) => source.selected && !source.excludedReason?.trim())
      .map((source) => source.id)
  );
  if (activeSourceIds.size > 0) {
    return activeSourceIds;
  }
  return new Set(researchSources.map((source) => source.id));
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
  const sourceIdSet = resolveEvidenceSourceSet(researchSources);
  const directSourceIds = normalizeStringArray(record.sourceIds).filter(
    (sourceId) => sourceIdSet.size === 0 || sourceIdSet.has(sourceId)
  );
  const legacySourceIndices = Array.isArray(record.sourceIndices)
    ? record.sourceIndices
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0)
    : [];
  const mappedSourceIds = legacySourceIndices
    .map((index) => researchSources[index]?.id)
    .filter(
      (sourceId): sourceId is string =>
        Boolean(sourceId) && (sourceIdSet.size === 0 || sourceIdSet.has(sourceId))
    );
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
