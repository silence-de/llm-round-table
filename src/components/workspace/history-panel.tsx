'use client';

import type { ReactNode } from 'react';

interface HistoryPanelProps {
  tabs: Array<{ id: 'context' | 'history' | 'calibration'; label: string }>;
  activeTab: 'context' | 'history' | 'calibration';
  onChangeTab: (tab: 'context' | 'history' | 'calibration') => void;
  children: ReactNode;
}

export function HistoryPanel({
  tabs,
  activeTab,
  onChangeTab,
  children,
}: HistoryPanelProps) {
  return (
    <div className="hidden lg:flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      <div className="shrink-0 flex h-10 border-b rt-border-soft gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`flex h-full flex-1 items-center justify-center text-xs font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--color-accent)] rt-text-strong'
                : 'border-transparent rt-text-dim hover:rt-text-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-0.5">{children}</div>
    </div>
  );
}
