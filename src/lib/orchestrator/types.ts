import type { SessionAgent } from '../agents/types';

export enum DiscussionPhase {
  CREATED = 'created',
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
  agents: SessionAgent[];
  moderatorAgentId: string;
  maxDebateRounds: number;
  drainInterjections?: () => Promise<UserInterjection[]> | UserInterjection[];
  onMessagePersist?: (
    message: PersistableMessage
  ) => Promise<void> | void;
  onSummaryPersist?: (summary: string) => Promise<void> | void;
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
