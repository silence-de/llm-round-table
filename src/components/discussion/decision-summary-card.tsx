'use client';

import { useMemo, useState } from 'react';
import { Accordion } from '@base-ui/react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionConfidenceMeta, DecisionSummary } from '@/lib/decision/types';
import { buildDecisionConfidenceMeta, classifyEvidenceStatus } from '@/lib/decision/utils';
import type { ResearchEvaluation, ResearchSource } from '@/lib/search/types';
import { findResearchSourceByCitation, getResearchSourceCitationLabel } from '@/lib/search/utils';
import { cn } from '@/lib/utils';

interface RiskRegisterItem {
  riskId: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface DecisionSummaryCardProps {
  title?: string;
  decisionSummary: DecisionSummary;
  researchSources?: ResearchSource[];
  researchEvaluation?: ResearchEvaluation | null;
  confidenceMeta?: DecisionConfidenceMeta | null;
  researchStatus?: 'running' | 'completed' | 'partial' | 'skipped' | 'failed' | 'idle';
  footer?: React.ReactNode;
  riskRegister?: RiskRegisterItem[];
}

export function DecisionSummaryCard({
  title = 'Decision summary',
  decisionSummary,
  researchSources = [],
  researchEvaluation = null,
  confidenceMeta = null,
  researchStatus = 'idle',
  footer,
  riskRegister,
}: DecisionSummaryCardProps) {
  const trustSignals = summarizeTrustSignals(
    decisionSummary,
    researchSources,
    researchEvaluation
  );
  const resolvedConfidenceMeta =
    confidenceMeta ??
    buildDecisionConfidenceMeta(
      decisionSummary.rawConfidence ?? decisionSummary.confidence,
      decisionSummary.evidence,
      researchSources
    );
  const selectedResearchSources = researchSources.filter((source) => source.selected);
  const isResearchMissing =
    researchStatus === 'skipped' ||
    researchStatus === 'failed' ||
    selectedResearchSources.length === 0;
  const browserVerificationCount = selectedResearchSources.filter(
    (source) => source.sourceType === 'browser_verification'
  ).length;
  const manualReviewRequiredCount = selectedResearchSources.filter(
    (source) =>
      source.sourceType === 'browser_verification' &&
      (source.qualityFlags.includes('manual_review_required') ||
        (source.verifiedFields?.length ?? 0) === 0)
  ).length;

  const overviewPoints = [
    `${resolvedConfidenceMeta.evidenceBackedClaims} conclusion${resolvedConfidenceMeta.evidenceBackedClaims === 1 ? ' is' : 's are'} backed by sources.`,
    `${resolvedConfidenceMeta.unsupportedClaims} conclusion${resolvedConfidenceMeta.unsupportedClaims === 1 ? '' : 's'} still lack explicit source support.`,
    resolvedConfidenceMeta.citedSources > 0
      ? `${resolvedConfidenceMeta.citedSources} cited source${resolvedConfidenceMeta.citedSources === 1 ? '' : 's'} across ${resolvedConfidenceMeta.citedDomains} domain${resolvedConfidenceMeta.citedDomains === 1 ? '' : 's'}.`
      : 'No citable sources are mapped yet.',
  ];

  const researchNotes = [
    isResearchMissing
      ? 'External evidence is missing for this run, so treat the recommendation as a draft pending manual review.'
      : null,
    browserVerificationCount > 0
      ? `Captured pages: ${browserVerificationCount}. Manual review is still recommended for ${manualReviewRequiredCount} page${manualReviewRequiredCount === 1 ? '' : 's'}.`
      : null,
    ...resolvedConfidenceMeta.adjustments.map((item) => `${item.label}: ${item.reason}`),
    ...trustSignals.warnings,
  ].filter((item): item is string => Boolean(item));

  const sectionValues = useMemo(
    () => [
      'summary',
      'recommended-option',
      ...(decisionSummary.why.length > 0 ? ['why'] : []),
      ...(decisionSummary.risks.length > 0 || (riskRegister?.length ?? 0) > 0 ? ['risks'] : []),
      ...(decisionSummary.openQuestions.length > 0 ? ['open-questions'] : []),
      ...(decisionSummary.nextActions.length > 0 ? ['next-actions'] : []),
      ...(decisionSummary.alternativesRejected.length > 0 ? ['alternatives-rejected'] : []),
      ...(decisionSummary.redLines.length > 0 ? ['red-lines'] : []),
      ...(decisionSummary.revisitTriggers.length > 0 ? ['revisit-triggers'] : []),
      ...(researchEvaluation?.gaps.length ? ['research-gaps'] : []),
      ...(decisionSummary.evidence.length > 0 ? ['evidence'] : []),
      ...(researchNotes.length > 0 ? ['research-notes'] : []),
    ],
    [decisionSummary, researchEvaluation?.gaps.length, researchNotes.length, riskRegister]
  );

  return (
    <Card className="rt-surface-minutes rounded-2xl border shadow-none">
      <CardHeader className="gap-3 border-b border-[color:var(--color-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium rt-text-muted">Decision context</p>
            <CardTitle className="text-base font-semibold rt-text-strong">{title}</CardTitle>
          </div>
          {researchEvaluation && (
            <StatusPill label={describeEvidenceStrength(researchEvaluation.overallConfidence)} />
          )}
        </div>
        <p className="max-w-2xl text-sm leading-6 rt-text-muted">
          {decisionSummary.summary || 'No summary has been captured yet.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={`${trustSignals.backedClaims} backed`} />
          <StatusPill label={`${trustSignals.citedSources} sources`} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
          <p className="text-sm font-medium rt-text-strong">Evidence coverage</p>
          <div className="mt-2 space-y-2">
            {overviewPoints.map((point) => (
              <p key={point} className="text-sm leading-6 rt-text-muted">
                {point}
              </p>
            ))}
          </div>
        </div>

        <Accordion.Root
          defaultValue={['summary', 'recommended-option']}
          className="divide-y divide-[color:var(--color-border)]"
        >
          {sectionValues.includes('summary') && (
            <AccordionSection value="summary" title="Summary">
              <SectionBody body={decisionSummary.summary} />
            </AccordionSection>
          )}

          {sectionValues.includes('recommended-option') && (
            <AccordionSection value="recommended-option" title="Recommended option">
              <SectionBody body={decisionSummary.recommendedOption} emptyLabel="No recommendation yet." />
            </AccordionSection>
          )}

          {sectionValues.includes('why') && (
            <AccordionSection value="why" title="Why this path">
              <ListSection items={decisionSummary.why} emptyLabel="No rationale recorded." />
            </AccordionSection>
          )}

          {sectionValues.includes('risks') && (
            <AccordionSection value="risks" title="Risks and constraints">
              <div className="space-y-4">
                <ListSection items={decisionSummary.risks} emptyLabel="No risks recorded." />
                {riskRegister && riskRegister.length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
                    <p className="text-sm font-medium rt-text-strong">Structured risk register</p>
                    <div className="space-y-3">
                      {riskRegister.map((item) => (
                        <div key={item.riskId} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill label={describeSeverity(item.severity)} />
                          </div>
                          <p className="text-sm leading-6 rt-text-muted">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </AccordionSection>
          )}

          {sectionValues.includes('open-questions') && (
            <AccordionSection value="open-questions" title="Open questions">
              <ListSection items={decisionSummary.openQuestions} emptyLabel="No open questions recorded." />
            </AccordionSection>
          )}

          {sectionValues.includes('next-actions') && (
            <AccordionSection value="next-actions" title="Next actions">
              <ListSection items={decisionSummary.nextActions} emptyLabel="No next actions recorded." />
            </AccordionSection>
          )}

          {sectionValues.includes('alternatives-rejected') && (
            <AccordionSection value="alternatives-rejected" title="Alternatives rejected">
              <ListSection
                items={decisionSummary.alternativesRejected}
                emptyLabel="No rejected alternatives recorded."
              />
            </AccordionSection>
          )}

          {sectionValues.includes('red-lines') && (
            <AccordionSection value="red-lines" title="Red lines">
              <ListSection items={decisionSummary.redLines} emptyLabel="No red lines recorded." />
            </AccordionSection>
          )}

          {sectionValues.includes('revisit-triggers') && (
            <AccordionSection value="revisit-triggers" title="Revisit triggers">
              <ListSection
                items={decisionSummary.revisitTriggers}
                emptyLabel="No revisit triggers recorded."
              />
            </AccordionSection>
          )}

          {sectionValues.includes('research-gaps') && researchEvaluation?.gaps.length ? (
            <AccordionSection value="research-gaps" title="Research gaps">
              <ListSection items={researchEvaluation.gaps} emptyLabel="No research gaps recorded." />
            </AccordionSection>
          ) : null}

          {sectionValues.includes('evidence') && (
            <AccordionSection value="evidence" title="Evidence">
              <div className="space-y-4">
                {decisionSummary.evidence.map((evidence, index) => (
                  <EvidenceRow
                    key={`${evidence.claim}-${index}`}
                    evidence={evidence}
                    researchSources={researchSources}
                  />
                ))}
              </div>
            </AccordionSection>
          )}

          {sectionValues.includes('research-notes') && (
            <AccordionSection value="research-notes" title="Research notes">
              <ListSection items={researchNotes} emptyLabel="No research notes recorded." />
            </AccordionSection>
          )}
        </Accordion.Root>

        {footer}
      </CardContent>
    </Card>
  );
}

function AccordionSection({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="py-1">
      <Accordion.Header>
        <Accordion.Trigger className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium rt-text-strong transition-colors duration-150 ease-out hover:rt-text-muted">
          <span>{title}</span>
          <ChevronDown className="h-4 w-4 shrink-0 rt-text-dim transition-transform duration-150 ease-out data-[panel-open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="pb-4">
        {children}
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function SectionBody({ body, emptyLabel = 'None.' }: { body: string; emptyLabel?: string }) {
  return <p className="text-sm leading-6 rt-text-muted">{body || emptyLabel}</p>;
}

function ListSection({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 rt-text-dim">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3 pl-5 text-sm leading-6 rt-text-muted marker:rt-text-dim list-disc">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function EvidenceRow({
  evidence,
  researchSources,
}: {
  evidence: DecisionSummary['evidence'][number];
  researchSources: ResearchSource[];
}) {
  const [showAllSources, setShowAllSources] = useState(false);
  const visibleSourceIds = showAllSources ? evidence.sourceIds : evidence.sourceIds.slice(0, 2);

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium leading-6 rt-text-strong">{evidence.claim}</p>
        <EvidenceStatusPill status={classifyEvidenceStatus(evidence)} />
      </div>

      {evidence.sourceIds.length > 0 ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {visibleSourceIds.map((sourceId) => {
              const source = findResearchSourceByCitation(sourceId, researchSources);
              return source ? (
                <a
                  key={`${evidence.claim}-${sourceId}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-xs font-medium rt-text-muted transition-colors duration-150 ease-out hover:rt-text-strong"
                >
                  <span className="truncate">
                    {getResearchSourceCitationLabel(source)} · {source.domain || source.title}
                  </span>
                </a>
              ) : (
                <span
                  key={`${evidence.claim}-${sourceId}`}
                  className="inline-flex rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-xs font-medium rt-text-muted"
                >
                  {sourceId}
                </span>
              );
            })}
          </div>
          {evidence.sourceIds.length > 2 && (
            <button
              type="button"
              className="text-xs font-medium rt-text-dim transition-colors duration-150 ease-out hover:rt-text-strong"
              onClick={() => setShowAllSources((value) => !value)}
            >
              {showAllSources
                ? 'Show fewer sources'
                : `+${evidence.sourceIds.length - 2} more source${evidence.sourceIds.length - 2 === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 rt-text-dim">
          {evidence.gapReason || 'No explicit source mapping yet.'}
        </p>
      )}

      {evidence.gapReason && evidence.sourceIds.length > 0 ? (
        <p className="mt-3 text-sm leading-6 rt-text-dim">Gap note: {evidence.gapReason}</p>
      ) : null}
      {evidence.unresolvedSourceIndices?.length ? (
        <p className="mt-2 text-sm leading-6 rt-text-dim">
          Legacy refs unresolved: {evidence.unresolvedSourceIndices.join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function EvidenceStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    evidence_backed: 'border-[color:var(--color-border)] bg-[color:var(--color-card)] rt-text-strong',
    extracted: 'border-[color:var(--color-border)] bg-[color:var(--color-card)] rt-text-muted',
    captured: 'border-[color:var(--color-border)] bg-[color:var(--color-card)] rt-text-muted',
    inferred: 'border-[color:var(--color-border)] bg-[color:var(--color-warning-subtle)] rt-text-strong',
    ungrounded: 'border-[color:var(--color-border)] bg-[color:var(--color-destructive-subtle)] rt-text-strong',
  };
  const labels: Record<string, string> = {
    evidence_backed: 'Backed',
    extracted: 'Extracted',
    captured: 'Captured',
    inferred: 'Inferred',
    ungrounded: 'Unmapped',
  };
  const tooltips: Record<string, string> = {
    evidence_backed: 'Supported by citable sources',
    extracted: 'Extracted from a source without independent verification',
    captured: 'Captured page requires manual review',
    inferred: 'Inference based on available material',
    ungrounded: 'No supporting source is mapped',
  };

  return (
    <span
      title={tooltips[status] ?? status}
      className={cn(
        'shrink-0 rounded-lg border px-2 py-1 text-xs font-medium',
        styles[status] ?? 'border-[color:var(--color-border)] bg-[color:var(--color-card)] rt-text-muted'
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-1 text-xs font-medium rt-text-muted">
      {label}
    </span>
  );
}

function describeEvidenceStrength(confidence: number) {
  if (confidence >= 70) return 'Evidence solid';
  if (confidence >= 45) return 'Evidence mixed';
  return 'Evidence thin';
}

function describeSeverity(severity: RiskRegisterItem['severity']) {
  if (severity === 'high') return 'High severity';
  if (severity === 'medium') return 'Medium severity';
  return 'Low severity';
}

function summarizeTrustSignals(
  decisionSummary: DecisionSummary,
  researchSources: ResearchSource[],
  researchEvaluation: ResearchEvaluation | null
) {
  const citedSources = decisionSummary.evidence.flatMap((item) =>
    item.sourceIds
      .map((sourceId) => findResearchSourceByCitation(sourceId, researchSources))
      .filter((source): source is ResearchSource => Boolean(source))
  );
  const uniqueCitedSources = new Map(citedSources.map((source) => [source.id, source]));
  const uniqueDomains = new Set(
    Array.from(uniqueCitedSources.values())
      .map((source) => source.domain)
      .filter(Boolean)
  );
  const staleSources = Array.from(uniqueCitedSources.values()).filter((source) => source.stale);
  const unsupportedClaims = decisionSummary.evidence.filter(
    (item) => item.sourceIds.length === 0
  ).length;

  const warnings: string[] = [];
  if (unsupportedClaims > 0) {
    warnings.push(`${unsupportedClaims} conclusion${unsupportedClaims === 1 ? '' : 's'} still lack citable evidence.`);
  }
  if (staleSources.length > 0) {
    warnings.push(`${staleSources.length} cited source${staleSources.length === 1 ? '' : 's'} may be stale.`);
  }
  if (uniqueCitedSources.size >= 2 && uniqueDomains.size <= 1) {
    warnings.push('The evidence base is concentrated in too few domains.');
  }
  if ((researchEvaluation?.overallConfidence ?? 100) < 45) {
    warnings.push('Research confidence is thin, so key claims should be manually reviewed.');
  }

  return {
    backedClaims: decisionSummary.evidence.filter((item) => item.sourceIds.length > 0).length,
    unsupportedClaims,
    citedSources: uniqueCitedSources.size,
    citedDomains: uniqueDomains.size,
    staleSources: staleSources.length,
    warnings,
  };
}
