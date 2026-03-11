import { apiError } from '@/lib/api/errors';
import { appendSessionEvent, getSessionDetail } from '@/lib/db/repository';
import { buildResumePlan } from '@/lib/orchestrator/resume';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    resumeFromSessionId?: string;
  };
  const sourceSessionId = body.resumeFromSessionId?.trim();
  if (!sourceSessionId) {
    return apiError(400, 'INVALID_INPUT', 'resumeFromSessionId is required');
  }

  const detail = await getSessionDetail(sourceSessionId);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'resume source session not found');
  }
  if (!['failed', 'stopped'].includes(detail.session.status)) {
    return apiError(
      409,
      'CONFLICT',
      'only failed or stopped sessions can be resumed'
    );
  }

  const plan = buildResumePlan(detail);
  await appendSessionEvent(id, {
    type: 'resume_preview',
    message: `resume preview from ${sourceSessionId}`,
    metadata: {
      sourceSessionId,
      nextPhase: plan.snapshot.nextPhase,
      nextRound: plan.snapshot.nextRound,
    },
  });

  return NextResponse.json({ resumeSnapshot: plan.snapshot });
}
