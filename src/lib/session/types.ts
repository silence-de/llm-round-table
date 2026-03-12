import type {
  ActionItem,
  ActionStats,
  DecisionClaim,
  DecisionConfidenceMeta,
  DecisionControlType,
  DecisionStatus,
  DecisionSummary,
} from '@/lib/decision/types';
import type { PersonaPreset, PersonaSelection } from '@/lib/agents/types';
import type { DiscussionResumeSnapshot } from '@/lib/orchestrator/types';
import type { ResearchRunDetail } from '@/lib/search/types';

export interface AgentInfo {
  id: string;
  displayName: string;
  provider: string;
  modelId: string;
  color: string;
  sprite: string;
  accentGlow?: string;
  recommendedPersonaPresetIds?: string[];
  available: boolean;
  missingKey: string | null;
  availableModels: Array<{ id: string; label: string }>;
}

export interface SessionRecord {
  id: string;
  topic: string;
  status: string;
  goal: string;
  background: string;
  constraints: string;
  timeHorizon: string;
  nonNegotiables: string;
  acceptableDownside: string;
  reviewAt?: string | null;
  retrospectiveNote?: string;
  outcomeSummary?: string;
  actualOutcome?: string;
  outcomeConfidence?: number;
  decisionType: string;
  desiredOutput: string;
  templateId?: string | null;
  agendaConfig?: string;
  researchConfig?: string;
  parentSessionId?: string | null;
  decisionStatus: DecisionStatus;
  createdAt: number | string;
  moderatorAgentId: string;
  maxDebateRounds: number;
  selectedAgentIds?: string;
  modelSelections?: string;
  personaSelections?: string;
  usageInputTokens: number;
  usageOutputTokens: number;
}

export interface SessionVerificationMeta {
  capturedSources: number;
  extractedSources: number;
  manualReviewRequiredSources: number;
  semantics: Array<'captured' | 'extracted' | 'manual_review'>;
}

export interface SessionDetail {
  session: SessionRecord;
  messages: Array<{
    id: string;
    role: string;
    phase: string;
    content: string;
    displayName?: string | null;
    agentId?: string | null;
    createdAt: number | string;
  }>;
  minutes: { content: string } | null;
  decisionSummary: DecisionSummary | null;
  confidenceMeta?: DecisionConfidenceMeta | null;
  verificationMeta?: SessionVerificationMeta | null;
  actionItems: ActionItem[];
  actionStats?: ActionStats;
  researchRun: ResearchRunDetail | null;
  interjections: Array<{
    id: string;
    content: string;
    controlType?: DecisionControlType;
    phaseHint?: string | null;
    roundHint?: number | null;
    createdAt: number | string;
  }>;
  decisionClaims: DecisionClaim[];
  unresolvedEvidence?: Array<{
    claim: string;
    sourceIds: string[];
    unresolvedSourceIndices: number[];
    gapReason: string;
  }>;
  calibrationContext: {
    reviewedSessions: number;
    averageOverconfidence: number;
    templateHitRate: number;
    penalty: number;
    basedOn: 'template' | 'decisionType';
  };
  resumeMeta:
    | {
        resumedFromSessionId?: string | null;
        snapshot?: DiscussionResumeSnapshot | null;
        events?: Array<{
          id: string;
          type: string;
          message: string;
          createdAt: number | string;
        }>;
      }
    | null;
  degradeEvents: Array<{
    id: string;
    type: string;
    provider?: string;
    modelId?: string;
    phase?: string;
    agentId?: string;
    timeoutType?: string;
    message: string;
    createdAt: number | string;
  }>;
  parentSession:
    | {
        id: string;
        topic: string;
        templateId?: string | null;
        decisionType: string;
        decisionStatus: DecisionStatus;
        createdAt: number | string;
      }
    | null;
  parentReviewComparison:
    | {
        sessionId: string;
        topic: string;
        recommendedOption: string;
        predictedConfidence: number;
        outcomeSummary?: string;
        actualOutcome?: string;
        outcomeConfidence?: number;
        retrospectiveNote?: string;
      }
    | null;
  childSessions: Array<{
    id: string;
    topic: string;
    templateId?: string | null;
    decisionType: string;
    decisionStatus: DecisionStatus;
    createdAt: number | string;
  }>;
}

