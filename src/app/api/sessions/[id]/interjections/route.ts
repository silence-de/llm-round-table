import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import {
  appendMessage,
  enqueueInterjection,
  getSessionStatus,
} from '@/lib/db/repository';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    content?: string;
    controlType?:
      | 'general'
      | 'add_constraint'
      | 'ask_comparison'
      | 'force_converge'
      | 'continue_debate';
    phase?: string;
    round?: number;
  };

  const content = body.content?.trim();
  if (!content) {
    return apiError(400, 'INVALID_INPUT', 'content required');
  }

  const status = await getSessionStatus(id);
  if (!status) {
    return apiError(404, 'NOT_FOUND', 'session not found');
  }

  if (status !== 'running') {
    return apiError(
      409,
      'CONFLICT',
      `session is not running (current: ${status})`,
      { status }
    );
  }

  const interjection = enqueueInterjection({
    sessionId: id,
    content,
    controlType: body.controlType,
    phaseHint: body.phase ?? undefined,
    roundHint: body.round,
  });

  await appendMessage({
    sessionId: id,
    role: 'user',
    phase: body.phase ?? 'interjection',
    round: body.round,
    content,
    displayName: 'User',
  });

  const interjectionId = await interjection;
  return NextResponse.json({
    ok: true,
    interjectionId,
    controlType: body.controlType ?? 'general',
  });
}
