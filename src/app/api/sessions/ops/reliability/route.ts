/**
 * T5-5: Phase reliability metrics endpoint.
 *
 * GET /api/sessions/ops/reliability
 *
 * Returns aggregated phase reliability stats from session_events table.
 * Reads phase_started / phase_completed / phase_failed events.
 */
import { NextResponse } from 'next/server';
import { getPhaseReliabilityMetrics } from '@/lib/db/repository';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const windowRaw = url.searchParams.get('window') ?? '7d';
  const window =
    windowRaw === '1d' || windowRaw === '7d' || windowRaw === '30d'
      ? windowRaw
      : '7d';

  const metrics = await getPhaseReliabilityMetrics(window);
  return NextResponse.json(metrics);
}
