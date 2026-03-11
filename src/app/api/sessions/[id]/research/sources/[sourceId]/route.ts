import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import {
  getSessionResearch,
  updateResearchSource,
} from '@/lib/db/repository';

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id, sourceId } = await params;
  const body = (await req.json()) as {
    selected?: boolean;
    pinned?: boolean;
    excludedReason?: string;
    rank?: number;
  };
  const hasPatch =
    body.selected !== undefined ||
    body.pinned !== undefined ||
    body.excludedReason !== undefined ||
    body.rank !== undefined;
  if (!hasPatch) {
    return apiError(
      400,
      'INVALID_INPUT',
      'at least one source field is required'
    );
  }

  const run = await getSessionResearch(id);
  if (!run) {
    return apiError(404, 'NOT_FOUND', 'research not found');
  }

  const updated = await updateResearchSource(id, sourceId, {
    selected: body.selected,
    pinned: body.pinned,
    excludedReason: body.excludedReason,
    rank: body.rank,
  });
  if (!updated) {
    return apiError(404, 'NOT_FOUND', 'source not found');
  }

  return NextResponse.json(updated);
}
