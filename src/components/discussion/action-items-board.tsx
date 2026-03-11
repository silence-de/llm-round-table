'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ActionItem, ActionItemStatus, ActionStats } from '@/lib/decision/types';
import {
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_OPTIONS,
  getAllowedActionItemTransitions,
  normalizeActionItemStatus,
} from '@/lib/decision/utils';

interface ActionItemsBoardProps {
  title: string;
  items: ActionItem[];
  actionStats?: ActionStats | null;
  disabled?: boolean;
  showSourceMeta?: boolean;
  onItemsChange: (items: ActionItem[]) => void;
  onPatch: (
    itemId: string,
    patch: Partial<ActionItem>
  ) => Promise<void> | Promise<ActionItem>;
  onError?: (message: string) => void;
}

export function ActionItemsBoard({
  title,
  items,
  actionStats = null,
  disabled = false,
  showSourceMeta = true,
  onItemsChange,
  onPatch,
  onError,
}: ActionItemsBoardProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ActionItemStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ActionItem['priority']>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const stats = actionStats ?? summarizeLocalActionStats(items);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (statusFilter !== 'all' && normalizeActionItemStatus(item.status) !== statusFilter) {
          return false;
        }
        if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
          return false;
        }
        if (overdueOnly && !isOverdue(item)) {
          return false;
        }
        return true;
      }),
    [items, overdueOnly, priorityFilter, statusFilter]
  );

  if (items.length === 0) return null;

  return (
    <Card className="rt-surface">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm rt-text-strong">
          <span>{title}</span>
          <span className="text-xs font-normal rt-text-muted">
            {stats.total} total · {stats.pending} pending · {stats.inProgress} in progress ·{' '}
            {stats.verified} verified · {stats.overdue} overdue
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as 'all' | ActionItemStatus)}
          >
            <SelectTrigger className="rt-input h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All statuses
              </SelectItem>
              {ACTION_ITEM_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status} className="text-xs">
                  {ACTION_ITEM_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(value) =>
              setPriorityFilter(value as 'all' | ActionItem['priority'])
            }
          >
            <SelectTrigger className="rt-input h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All priorities
              </SelectItem>
              <SelectItem value="high" className="text-xs">
                high
              </SelectItem>
              <SelectItem value="medium" className="text-xs">
                medium
              </SelectItem>
              <SelectItem value="low" className="text-xs">
                low
              </SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            className={`rt-input h-8 rounded-md text-xs ${overdueOnly ? 'rt-text-strong' : 'rt-text-muted'}`}
            onClick={() => setOverdueOnly((value) => !value)}
          >
            {overdueOnly ? 'Showing overdue' : 'Overdue only'}
          </button>
        </div>

        {filteredItems.length === 0 && (
          <p className="rounded-xl border rt-border-soft p-3 text-xs rt-text-muted">
            No action items under current filters.
          </p>
        )}

        {filteredItems.map((item) => {
          const allowedStatuses = getAllowedActionItemTransitions(
            normalizeActionItemStatus(item.status)
          );
          return (
            <div key={item.id} className="rounded-xl border rt-border-soft p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium rt-text-strong">{item.content}</p>
                  {showSourceMeta && (
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                        {item.source === 'carried_forward' ? 'Carried forward' : 'Generated'}
                      </span>
                      {item.carriedFromSessionId && (
                        <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                          {item.carriedFromSessionId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Select
                  value={item.status}
                  onValueChange={(value) => {
                    const nextStatus = normalizeActionItemStatus(value);
                    const nextItems = updateLocalActionItems(items, item.id, {
                      status: nextStatus,
                    });
                    onItemsChange(nextItems);
                    void onPatch(item.id, { status: nextStatus }).catch((error) => {
                      onError?.(error instanceof Error ? error.message : String(error));
                    });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="rt-input h-8 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_ITEM_STATUS_OPTIONS.filter(
                      (status) =>
                        status === item.status ||
                        allowedStatuses.includes(status)
                    ).map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">
                        {ACTION_ITEM_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  value={item.owner ?? ''}
                  onChange={(event) =>
                    onItemsChange(
                      updateLocalActionItems(items, item.id, {
                        owner: event.target.value,
                      })
                    )
                  }
                  onBlur={(event) =>
                    void onPatch(item.id, { owner: event.target.value }).catch((error) =>
                      onError?.(error instanceof Error ? error.message : String(error))
                    )
                  }
                  placeholder="Owner"
                  className="rt-input h-8 text-xs"
                  disabled={disabled}
                />
                <Input
                  type="date"
                  value={item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : ''}
                  onChange={(event) =>
                    onItemsChange(
                      updateLocalActionItems(items, item.id, {
                        dueAt: event.target.value
                          ? new Date(`${event.target.value}T00:00:00Z`).getTime()
                          : null,
                      })
                    )
                  }
                  onBlur={(event) =>
                    void onPatch(item.id, {
                      dueAt: event.target.value
                        ? new Date(`${event.target.value}T00:00:00Z`).toISOString()
                        : null,
                    }).catch((error) =>
                      onError?.(error instanceof Error ? error.message : String(error))
                    )
                  }
                  className="rt-input h-8 text-xs"
                  disabled={disabled}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  value={item.priority}
                  onValueChange={(value) => {
                    const nextPriority = value as ActionItem['priority'];
                    onItemsChange(
                      updateLocalActionItems(items, item.id, { priority: nextPriority })
                    );
                    void onPatch(item.id, { priority: nextPriority }).catch((error) =>
                      onError?.(error instanceof Error ? error.message : String(error))
                    );
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="rt-input h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">
                      low
                    </SelectItem>
                    <SelectItem value="medium" className="text-xs">
                      medium
                    </SelectItem>
                    <SelectItem value="high" className="text-xs">
                      high
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={item.verifiedAt ? formatDateLabel(item.verifiedAt) : ''}
                  readOnly
                  placeholder="Verified at"
                  className="rt-input h-8 text-xs"
                />
              </div>
              <Textarea
                value={item.note ?? ''}
                onChange={(event) =>
                  onItemsChange(
                    updateLocalActionItems(items, item.id, {
                      note: event.target.value,
                    })
                  )
                }
                onBlur={(event) =>
                  void onPatch(item.id, { note: event.target.value }).catch((error) =>
                    onError?.(error instanceof Error ? error.message : String(error))
                  )
                }
                placeholder="Execution note, result, or owner"
                className="rt-input mt-2 min-h-[74px] text-xs"
                disabled={disabled}
              />
              <Textarea
                value={item.verificationNote ?? ''}
                onChange={(event) =>
                  onItemsChange(
                    updateLocalActionItems(items, item.id, {
                      verificationNote: event.target.value,
                    })
                  )
                }
                onBlur={(event) =>
                  void onPatch(item.id, { verificationNote: event.target.value }).catch(
                    (error) =>
                      onError?.(error instanceof Error ? error.message : String(error))
                  )
                }
                placeholder="Verification note"
                className="rt-input mt-2 min-h-[60px] text-xs"
                disabled={disabled}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function updateLocalActionItems(
  items: ActionItem[],
  itemId: string,
  patch: Partial<ActionItem>
) {
  return items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}

function formatDateLabel(value: number | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function isOverdue(item: ActionItem) {
  const status = normalizeActionItemStatus(item.status);
  if (status === 'verified' || status === 'discarded') {
    return false;
  }
  if (!item.dueAt) return false;
  return new Date(item.dueAt).getTime() < Date.now();
}

function summarizeLocalActionStats(items: ActionItem[]): ActionStats {
  return {
    total: items.length,
    pending: items.filter((item) => normalizeActionItemStatus(item.status) === 'pending').length,
    inProgress: items.filter((item) => normalizeActionItemStatus(item.status) === 'in_progress')
      .length,
    verified: items.filter((item) => normalizeActionItemStatus(item.status) === 'verified').length,
    discarded: items.filter((item) => normalizeActionItemStatus(item.status) === 'discarded')
      .length,
    overdue: items.filter(isOverdue).length,
  };
}
