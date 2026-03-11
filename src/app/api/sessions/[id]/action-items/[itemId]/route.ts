import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import {
  appendSessionEvent,
  getSessionDetail,
  updateActionItem,
} from '@/lib/db/repository';
import {
  getAllowedActionItemTransitions,
  isValidActionItemTransition,
  normalizeActionItemStatus,
} from '@/lib/decision/utils';

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
    owner?: string;
    dueAt?: number | string | null;
    verifiedAt?: number | string | null;
    verificationNote?: string;
    priority?: 'low' | 'medium' | 'high';
  };

  const detail = await getSessionDetail(id);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'not found');
  }

  const target = detail.actionItems.find((item) => item.id === itemId);
  if (!target) {
    return apiError(404, 'NOT_FOUND', 'action item not found');
  }

  const currentStatus = normalizeActionItemStatus(target.status);
  const nextStatus =
    body.status !== undefined
      ? normalizeActionItemStatus(body.status)
      : currentStatus;
  if (
    body.status !== undefined &&
    !isValidActionItemTransition(currentStatus, nextStatus)
  ) {
    return apiError(
      409,
      'ACTION_INVALID_TRANSITION',
      `invalid action status transition: ${currentStatus} -> ${nextStatus}`,
      {
        currentStatus,
        nextStatus,
        allowed: getAllowedActionItemTransitions(currentStatus),
      }
    );
  }

  const finalVerificationNote = (
    body.verificationNote ?? target.verificationNote ?? ''
  ).trim();
  if (body.status !== undefined && nextStatus === 'discarded' && !finalVerificationNote) {
    return apiError(
      400,
      'ACTION_VALIDATION_FAILED',
      'verificationNote is required when marking an action item as discarded'
    );
  }

  if (body.verifiedAt !== undefined && body.verifiedAt !== null) {
    const parsed = new Date(String(body.verifiedAt));
    if (Number.isNaN(parsed.getTime())) {
      return apiError(
        400,
        'ACTION_VALIDATION_FAILED',
        'verifiedAt must be a valid date-time'
      );
    }
  }

  await updateActionItem(id, itemId, {
    status: body.status !== undefined ? nextStatus : undefined,
    note: body.note,
    owner: body.owner,
    dueAt: body.dueAt,
    verifiedAt: body.verifiedAt,
    verificationNote: body.verificationNote,
    priority: body.priority,
  });

  const refreshed = await getSessionDetail(id);
  const updatedItem = refreshed?.actionItems.find((item) => item.id === itemId);
  if (!updatedItem) {
    return apiError(404, 'NOT_FOUND', 'action item not found');
  }

  if (body.status !== undefined && updatedItem.status !== target.status) {
    await appendSessionEvent(id, {
      type: 'action_updated',
      message: `action ${itemId} status ${target.status} -> ${updatedItem.status}`,
      metadata: {
        actionItemId: itemId,
        from: target.status,
        to: updatedItem.status,
      },
    });
  }

  return NextResponse.json(updatedItem);
}
