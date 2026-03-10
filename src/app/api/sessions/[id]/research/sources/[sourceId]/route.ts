import { NextResponse } from 'next/server';
import {
  getSessionResearch,
  updateResearchSourceSelection,
} from '@/lib/db/repository';

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id, sourceId } = await params;
  const body = (await req.json()) as { selected?: boolean };
  if (typeof body.selected !== 'boolean') {
    return NextResponse.json({ error: 'selected is required' }, { status: 400 });
  }

  const run = await getSessionResearch(id);
  if (!run) {
    return NextResponse.json({ error: 'research not found' }, { status: 404 });
  }

  const updated = await updateResearchSourceSelection(id, sourceId, body.selected);
  if (!updated) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}
