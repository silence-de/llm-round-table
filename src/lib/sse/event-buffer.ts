/**
 * T5-1: SSE event buffer — in-process ring buffer for catch-up on reconnect.
 *
 * Stores the last N events per session. On reconnect the client sends
 * ?lastEventId=N and the server replays missed events before switching
 * to live stream mode.
 *
 * Design: process-local Map (no Redis dependency in phase 1).
 * TTL: 30 minutes. Ring size: 200 events per session.
 */

import type { SSEEvent } from './types';

export interface BufferedSSEEvent {
  eventId: number;
  event: SSEEvent;
  bufferedAt: number;
}

interface SessionBuffer {
  events: BufferedSSEEvent[];
  nextEventId: number;
  lastAccessAt: number;
}

const RING_SIZE = 200;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

const buffers = new Map<string, SessionBuffer>();

// Periodic cleanup of expired buffers (runs every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, buf] of buffers) {
      if (now - buf.lastAccessAt > TTL_MS) {
        buffers.delete(sessionId);
      }
    }
  }, 5 * 60 * 1000);
}

function getOrCreateBuffer(sessionId: string): SessionBuffer {
  let buf = buffers.get(sessionId);
  if (!buf) {
    buf = { events: [], nextEventId: 1, lastAccessAt: Date.now() };
    buffers.set(sessionId, buf);
  }
  buf.lastAccessAt = Date.now();
  return buf;
}

/**
 * Push an event into the session buffer and return its assigned eventId.
 */
export function pushToBuffer(sessionId: string, event: SSEEvent): number {
  const buf = getOrCreateBuffer(sessionId);
  const eventId = buf.nextEventId++;
  buf.events.push({ eventId, event, bufferedAt: Date.now() });
  // Trim to ring size
  if (buf.events.length > RING_SIZE) {
    buf.events.splice(0, buf.events.length - RING_SIZE);
  }
  return eventId;
}

/**
 * Return all buffered events with eventId > lastEventId.
 * Returns empty array if session buffer not found or lastEventId is current.
 */
export function getEventsSince(
  sessionId: string,
  lastEventId: number
): BufferedSSEEvent[] {
  const buf = buffers.get(sessionId);
  if (!buf) return [];
  buf.lastAccessAt = Date.now();
  return buf.events.filter((e) => e.eventId > lastEventId);
}

/**
 * Get the current nextEventId for a session (useful for initial connection).
 */
export function getCurrentEventId(sessionId: string): number {
  return buffers.get(sessionId)?.nextEventId ?? 1;
}
