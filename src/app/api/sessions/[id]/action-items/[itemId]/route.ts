import { NextResponse } from 'next/server';
import {
  getSessionDetail,
  updateActionItem,
} from '@/lib/db/repository';
import { normalizeActionItemStatus } from '@/lib/decision/utils';

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const body = (await req.json()) as {
    status?: string;
    note?: string;
  };

  const detail = await getSessionDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const target = detail.actionItems.find((item) => item.id === itemId);
  if (!target) {
    return NextResponse.json({ error: 'action item not found' }, { status: 404 });
  }

  await updateActionItem(id, itemId, {
    status:
      body.status !== undefined
        ? normalizeActionItemStatus(body.status)
        : undefined,
    note: body.note,
  });

  const refreshed = await getSessionDetail(id);
  const updatedItem = refreshed?.actionItems.find((item) => item.id === itemId);
  if (!updatedItem) {
    return NextResponse.json({ error: 'action item not found' }, { status: 404 });
  }

  return NextResponse.json(updatedItem);
}
