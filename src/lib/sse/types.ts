export type SSEEventType =
  | 'phase_change'
  | 'agent_start'
  | 'agent_token'
  | 'agent_done'
  | 'agent_error'
  | 'moderator_start'
  | 'moderator_token'
  | 'moderator_done'
  | 'user_interjection'
  | 'discussion_complete'
  | 'research_start'
  | 'research_result'
  | 'research_complete'
  | 'research_failed';

export interface SSEEvent {
  type: SSEEventType;
  agentId?: string;
  phase?: string;
  content?: string;
  round?: number;
  timestamp: number;
}

export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
