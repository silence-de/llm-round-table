'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Globe, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResearchRunDetail, ResearchSource } from '@/lib/search/types';
import type { ResearchStatus } from '@/stores/discussion-store';

interface ResearchPanelProps {
  status: ResearchStatus;
  sources: ResearchSource[];
  researchRun?: ResearchRunDetail | null;
  busy?: boolean;
  onRerun?: (() => void) | null;
  onToggleSourceSelection?: ((sourceId: string, selected: boolean) => void) | null;
  onPatchSource?: ((
    sourceId: string,
    patch: { pinned?: boolean; rank?: number; excludedReason?: string }
  ) => void) | null;
}

export function ResearchPanel({
  status,
  sources,
  researchRun = null,
  busy = false,
  onRerun = null,
  onToggleSourceSelection = null,
  onPatchSource = null,
}: ResearchPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const visibleSources = useMemo(
    () =>
      [...(researchRun?.sources.length ? researchRun.sources : sources)].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.rank - b.rank;
      }),
    [researchRun, sources]
  );
  const selectedSources = useMemo(
    () => visibleSources.filter((source) => source.selected),
    [visibleSources]
  );
  const groupedSources = useMemo(
    () =>
      groupSourcesByCategory(
        visibleSources.length > 0 ? visibleSources : sources
      ),
    [sources, visibleSources]
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
            <StatusChip
              status={researchRun?.status ?? status}
              sourceCount={selectedSources.length}
            />
          </div>
          <div className="flex items-center gap-2">
            {onRerun && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px]"
                disabled={busy || status === 'running'}
                onClick={(event) => {
                  event.stopPropagation();
                  onRerun();
                }}
              >
                <RotateCcw className="h-3 w-3" />
                {busy ? 'Refreshing…' : 'Rerun'}
              </Button>
            )}
            <ChevronDown
              className={`h-4 w-4 rt-text-muted transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </CardTitle>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
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
              {researchRun.evaluation.staleFlags.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                    Staleness Flags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {researchRun.evaluation.staleFlags.map((flag) => (
                      <span
                        key={`stale-${flag}`}
                        className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[11px] rt-text-dim">
                {researchRun.evaluation.overallConfidence >= 70
                  ? 'Evidence posture: solid enough to support a decision.'
                  : researchRun.evaluation.overallConfidence >= 45
                    ? 'Evidence posture: mixed, worth a manual review.'
                    : 'Evidence posture: thin, treat conclusions cautiously.'}
              </p>
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
                  className="rt-surface rounded-xl border p-3"
                >
                  <div className="mb-2 h-3 w-3/4 rounded rt-shimmer" />
                  <div className="h-2.5 w-full rounded rt-shimmer" />
                  <div className="mt-1 h-2.5 w-5/6 rounded rt-shimmer" />
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
              <div className="rounded-xl border rt-border-soft p-3 text-xs rt-text-dim">
                {selectedSources.length} selected / {visibleSources.length} total
              </div>
              {groupedSources.map(([category, categorySources]) => (
                <div key={category} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                    {category}
                  </p>
                  {categorySources.map((source) => (
                    <div
                      key={source.id}
                      className={`rt-surface rounded-xl border p-3 ${
                        source.selected ? '' : 'opacity-55'
                      }`}
                    >
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
                        <div className="flex items-center gap-1.5">
                          {onToggleSourceSelection && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleSourceSelection(source.id, !source.selected);
                              }}
                            >
                              {source.selected ? 'Exclude' : 'Include'}
                            </Button>
                          )}
                          {onPatchSource && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPatchSource(source.id, { pinned: !source.pinned });
                              }}
                            >
                              {source.pinned ? 'Unpin' : 'Pin'}
                            </Button>
                          )}
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
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                          {source.selected ? 'selected' : 'excluded'}
                        </span>
                        {source.pinned && (
                          <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                            pinned
                          </span>
                        )}
                        <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                          rank {source.rank}
                        </span>
                        {source.publishedDate && (
                          <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                            {source.publishedDate.slice(0, 10)}
                          </span>
                        )}
                        {source.stale && (
                          <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                            stale
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
                      {onPatchSource && (
                        <div className="mt-1.5 flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPatchSource(source.id, {
                                rank: Math.max(1, source.rank - 1),
                              });
                            }}
                          >
                            ↑ rank
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPatchSource(source.id, { rank: source.rank + 1 });
                            }}
                          >
                            ↓ rank
                          </Button>
                        </div>
                      )}

                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed rt-text-muted">
                        {source.snippet}
                      </p>
                      {!source.selected && source.excludedReason && (
                        <p className="mt-1 text-[11px] rt-text-dim">
                          excluded: {source.excludedReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
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

function groupSourcesByCategory(sources: ResearchSource[]) {
  const grouped = new Map<string, ResearchSource[]>();

  for (const source of sources) {
    const category = classifySourceCategory(source);
    const existing = grouped.get(category) ?? [];
    existing.push(source);
    grouped.set(category, existing);
  }

  return Array.from(grouped.entries());
}

function classifySourceCategory(source: ResearchSource) {
  const domain = source.domain.toLowerCase();
  const title = source.title.toLowerCase();

  if (
    /\.gov$/.test(domain) ||
    /docs|support|developer|official/.test(domain) ||
    /official|documentation|filing/.test(title)
  ) {
    return 'Official / Documentation';
  }

  if (/news|times|journal|post|reuters|bloomberg|techcrunch|theinformation/.test(domain)) {
    return 'News';
  }

  if (/blog|medium|substack|opinion|analysis|insights/.test(domain + title)) {
    return 'Analysis / Opinion';
  }

  return 'Reference';
}
