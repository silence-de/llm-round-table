import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import {
  getSessionDetail,
  previewFollowUpCarryForward,
} from '@/lib/db/repository';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parentDetail = await getSessionDetail(id);
  if (!parentDetail) {
    return apiError(404, 'NOT_FOUND', 'parent session not found');
  }

  const body = (await req.json().catch(() => ({}))) as {
    carryForwardMode?: 'all_open' | 'high_priority_only';
  };
  const carryForwardMode =
    body.carryForwardMode === 'all_open' ? 'all_open' : 'high_priority_only';

  const preview = await previewFollowUpCarryForward(id, carryForwardMode);

  return NextResponse.json({
    parentSessionId: id,
    carryForwardMode,
    inheritedActionCount: preview.inheritedActionCount,
    skippedReason: preview.skippedReason,
  });
}
