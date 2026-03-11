import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import { getSessionStatus, requestSessionStop } from '@/lib/db/repository';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const status = await getSessionStatus(id);
  if (!status) {
    return apiError(404, 'NOT_FOUND', 'session not found');
  }
  if (status !== 'running') {
    return NextResponse.json(
      { ok: true, status, message: 'session already stopped or completed' },
      { status: 200 }
    );
  }
  await requestSessionStop(id);
  return NextResponse.json({ ok: true });
}