export interface OpsSummary {
  sessionsAnalyzed: number;
  metrics: {
    timeoutRate: number;
    resumeSuccessRate: number;
    agentDegradedRate: number;
    unresolvedEvidenceRate: number;
  };
  researchBudget: {
    reruns: number;
    recentQueries: number;
    providerErrors: number;
  };
  recentFailures: Array<{
    sessionId: string;
    status: string;
    createdAt?: number | string;
  }>;
  degradedAgentSessions: Array<{
    sessionId: string;
    status?: string;
    createdAt?: number | string;
    degradedEventCount?: number;
  }>;
  unresolvedEvidenceSessions: Array<{
    sessionId: string;
    unresolvedEvidenceCount: number;
    createdAt?: number | string;
  }>;
  calibration: {
    reviewedSessions: number;
    averagePredictedConfidence: number;
    averageOutcomeConfidence: number;
    averageOverconfidence: number;
    averageCalibrationGap: number;
    sourcedVsUnsourcedOutcomeGap: {
      sourcedAverage: number;
      unsourcedAverage: number;
      delta: number;
    };
    templateHitRates: Array<{
      templateId: string;
      reviewedSessions: number;
      hitRate: number;
    }>;
    agentModelOverconfidence: Array<{
      agentId: string;
      modelId: string;
      reviewedSessions: number;
      averageDelta: number;
      averageOutcomeConfidence: number;
    }>;
    overconfidenceTrend: Array<{
      sessionId: string;
      createdAt?: number | string;
      predictedConfidence: number;
      outcomeConfidence: number;
      delta: number;
    }>;
  };
}

export interface CalibrationDashboardData {
  window: '30d' | '90d' | '180d' | 'all';
  reviewedSessions: number;
  averagePredictedConfidence: number;
  averageOutcomeConfidence: number;
  averageOverconfidence: number;
  averageCalibrationGap: number;
  sampleLabel: 'insufficient' | 'emerging' | 'directional' | 'stable';
  sampleNote: string;
  minimumReliableSample: number;
  byTemplate: Array<{
    templateId: string;
    reviewedSessions: number;
    averagePredictedConfidence: number;
    averageOutcomeConfidence: number;
    averageOverconfidence: number;
    hitRate: number;
  }>;
  byDecisionType: Array<{
    decisionType: string;
    reviewedSessions: number;
    averagePredictedConfidence: number;
    averageOutcomeConfidence: number;
    averageOverconfidence: number;
    hitRate: number;
  }>;
  sourcedVsUnsourced: {
    sourcedSessions: number;
    unsourcedSessions: number;
    sourcedAverage: number;
    unsourcedAverage: number;
    delta: number;
  };
  agentModelDrift: Array<{
    agentId: string;
    modelId: string;
    reviewedSessions: number;
    averageDelta: number;
    averageOutcomeConfidence: number;
  }>;
  timeline: Array<{
    sessionId: string;
    createdAt?: number | string;
    predictedConfidence: number;
    outcomeConfidence: number;
    delta: number;
    templateId: string;
    decisionType: string;
  }>;
  confidencePenaltyGuidance: string[];
  mostReliableTemplate: string;
  largestBlindSpot: string;
}

export interface WorkspaceBootstrapPayload {
  agents: AgentInfo[];
  personaPresets: PersonaPreset[];
}

export interface WorkspaceBootstrapState {
  agents: AgentInfo[];
  personaPresets: PersonaPreset[];
  selectedAgents: Set<string>;
  modelSelections: Record<string, string>;
  personaSelections: Record<string, PersonaSelection>;
  moderatorAgentId: string;
  loadingAgents: boolean;
}
