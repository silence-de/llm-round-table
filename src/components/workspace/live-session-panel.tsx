'use client';

import type { ReactNode } from 'react';

interface LiveSessionPanelProps {
  header?: ReactNode;
  progress?: ReactNode;
  feed?: ReactNode;
  error?: ReactNode;
  interjectionBar?: ReactNode;
  responsiveSidebar?: ReactNode;
  children?: ReactNode;
}

export function LiveSessionPanel({
  header,
  progress,
  feed,
  error,
  interjectionBar,
  responsiveSidebar,
  children,
}: LiveSessionPanelProps) {
  return (
    children ? (
      <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">{children}</div>
    ) : (
      <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
        <div className="shrink-0 space-y-1.5">{header}</div>
        {progress}
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border rt-surface">
          {feed}
        </div>
        {error}
        {interjectionBar}
        {responsiveSidebar}
      </div>
    )
  );
}
