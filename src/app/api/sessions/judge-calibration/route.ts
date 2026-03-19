import { NextResponse } from 'next/server';
import { listJudgeEvaluationsForCalibration } from '@/lib/db/repository';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId') ?? undefined;
  const rows = await listJudgeEvaluationsForCalibration(sessionId);
  // Only return REWRITE/ESCALATE cases for human review
  const forReview = rows.filter((r) => r.gate === 'REWRITE' || r.gate === 'ESCALATE');
  return NextResponse.json({ items: forReview, total: forReview.length });
}
