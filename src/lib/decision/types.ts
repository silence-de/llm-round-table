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

export interface DecisionSummaryEvidence {
  claim: string;
  sourceIds: string[];
  gapReason?: string;
  unresolvedSourceIndices?: number[];
}

export interface DecisionSummary {
  summary: string;
  recommendedOption: string;
  why: string[];
  risks: string[];
  openQuestions: string[];
  nextActions: string[];
  confidence: number;
  evidence: DecisionSummaryEvidence[];
}

export interface ActionItem {
  id: string;
  sourceActionId?: string | null;
  content: string;
  status: ActionItemStatus;
  source: 'generated' | 'carried_forward';
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
  decisionType: DecisionType;
  desiredOutput: DesiredOutput;
  goal: string;
  background: string;
  constraints: string;
  focalQuestions: string;
  requiredDimensions: string;
}
