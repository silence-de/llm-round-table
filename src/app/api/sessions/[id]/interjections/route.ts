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
    phase?: string;
    round?: number;
  };

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  const status = await getSessionStatus(id);
  if (!status) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  if (status !== 'running') {
    return NextResponse.json(
      { error: `session is not running (current: ${status})` },
      { status: 409 }
    );
  }

  const interjection = enqueueInterjection({
    sessionId: id,
    content,
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
  return NextResponse.json({ ok: true, interjectionId });
}
