'use client';

import { useState } from 'react';
import { Globe, ChevronDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResearchSource } from '@/lib/search/types';
import type { ResearchStatus } from '@/stores/discussion-store';

interface ResearchPanelProps {
  status: ResearchStatus;
  sources: ResearchSource[];
}

export function ResearchPanel({ status, sources }: ResearchPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (status === 'idle') return null;

  return (
    <Card className="rt-panel">
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between text-base rt-text-strong">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 rt-text-muted" />
            <span>Web Research</span>

            {status === 'running' && (
              <span className="rt-chip-live animate-pulse rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                Searching…
              </span>
            )}

            {status === 'complete' && sources.length > 0 && (
              <span className="rounded-full border border-[color-mix(in_srgb,var(--rt-live-state)_40%,transparent)] bg-[color-mix(in_srgb,var(--rt-live-state)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold rt-text-strong">
                {sources.length} sources
              </span>
            )}

            {status === 'skipped' && (
              <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] font-semibold rt-text-dim">
                Skipped
              </span>
            )}
          </div>

          <ChevronDown
            className={`h-4 w-4 rt-text-muted transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {status === 'running' && (
            <div className="space-y-2">
              <p className="text-sm rt-text-muted">
                Searching the web for the latest information…
              </p>
              {/* Skeleton loaders */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rt-surface animate-pulse rounded-xl border p-3"
                >
                  <div className="mb-2 h-3 w-3/4 rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_10%,transparent)]" />
                  <div className="h-2.5 w-full rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_7%,transparent)]" />
                  <div className="mt-1 h-2.5 w-5/6 rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_7%,transparent)]" />
                </div>
              ))}
            </div>
          )}

          {status === 'skipped' && (
            <p className="text-sm rt-text-muted">
              Web search was skipped.{' '}
              <span className="rt-text-dim">
                Set <code className="font-mono text-xs">TAVILY_API_KEY</code> in{' '}
                <code className="font-mono text-xs">.env.local</code> to enable it.
              </span>
            </p>
          )}

          {status === 'complete' && sources.length === 0 && (
            <p className="text-sm rt-text-muted">No relevant results found.</p>
          )}

          {status === 'complete' && sources.length > 0 && (
            <div className="space-y-2.5">
              {sources.map((source, i) => (
                <div key={i} className="rt-surface rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-1 flex-1 text-sm font-semibold rt-text-strong hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {source.title}
                    </a>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rt-text-muted hover:rt-text-strong"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {source.publishedDate && (
                    <p className="mt-0.5 text-[10px] rt-text-dim">
                      {source.publishedDate.slice(0, 10)}
                    </p>
                  )}

                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed rt-text-muted">
                    {source.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
