'use client';

import type { ReactNode } from 'react';

interface WorkspaceShellProps {
  /** Rendered in the persistent top bar area when a session is active. */
  header?: ReactNode;
  children?: ReactNode;
  /** When true the shell renders the active-session 2-column layout.
   *  When false (default) the shell renders the idle centered-card layout. */
  isActive?: boolean;
}

export function WorkspaceShell({
  header,
  children,
  isActive = false,
}: WorkspaceShellProps) {
  const rootClassName =
    'flex h-dvh flex-col overflow-hidden bg-[var(--color-bg)] antialiased font-sans';

  if (!isActive) {
    // ── Idle / empty state ─────────────────────────────────────────────────
    // No persistent grid, no empty sidebars — full viewport centered layout.
    return <div className={rootClassName}>{children}</div>;
  }

  // ── Active session state ─────────────────────────────────────────────────
  // Narrow top bar (header) + scrollable content area below.
  return (
    <div className={rootClassName}>
      {header && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
          {header}
        </div>
      )}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
