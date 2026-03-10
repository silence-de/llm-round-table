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
