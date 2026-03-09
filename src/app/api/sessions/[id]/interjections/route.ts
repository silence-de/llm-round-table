import { NextResponse } from 'next/server';
import { appendMessage } from '@/lib/db/repository';
import { enqueueInterjection } from '@/lib/orchestrator/interjection-queue';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    content?: string;
    phase?: string;
    round?: number;
  };

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  const interjection = enqueueInterjection(id, {
    content,
    phaseHint: body.phase,
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

  return NextResponse.json({ ok: true, interjectionId: interjection.id });
}
