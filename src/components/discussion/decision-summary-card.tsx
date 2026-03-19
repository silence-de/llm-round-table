'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionConfidenceMeta, DecisionSummary } from '@/lib/decision/types';
import { buildDecisionConfidenceMeta, classifyEvidenceStatus } from '@/lib/decision/utils';
import type { ResearchEvaluation, ResearchSource } from '@/lib/search/types';
import { findResearchSourceByCitation, getResearchSourceCitationLabel } from '@/lib/search/utils';

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
  title = 'Decision Summary',
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

  return (
    <Card className="rt-surface-minutes">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <CardTitle className="flex items-center justify-between gap-3 text-sm rt-text-strong">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {researchEvaluation && (
              <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                {describeEvidenceStrength(researchEvaluation.overallConfidence)}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        {isResearchMissing && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-2 text-[11px] text-amber-100">
            本次结论缺少可用外部证据（research skipped/failed 或无选中来源），建议仅作为模型推理草案并人工复核。
          </div>
        )}
        <div className="rounded-xl border rt-border-soft p-2 text-[11px] rt-text-dim">
          <p className="font-semibold rt-text-strong">
            Evidence coverage
          </p>
          <p className="mt-1">
            {resolvedConfidenceMeta.evidenceBackedClaims} 条结论有来源支撑，
            {resolvedConfidenceMeta.unsupportedClaims} 条缺少可引用证据。
            {resolvedConfidenceMeta.citedSources > 0
              ? ` 引用了 ${resolvedConfidenceMeta.citedSources} 个来源，跨 ${resolvedConfidenceMeta.citedDomains} 个域名。`
              : ' ���无可引用来源。'}
          </p>
          {resolvedConfidenceMeta.adjustments.length > 0 && (
            <ul className="mt-1 space-y-1 pl-4">
              {resolvedConfidenceMeta.adjustments.map((item) => (
                <li key={item.kind} className="list-disc">
                  {item.label}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
        {browserVerificationCount > 0 && (
          <div className="rounded-xl border rt-border-soft p-2 text-[11px] rt-text-dim">
            <p className="font-semibold rt-text-strong">Browser capture</p>
            <p className="mt-1">
              Browser capture means the page was fetched and signals may have been extracted from
              page text via keyword-sentence matching. It does not mean every claim is semantically
              verified.
            </p>
            <p className="mt-1">
              Captured pages: {browserVerificationCount}. Manual review still required for{' '}
              {manualReviewRequiredCount} page(s).
            </p>
          </div>
        )}
        <Section heading="Summary" body={decisionSummary.summary} />
        <Section heading="Recommended Option" body={decisionSummary.recommendedOption} />
        <ListSection heading="Why" items={decisionSummary.why} />
        <ListSection heading="Risks" items={decisionSummary.risks} />
        {riskRegister && riskRegister.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
              结构化风险
            </p>
            <div className="space-y-1">
              {riskRegister.map((item) => (
                <div key={item.riskId} className="flex items-start gap-2 text-sm rt-text-strong">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.severity === 'high'
                        ? 'bg-red-500/20 text-red-300'
                        : item.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {item.severity}
                  </span>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <ListSection heading="Open Questions" items={decisionSummary.openQuestions} />
        <ListSection heading="Next Actions" items={decisionSummary.nextActions} />
        <ListSection
          heading="Alternatives Rejected"
          items={decisionSummary.alternativesRejected}
        />
        <ListSection heading="Red Lines" items={decisionSummary.redLines} />
        <ListSection
          heading="Revisit Triggers"
          items={decisionSummary.revisitTriggers}
        />
        {researchEvaluation?.gaps.length ? (
          <ListSection heading="Research Gaps" items={researchEvaluation.gaps} />
        ) : null}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
            来源覆盖情况
          </p>
          <div className="flex flex-wrap gap-1">
            <SignalChip label={`有来源支撑 ${trustSignals.backedClaims}`} />
            <SignalChip label={`来源不足 ${trustSignals.unsupportedClaims}`} />
            <SignalChip label={`引用来源 ${trustSignals.citedSources}`} />
            <SignalChip label={`跨域 ${trustSignals.citedDomains}`} />
            {trustSignals.staleSources > 0 && (
              <SignalChip label={`过时来源 ${trustSignals.staleSources}`} />
            )}
          </div>
          {trustSignals.warnings.length > 0 && (
            <ul className="space-y-1 pl-4 text-[11px] rt-text-dim">
              {trustSignals.warnings.map((warning, index) => (
                <li key={`trust-warning-${index}`} className="list-disc">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
        {decisionSummary.evidence.some((item) => item.sourceIds.length === 0) ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-2 text-[11px] text-amber-100">
            部分结论仍是无证据推断，请在执行前补充验证。
          </div>
        ) : null}
        {decisionSummary.evidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
              Evidence
            </p>
            <div className="space-y-1.5">
              {decisionSummary.evidence.map((evidence, index) => (
                <div
                  key={`${evidence.claim}-${index}`}
                  className="rounded-xl border rt-border-soft p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm rt-text-strong">{evidence.claim}</p>
                    <EvidenceStatusChip status={classifyEvidenceStatus(evidence)} />
                  </div>
                  {evidence.sourceIds.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {evidence.sourceIds.map((sourceId) => {
                        const source = findResearchSourceByCitation(sourceId, researchSources);
                        return source ? (
                          <a
                            key={`${evidence.claim}-${sourceId}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim hover:underline"
                          >
                            {getResearchSourceCitationLabel(source)}
                            {source.sourceType === 'browser_verification' ? ' captured' : ''}: {' '}
                            {source.domain || source.title}
                          </a>
                        ) : (
                          <span
                            key={`${evidence.claim}-${sourceId}`}
                            className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim"
                          >
                            {sourceId}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] rt-text-dim">
                      {evidence.gapReason || 'No explicit source mapping'}
                    </p>
                  )}
                  {evidence.gapReason && evidence.sourceIds.length > 0 ? (
                    <p className="mt-1 text-[11px] rt-text-dim">
                      Gap note: {evidence.gapReason}
                    </p>
                  ) : null}
                  {evidence.unresolvedSourceIndices?.length ? (
                    <p className="mt-1 text-[11px] rt-text-dim">
                      Legacy refs unresolved: {evidence.unresolvedSourceIndices.join(', ')}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
        {heading}
      </p>
      <p className="text-sm leading-relaxed rt-text-strong">{body || 'None'}</p>
    </div>
  );
}

function ListSection({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
        {heading}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-1 pl-4 text-sm rt-text-strong">
          {items.map((item, index) => (
            <li key={`${heading}-${index}`} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm rt-text-dim">None</p>
      )}
    </div>
  );
}

function EvidenceStatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    evidence_backed: 'border-emerald-500/40 text-emerald-300',
    extracted: 'border-slate-500/40 text-slate-400',
    captured: 'border-slate-500/40 text-slate-400',
    inferred: 'border-amber-500/40 text-amber-300',
    ungrounded: 'border-red-500/40 text-red-300',
  };
  const labels: Record<string, string> = {
    evidence_backed: '来源支撑',
    extracted: '已提取',
    captured: '已捕获',
    inferred: '推断',
    ungrounded: '无来源',
  };
  const tooltips: Record<string, string> = {
    evidence_backed: '有可引用来源支撑',
    extracted: '已从来源提取，未独立验证',
    captured: '已捕获页面，待人工复核',
    inferred: '推断性结论，基于现有数据',
    ungrounded: '无来源支撑',
  };
  const cls = styles[status] ?? 'border-slate-500/40 text-slate-400';
  return (
    <span
      title={tooltips[status] ?? status}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function SignalChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
      {label}
    </span>
  );
}

function describeEvidenceStrength(confidence: number) {
  if (confidence >= 70) return 'evidence solid';
  if (confidence >= 45) return 'evidence mixed';
  return 'evidence thin';
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
    warnings.push(`${unsupportedClaims} 条结论仍缺少可引用证据。`);
  }
  if (staleSources.length > 0) {
    warnings.push(`${staleSources.length} 个引用来源已过时。`);
  }
  if (uniqueCitedSources.size >= 2 && uniqueDomains.size <= 1) {
    warnings.push('引用来源过于集中，跨域证据不足。');
  }
  if ((researchEvaluation?.overallConfidence ?? 100) < 45) {
    warnings.push('Research posture 偏弱，建议人工复核关键结论。');
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
