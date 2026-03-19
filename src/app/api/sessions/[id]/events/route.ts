/**
 * T5-3: SSE catch-up replay endpoint.
 *
 * GET /api/sessions/[id]/events?lastEventId=N
 *
 * Returns buffered events with eventId > N as a JSON array.
 * Client uses this after reconnect to catch up on missed events,
 * then resumes the live stream.
 *
 * Note: browser EventSource sends Last-Event-ID header automatically,
 * but fetch-based clients use the query param.
 */
import { NextResponse } from 'next/server';
import { getEventsSince } from '@/lib/sse/event-buffer';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);

  // Support both query param (fetch clients) and Last-Event-ID header (EventSource)
  const lastEventIdRaw =
    url.searchParams.get('lastEventId') ??
    req.headers.get('Last-Event-ID') ??
    '0';
  const lastEventId = Math.max(0, parseInt(lastEventIdRaw, 10) || 0);

  const missed = getEventsSince(id, lastEventId);
  const events = missed.map((b) => ({ ...b.event, eventId: b.eventId, replayed: true }));

  return NextResponse.json({ events, count: events.length });
}
