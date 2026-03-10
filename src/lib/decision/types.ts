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
  | 'needs_follow_up';

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
