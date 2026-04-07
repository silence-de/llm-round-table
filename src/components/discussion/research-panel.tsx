'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Globe, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ResearchRunDetail, ResearchSource } from '@/lib/search/types';
import { getResearchSourceCitationLabel } from '@/lib/search/utils';
import {
  getVerificationProfile,
  VERIFICATION_PROFILES,
} from '@/lib/search/verification-profiles';
import type { ResearchStatus } from '@/stores/discussion-store';
import { cn } from '@/lib/utils';

interface ResearchPanelProps {
  sessionId?: string | null;
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
  defaultVerificationProfileId?: string | null;
  onVerifyUrl?: ((
    input: {
      url: string;
      profileId?: string;
      claimHint?: string;
      note?: string;
    }
  ) => void) | null;
}

export function ResearchPanel({
  sessionId = null,
  status,
  sources,
  researchRun = null,
  busy = false,
  onRerun = null,
  onToggleSourceSelection = null,
  onPatchSource = null,
  defaultVerificationProfileId = null,
  onVerifyUrl = null,
}: ResearchPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [verifyUrl, setVerifyUrl] = useState('');
  const [verificationProfileId, setVerificationProfileId] = useState<string>(
    defaultVerificationProfileId || VERIFICATION_PROFILES[0]?.id || ''
  );
  const [claimHint, setClaimHint] = useState('');
  const [verificationNote, setVerificationNote] = useState('');

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
    () => groupSourcesByCategory(visibleSources),
    [visibleSources]
  );
  const selectedStatus = researchRun?.status ?? status;
  const selectedProfile = getVerificationProfile(verificationProfileId);

  if (status === 'idle' && !researchRun) return null;

  return (
    <Card className="rt-panel rounded-2xl border shadow-none">
      <CardHeader className="gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium rt-text-muted">Research context</p>
              <CardTitle className="flex items-center gap-2 text-base font-semibold rt-text-strong">
                <Globe className="h-4 w-4 shrink-0 rt-text-muted" />
                <span>Research</span>
              </CardTitle>
              <p className="text-sm leading-6 rt-text-muted">
                {describeResearchState(selectedStatus, selectedSources.length, visibleSources.length)}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'mt-1 h-4 w-4 shrink-0 rt-text-dim transition-transform duration-150 ease-out',
                expanded ? 'rotate-180' : ''
              )}
            />
          </button>

          {onRerun && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              disabled={busy || status === 'running'}
              onClick={(event) => {
                event.stopPropagation();
                onRerun();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {busy ? 'Refreshing…' : 'Rerun'}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill label={formatStatusLabel(selectedStatus)} />
          <StatusPill label={`${selectedSources.length} selected`} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t border-[color:var(--color-border)] px-4 py-4">
          {onVerifyUrl && (
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium rt-text-strong">Capture a page</p>
                <p className="text-sm leading-6 rt-text-muted">
                  Add a browser-captured page when a specific URL is central to the decision and needs direct review.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
                <Select
                  value={verificationProfileId}
                  onValueChange={(value) => setVerificationProfileId(value ?? '')}
                >
                  <SelectTrigger className="rt-input h-10 rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_PROFILES.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id} className="text-sm">
                        {profile.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={verifyUrl}
                  onChange={(event) => setVerifyUrl(event.target.value)}
                  placeholder="Paste a URL to capture"
                  className="rt-input h-10 rounded-xl text-sm"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  value={claimHint}
                  onChange={(event) => setClaimHint(event.target.value)}
                  placeholder="Optional claim to validate"
                  className="rt-input h-10 rounded-xl text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-10 text-sm md:justify-self-end md:px-5"
                  disabled={busy || !verifyUrl.trim()}
                  onClick={() => {
                    onVerifyUrl({
                      url: verifyUrl.trim(),
                      profileId: verificationProfileId || undefined,
                      claimHint: claimHint.trim() || undefined,
                      note: verificationNote.trim() || undefined,
                    });
                    setVerifyUrl('');
                    setClaimHint('');
                    setVerificationNote('');
                  }}
                >
                  Capture page
                </Button>
              </div>

              <Textarea
                value={verificationNote}
                onChange={(event) => setVerificationNote(event.target.value)}
                placeholder="Optional note about why this page matters"
                className="rt-input mt-4 min-h-[88px] rounded-xl text-sm"
              />

              <p className="mt-4 text-sm leading-6 rt-text-muted">
                The captured-page workflow stores a snapshot, extracts profile-specific facts when possible, and marks what still needs manual review.
              </p>

              {selectedProfile && (
                <div className="mt-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
                  <p className="text-sm font-medium rt-text-strong">Extraction targets</p>
                  <ChipOverflowRow items={selectedProfile.extractionTargets} className="mt-3" />
                </div>
              )}
            </div>
          )}

          {researchRun?.summary && (
            <ContextBlock title="Research summary">
              <p className="whitespace-pre-line text-sm leading-6 rt-text-muted">
                {researchRun.summary}
              </p>
            </ContextBlock>
          )}

          {researchRun?.queryPlan.length ? (
            <ContextBlock title="Query plan">
              <ListBlock items={researchRun.queryPlan} />
            </ContextBlock>
          ) : null}

          {researchRun?.evaluation && (
            <ContextBlock title="Quality assessment">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Coverage" value={researchRun.evaluation.coverageScore} />
                <Metric label="Recency" value={researchRun.evaluation.recencyScore} />
                <Metric label="Diversity" value={researchRun.evaluation.diversityScore} />
                <Metric label="Confidence" value={researchRun.evaluation.overallConfidence} />
              </div>

              <p className="mt-4 text-sm leading-6 rt-text-muted">
                {researchRun.evaluation.overallConfidence >= 70
                  ? 'Evidence posture is solid enough to support a decision.'
                  : researchRun.evaluation.overallConfidence >= 45
                    ? 'Evidence posture is mixed and worth a manual review.'
                    : 'Evidence posture is thin, so conclusions should be treated cautiously.'}
              </p>

              {researchRun.evaluation.gaps.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium rt-text-strong">Gaps</p>
                  <ListBlock items={researchRun.evaluation.gaps} />
                </div>
              ) : null}

              {researchRun.evaluation.staleFlags.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium rt-text-strong">Staleness flags</p>
                  <ChipOverflowRow items={researchRun.evaluation.staleFlags} />
                </div>
              ) : null}
            </ContextBlock>
          )}

          {status === 'running' && (
            <div className="space-y-3">
              <p className="text-sm leading-6 rt-text-muted">
                Searching for evidence-backed sources.
              </p>
              {[1, 2, 3].map((index) => (
                <div key={index} className="rt-surface rounded-xl border p-4 shadow-none">
                  <div className="mb-3 h-3 w-3/4 rounded rt-shimmer" />
                  <div className="h-3 w-full rounded rt-shimmer" />
                  <div className="mt-2 h-3 w-5/6 rounded rt-shimmer" />
                </div>
              ))}
            </div>
          )}

          {(status === 'skipped' || status === 'failed') && visibleSources.length === 0 && (
            <ContextBlock title="Status note">
              <p className="text-sm leading-6 rt-text-muted">
                {status === 'failed'
                  ? 'Research failed. The discussion still completed, but the evidence base is limited.'
                  : 'Research was skipped for this session.'}
              </p>
            </ContextBlock>
          )}

          {status !== 'running' && visibleSources.length === 0 && status === 'completed' && (
            <ContextBlock title="Status note">
              <p className="text-sm leading-6 rt-text-muted">No relevant results were found.</p>
            </ContextBlock>
          )}

          {visibleSources.length > 0 && (
            <div className="space-y-6">
              {groupedSources.map(([category, categorySources]) => (
                <section key={category} className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium rt-text-strong">{category}</p>
                    <p className="text-sm leading-6 rt-text-muted">
                      {categorySources.length} source{categorySources.length === 1 ? '' : 's'} in this group.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {categorySources.map((source) => (
                      <SourceCard
                        key={source.id}
                        sessionId={sessionId}
                        source={source}
                        onToggleSourceSelection={onToggleSourceSelection}
                        onPatchSource={onPatchSource}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ContextBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
      <p className="text-sm font-medium rt-text-strong">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SourceCard({
  sessionId,
  source,
  onToggleSourceSelection,
  onPatchSource,
}: {
  sessionId: string | null;
  source: ResearchSource;
  onToggleSourceSelection: ResearchPanelProps['onToggleSourceSelection'];
  onPatchSource: ResearchPanelProps['onPatchSource'];
}) {
  const metadata = [
    source.selected ? 'Selected' : 'Excluded',
    source.pinned ? 'Pinned' : null,
    source.sourceType === 'browser_verification' ? 'Captured page' : null,
    source.publishedDate ? source.publishedDate.slice(0, 10) : null,
    source.capturedAt ? `Captured ${formatCapturedAt(source.capturedAt)}` : null,
    source.captureStatus
      ? source.captureStatus === 'screenshot'
        ? 'Live screenshot'
        : 'Snapshot fallback'
      : null,
    source.verificationProfile
      ? lookupProfile(source.verificationProfile)?.label ?? source.verificationProfile
      : null,
    source.extractionMethod
      ? source.extractionMethod === 'playwright_dom'
        ? 'DOM extract'
        : 'HTML fallback'
      : null,
    source.extractionQuality ? `Extraction ${source.extractionQuality}` : null,
    source.stale ? 'Stale' : null,
    `Rank ${source.rank}`,
    `Score ${source.score.toFixed(2)}`,
    ...source.qualityFlags,
  ].filter((item): item is string => Boolean(item));

  return (
    <div
      className={cn(
        'rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none',
        !source.selected && 'opacity-65'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium rt-text-muted">
            {getResearchSourceCitationLabel(source)} · {source.domain || 'Unknown source'}
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-medium leading-6 rt-text-strong transition-colors duration-150 ease-out hover:underline"
          >
            {source.title}
          </a>
          <p className="text-sm leading-6 rt-text-muted">{source.snippet}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleSourceSelection && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs"
              onClick={() => onToggleSourceSelection(source.id, !source.selected)}
            >
              {source.selected ? 'Exclude' : 'Include'}
            </Button>
          )}
          {onPatchSource && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs"
              onClick={() => onPatchSource(source.id, { pinned: !source.pinned })}
            >
              {source.pinned ? 'Unpin' : 'Pin'}
            </Button>
          )}
          {source.snapshotPath && sessionId && (
            <a
              href={`/api/sessions/${sessionId}/research/sources/${source.id}/snapshot`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-border)] rt-text-muted transition-colors duration-150 ease-out hover:rt-text-strong"
              title="Open captured snapshot"
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-border)] rt-text-muted transition-colors duration-150 ease-out hover:rt-text-strong"
            title="Open source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <ChipOverflowRow items={metadata} className="mt-4" />

      {onPatchSource && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => {
              onPatchSource(source.id, {
                rank: Math.max(1, source.rank - 1),
              });
            }}
          >
            Raise rank
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => {
              onPatchSource(source.id, { rank: source.rank + 1 });
            }}
          >
            Lower rank
          </Button>
        </div>
      )}

      {source.claimHint && (
        <p className="mt-4 text-sm leading-6 rt-text-muted">Claim under review: {source.claimHint}</p>
      )}
      {source.note && (
        <p className="mt-2 text-sm leading-6 rt-text-muted">Note: {source.note}</p>
      )}
      {source.verifiedFields?.length ? (
        <div className="mt-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
          <p className="text-sm font-medium rt-text-strong">Extracted signals</p>
          <p className="mt-2 text-sm leading-6 rt-text-muted">
            These signals were extracted from page text and still require human judgment.
          </p>
          <div className="mt-4 space-y-3">
            {source.verifiedFields.map((field, index) => (
              <div
                key={`${source.id}-field-${index}`}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium rt-text-strong">{field.label}</p>
                  <StatusPill
                    label={
                      field.confidence === 'high'
                        ? 'Strong signal'
                        : field.confidence === 'medium'
                          ? 'Signal'
                          : 'Weak signal'
                    }
                  />
                </div>
                <p className="mt-2 text-sm leading-6 rt-text-muted">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {source.verificationNotes?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium rt-text-strong">Verification notes</p>
          <ListBlock items={source.verificationNotes} />
        </div>
      ) : null}
      {!source.selected && source.excludedReason && (
        <p className="mt-4 text-sm leading-6 rt-text-muted">Excluded because: {source.excludedReason}</p>
      )}
    </div>
  );
}

function ChipOverflowRow({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 2);

  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {visibleItems.map((item) => (
          <StatusPill key={item} label={item} />
        ))}
      </div>
      {items.length > 2 && (
        <button
          type="button"
          className="text-xs font-medium rt-text-dim transition-colors duration-150 ease-out hover:rt-text-strong"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show fewer details' : `+${items.length - 2} more`}
        </button>
      )}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-1 text-xs font-medium rt-text-muted">
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
      <p className="text-sm font-medium rt-text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold rt-text-strong">{value}%</p>
    </div>
  );
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 pl-5 text-sm leading-6 rt-text-muted marker:rt-text-dim list-disc">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function formatCapturedAt(value: number | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
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
  if (source.sourceType === 'browser_verification') {
    return 'Captured pages';
  }
  const domain = source.domain.toLowerCase();
  const title = source.title.toLowerCase();

  if (
    /\.gov$/.test(domain) ||
    /docs|support|developer|official/.test(domain) ||
    /official|documentation|filing/.test(title)
  ) {
    return 'Official and documentation';
  }

  if (/news|times|journal|post|reuters|bloomberg|techcrunch|theinformation/.test(domain)) {
    return 'News';
  }

  if (/blog|medium|substack|opinion|analysis|insights/.test(domain + title)) {
    return 'Analysis and opinion';
  }

  return 'Reference';
}

function formatStatusLabel(status: ResearchStatus | ResearchRunDetail['status']) {
  if (status === 'running') return 'Searching';
  if (status === 'completed') return 'Completed';
  if (status === 'partial') return 'Partial';
  if (status === 'failed') return 'Failed';
  if (status === 'skipped') return 'Skipped';
  return 'Idle';
}

function describeResearchState(
  status: ResearchStatus | ResearchRunDetail['status'],
  selectedCount: number,
  totalCount: number
) {
  if (status === 'running') {
    return 'Research is in progress and new evidence may still appear.';
  }
  if (status === 'failed') {
    return 'Research did not complete, so the evidence base may be incomplete.';
  }
  if (status === 'skipped') {
    return 'Research was skipped for this session.';
  }
  if (status === 'partial') {
    return `${selectedCount} of ${totalCount} sources are currently selected from a partial run.`;
  }
  if (status === 'completed') {
    return `${selectedCount} of ${totalCount} sources are currently selected for context.`;
  }
  return 'Research is available when a session begins.';
}
