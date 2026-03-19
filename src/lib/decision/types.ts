export type DecisionType =
  | 'general'
  | 'investment'
  | 'product'
  | 'career'
  | 'life'
  | 'risk';

export type DesiredOutput =
  | 'recommendation'
  | 'comparison'
  | 'risk_assessment'
  | 'action_plan'
  | 'consensus';

export type DecisionStatus =
  | 'draft'
  | 'completed'
  | 'adopted'
  | 'discarded'
  | 'needs_follow_up'
  | 'degraded';

export type ActionItemStatus =
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'discarded';

export type DecisionControlType =
  | 'general'
  | 'add_constraint'
  | 'ask_comparison'
  | 'force_converge'
  | 'continue_debate';

export interface DecisionBrief {
  topic: string;
  goal: string;
  background: string;
  constraints: string;
  timeHorizon: string;
  nonNegotiables: string;
  acceptableDownside: string;
  reviewAt: string;
  decisionType: DecisionType;
  desiredOutput: DesiredOutput;
  templateId?: string | null;
}

export interface DiscussionAgenda {
  focalQuestions: string;
  requiredDimensions: string;
  requireResearch: boolean;
  requestRecommendation: boolean;
}

// T4-1: claim classification
export type ClaimType = 'allowed_without_evidence' | 'requires_evidence' | 'gap_only';

// T4-1: verification status — reflects what actually happened, not what we wish
export type VerificationStatus =
  | 'captured'        // page fetched, signals extracted, manual review still required
  | 'extracted'       // claim extracted from source text, not independently verified
  | 'evidence_backed' // claim has ≥1 resolved sourceId
  | 'inferred'        // logical inference from evidence, no direct citation
  | 'ungrounded';     // no source support at all

// T4-3: structured gap reason
export type GapReasonCode =
  | 'search_failed'
  | 'source_inaccessible'
  | 'insufficient_evidence'
  | 'conflicting_sources'
  | 'out_of_scope';

export interface GapReasonEntry {
  topic: string;
  reason: GapReasonCode;
  searchScope?: string;
  accessStatus?: string;
  nextAction?: string;
}

export interface DecisionSummaryEvidence {
  claim: string;
  sourceIds: string[];
  gapReason?: string;
  unresolvedSourceIndices?: number[];
  // T4-1 enrichment fields (optional, populated by runClaimGate)
  claimType?: ClaimType;
  verificationStatus?: VerificationStatus;
}

export interface DecisionConfidenceAdjustment {
  kind: 'unsupported_claims' | 'stale_sources' | 'single_domain_sources';
  label: string;
  reason: string;
  delta: number;
}

export interface DecisionConfidenceMeta {
  rawConfidence: number;
  adjustedConfidence: number;
  totalPenalty: number;
  adjustments: DecisionConfidenceAdjustment[];
  evidenceBackedClaims: number;
  unsupportedClaims: number;
  citedSources: number;
  citedDomains: number;
  staleSources: number;
}

export interface DecisionSummary {
  summary: string;
  recommendedOption: string;
  why: string[];
  risks: string[];
  openQuestions: string[];
  nextActions: string[];
  alternativesRejected: string[];
  redLines: string[];
  revisitTriggers: string[];
  rawConfidence?: number;
  confidence: number;
  evidence: DecisionSummaryEvidence[];
  adjustedConfidence?: number;      // persisted adjusted confidence (after penalty deductions)
  confidenceFrozenAt?: number;      // timestamp when adjustedConfidence was last computed and frozen
  trustViolations?: TrustViolation[];
}

export interface ActionItem {
  id: string;
  sourceActionId?: string | null;
  content: string;
  status: ActionItemStatus;
  source: 'generated' | 'carried_forward' | 'archived_generated';
  carriedFromSessionId?: string | null;
  note: string;
  owner: string;
  dueAt?: number | string | null;
  verifiedAt?: number | string | null;
  verificationNote: string;
  priority: 'low' | 'medium' | 'high';
  sortOrder: number;
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface DecisionClaim {
  id: string;
  sessionId: string;
  claim: string;
  kind: 'evidence';
  sourceIds: string[];
  gapReason?: string;
  createdAt?: number | string;
}

export interface ActionStats {
  total: number;
  pending: number;
  inProgress: number;
  verified: number;
  discarded: number;
  overdue: number;
}

export interface DecisionTemplate {
  id: string;
  label: string;
  description: string;
  family: 'career' | 'life' | 'money';
  decisionType: DecisionType;
  desiredOutput: DesiredOutput;
  verificationProfileId: string;
  evidenceExpectations: string[];
  reviewWindowSuggestion: string;
  defaultRedLines: string[];
  defaultRevisitTriggers: string[];
  goal: string;
  background: string;
  constraints: string;
  focalQuestions: string;
  requiredDimensions: string;
  analysisChecklist: string[];
}

export interface TrustViolation {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface TrustValidationResult {
  valid: boolean;
  violations: TrustViolation[];
  score: number;  // 0-100, 用于内部评估，不对用户展示
}
