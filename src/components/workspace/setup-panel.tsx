'use client';

import type { ReactNode } from 'react';

interface SetupPanelTab {
  id: string;
  label: string;
  icon: ReactNode;
}

interface SetupPanelProps {
  tabs: SetupPanelTab[];
  activeTab: string;
  onChangeTab: (tabId: string) => void;
  children: ReactNode;
  footer: ReactNode;
}

export function SetupPanel({
  tabs,
  activeTab,
  onChangeTab,
  children,
  footer,
}: SetupPanelProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      <div className="shrink-0 flex h-10 border-b rt-border-soft gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`flex h-full flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--rt-hh6-primary)] rt-text-strong'
                : 'border-transparent rt-text-dim hover:rt-text-muted'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">{children}</div>
      <div className="shrink-0 space-y-2">{footer}</div>
    </aside>
  );
}
