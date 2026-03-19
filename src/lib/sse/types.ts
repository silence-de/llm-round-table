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
  /** T5-1: monotonically increasing per-session event ID for catch-up replay */
  eventId?: number;
  /** T5-3: marks events replayed during reconnect catch-up */
  replayed?: boolean;
}

export function encodeSSE(event: SSEEvent): string {
  // Emit SSE `id:` field when eventId is present — enables browser Last-Event-ID
  const idLine = event.eventId != null ? `id: ${event.eventId}\n` : '';
  return `${idLine}data: ${JSON.stringify(event)}\n\n`;
}

