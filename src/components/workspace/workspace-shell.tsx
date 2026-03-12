'use client';

import type { ReactNode } from 'react';

interface WorkspaceShellProps {
  header: ReactNode;
  setupPanel?: ReactNode;
  liveSessionPanel?: ReactNode;
  rightPanel?: ReactNode;
  children?: ReactNode;
}

export function WorkspaceShell({
  header,
  setupPanel,
  liveSessionPanel,
  rightPanel,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden rt-shell">
      {header}
      {children ?? (
        <main className="flex-1 overflow-hidden grid gap-2 p-3 lg:grid-cols-[minmax(240px,260px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,280px)_minmax(0,1fr)_minmax(300px,340px)]">
          {setupPanel}
          {liveSessionPanel}
          {rightPanel}
        </main>
      )}
    </div>
  );
}
