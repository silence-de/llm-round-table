import { NextResponse } from 'next/server';
import {
  deleteSession,
  getSessionDetail,
  updateSessionDecisionStatus,
} from '@/lib/db/repository';
import { normalizeDecisionStatus } from '@/lib/decision/utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getSessionDetail(id);
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as { decisionStatus?: string };

  const detail = await getSessionDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const decisionStatus = normalizeDecisionStatus(body.decisionStatus);
  await updateSessionDecisionStatus(id, decisionStatus);
  return NextResponse.json({ ok: true, decisionStatus });
}
