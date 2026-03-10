'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResearchRunDetail, ResearchSource } from '@/lib/search/types';
import type { ResearchStatus } from '@/stores/discussion-store';

interface ResearchPanelProps {
  status: ResearchStatus;
  sources: ResearchSource[];
  researchRun?: ResearchRunDetail | null;
}

export function ResearchPanel({
  status,
  sources,
  researchRun = null,
}: ResearchPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const visibleSources = useMemo(
    () => (researchRun?.sources.length ? researchRun.sources : sources),
    [researchRun, sources]
  );

  if (status === 'idle' && !researchRun) return null;

  return (
    <Card className="rt-panel">
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded((value) => !value)}
      >
        <CardTitle className="flex items-center justify-between text-base rt-text-strong">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 rt-text-muted" />
            <span>Research Intelligence</span>
            <StatusChip status={researchRun?.status ?? status} sourceCount={visibleSources.length} />
          </div>

          <ChevronDown
            className={`h-4 w-4 rt-text-muted transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {researchRun?.summary && (
            <div className="rounded-xl border rt-border-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                Research Summary
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed rt-text-strong">
                {researchRun.summary}
              </p>
            </div>
          )}

          {researchRun?.queryPlan.length ? (
            <div className="rounded-xl border rt-border-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                Query Plan
              </p>
              <ul className="mt-2 space-y-1 pl-4 text-sm rt-text-strong">
                {researchRun.queryPlan.map((query, index) => (
                  <li key={`${query}-${index}`} className="list-disc">
                    {query}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {researchRun?.evaluation && (
            <div className="rounded-xl border rt-border-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                Quality Signals
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Metric label="Coverage" value={researchRun.evaluation.coverageScore} />
                <Metric label="Recency" value={researchRun.evaluation.recencyScore} />
                <Metric label="Diversity" value={researchRun.evaluation.diversityScore} />
                <Metric
                  label="Confidence"
                  value={researchRun.evaluation.overallConfidence}
                />
              </div>
              {researchRun.evaluation.gaps.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                    Gaps
                  </p>
                  {researchRun.evaluation.gaps.map((gap, index) => (
                    <p key={`${gap}-${index}`} className="text-xs rt-text-dim">
                      - {gap}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === 'running' && (
            <div className="space-y-2">
              <p className="text-sm rt-text-muted">
                Searching the web for evidence-backed sources…
              </p>
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="rt-surface animate-pulse rounded-xl border p-3"
                >
                  <div className="mb-2 h-3 w-3/4 rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_10%,transparent)]" />
                  <div className="h-2.5 w-full rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_7%,transparent)]" />
                  <div className="mt-1 h-2.5 w-5/6 rounded bg-[color-mix(in_srgb,var(--rt-text-strong)_7%,transparent)]" />
                </div>
              ))}
            </div>
          )}

          {(status === 'skipped' || status === 'failed') && visibleSources.length === 0 && (
            <p className="text-sm rt-text-muted">
              {status === 'failed'
                ? 'Research failed. The discussion still completed, but evidence quality is limited.'
                : 'Research was skipped for this session.'}
            </p>
          )}

          {status !== 'running' && visibleSources.length === 0 && status === 'completed' && (
            <p className="text-sm rt-text-muted">No relevant results found.</p>
          )}

          {visibleSources.length > 0 && (
            <div className="space-y-2.5">
              {visibleSources.map((source) => (
                <div key={source.id} className="rt-surface rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.18em] rt-text-dim">
                        {source.id} · {source.domain || 'unknown'}
                      </p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 line-clamp-1 block text-sm font-semibold rt-text-strong hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {source.title}
                      </a>
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rt-text-muted hover:rt-text-strong"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1">
                    {source.publishedDate && (
                      <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                        {source.publishedDate.slice(0, 10)}
                      </span>
                    )}
                    <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                      score {source.score.toFixed(2)}
                    </span>
                    {source.qualityFlags.map((flag) => (
                      <span
                        key={`${source.id}-${flag}`}
                        className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>

                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed rt-text-muted">
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

function StatusChip({
  status,
  sourceCount,
}: {
  status: ResearchStatus | ResearchRunDetail['status'];
  sourceCount: number;
}) {
  const content =
    status === 'running'
      ? 'Searching…'
      : status === 'completed'
        ? `${sourceCount} sources`
        : status === 'partial'
          ? `Partial · ${sourceCount}`
          : status === 'failed'
            ? 'Failed'
            : status === 'skipped'
              ? 'Skipped'
              : 'Idle';

  return (
    <span className="rounded-full border border-[color-mix(in_srgb,var(--rt-live-state)_35%,transparent)] bg-[color-mix(in_srgb,var(--rt-live-state)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold rt-text-strong">
      {content}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border rt-border-soft px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold rt-text-strong">{value}%</p>
    </div>
  );
}
