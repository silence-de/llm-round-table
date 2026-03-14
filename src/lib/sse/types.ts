export type SSEEventType =
  | 'heartbeat'
  | 'phase_change'
  | 'agent_start'
  | 'agent_token'
  | 'agent_done'
  | 'agent_error'
  | 'agent_degraded'
  | 'moderator_start'
  | 'moderator_token'
  | 'moderator_done'
  | 'user_interjection'
  | 'discussion_complete'
  | 'resume_snapshot'
  | 'research_start'
  | 'research_result'
  | 'research_complete'
  | 'research_failed'
  | 'system_note';

export interface SSEEvent {
  type: SSEEventType;
  agentId?: string;
  phase?: string;
  content?: string;
  round?: number;
  meta?: Record<string, unknown>;
  timestamp: number;
}

export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
