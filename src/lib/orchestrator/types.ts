import type { SessionAgent } from '../agents/types';
import type {
  DecisionBrief,
  DecisionControlType,
  DecisionSummary,
  DiscussionAgenda,
} from '../decision/types';
import type {
  ResearchConfig,
  ResearchRunDetail,
  ResearchSource,
} from '../search/types';

export enum DiscussionPhase {
  CREATED = 'created',
  RESEARCH = 'research',
  OPENING = 'opening',
  INITIAL_RESPONSES = 'initial_responses',
  ANALYSIS = 'analysis',
  DEBATE = 'debate',
  CONVERGENCE = 'convergence',
  SUMMARY = 'summary',
  COMPLETED = 'completed',
}

export interface DiscussionConfig {
  sessionId: string;
  topic: string;
  brief: DecisionBrief;
  agenda: DiscussionAgenda;
  researchConfig: ResearchConfig;
  agents: SessionAgent[];
  moderatorAgentId: string;
  maxDebateRounds: number;
  parentContext?: string;
  resumeState?: DiscussionResumeState;
  resumeSnapshot?: DiscussionResumeSnapshot;
  drainInterjections?: (
    context: { phase: string; round?: number }
  ) => Promise<UserInterjection[]> | UserInterjection[];
  shouldStop?: () => Promise<boolean> | boolean;
  onMessagePersist?: (
    message: PersistableMessage
  ) => Promise<void> | void;
  onSummaryPersist?: (summary: string) => Promise<void> | void;
  onDecisionSummaryPersist?: (
    summary: DecisionSummary
  ) => Promise<void> | void;
  onResearchRunPersist?: (
    researchRun: Omit<ResearchRunDetail, 'sources'>
  ) => Promise<void> | void;
  onResearchSourcesPersist?: (
    researchRunId: string,
    sources: ResearchSource[]
  ) => Promise<void> | void;
  onUsagePersist?: (
    usage: { inputTokens?: number; outputTokens?: number }
  ) => Promise<void> | void;
  onSessionEventPersist?: (
    event: DiscussionSessionEvent
  ) => Promise<void> | void;
}

export interface AgentResponse {
  agentId: string;
  displayName: string;
  content: string;
}

export interface ModeratorAnalysis {
  agreements: Array<{
    point: string;
    supporters: string[];
  }>;
  disagreements: Array<{
    point: string;
    positions: Record<string, string>;
    followUpQuestion: string;
  }>;
  shouldConverge: boolean;
  moderatorNarrative: string;
}

export interface UserInterjection {
  id: string;
  content: string;
  createdAt: number;
  controlType: DecisionControlType;
  phaseHint?: string;
  roundHint?: number;
}

export interface PersistableMessage {
  role: 'agent' | 'moderator' | 'user' | 'system';
  agentId?: string;
  displayName?: string;
  phase: string;
  round?: number;
  content: string;
}

export interface DiscussionResumeState {
  sourceSessionId: string;
  nextPhase:
    | DiscussionPhase.OPENING
    | DiscussionPhase.INITIAL_RESPONSES
    | DiscussionPhase.ANALYSIS
    | DiscussionPhase.SUMMARY;
  nextRound: number;
  allMessages: Array<{
    agentId: string;
    displayName: string;
    content: string;
    phase: string;
  }>;
  agentResponses: AgentResponse[];
  researchBrief?: string | null;
  researchSources: ResearchSource[];
  researchHandled: boolean;
  parentContextAddendum?: string;
}

export interface DiscussionResumeSnapshot {
  sourceSessionId: string;
  nextPhase:
    | DiscussionPhase.OPENING
    | DiscussionPhase.INITIAL_RESPONSES
    | DiscussionPhase.ANALYSIS
    | DiscussionPhase.SUMMARY;
  nextRound: number;
  inherited: string[];
  discarded: string[];
  reason: string;
}

export interface DiscussionSessionEvent {
  type:
    | 'timeout'
    | 'agent_degraded'
    | 'action_updated'
    | 'follow_up_inherited'
    | 'resume_preview'
    | 'resume_started'
    | 'browser_verification'
    | 'provider_error';
  provider?: string;
  modelId?: string;
  phase?: string;
  agentId?: string;
  timeoutType?: 'startup' | 'idle' | 'request';
  message?: string;
  metadata?: Record<string, unknown>;
}
