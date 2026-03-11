'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionSummary } from '@/lib/decision/types';
import type { ResearchEvaluation, ResearchSource } from '@/lib/search/types';

interface DecisionSummaryCardProps {
  title?: string;
  decisionSummary: DecisionSummary;
  researchSources?: ResearchSource[];
  researchEvaluation?: ResearchEvaluation | null;
  footer?: React.ReactNode;
}

export function DecisionSummaryCard({
  title = 'Decision Summary',
  decisionSummary,
  researchSources = [],
  researchEvaluation = null,
  footer,
}: DecisionSummaryCardProps) {
  return (
    <Card className="rt-surface-minutes">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <CardTitle className="flex items-center justify-between gap-3 text-sm rt-text-strong">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {researchEvaluation && (
              <>
                <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                  research {researchEvaluation.overallConfidence}%
                </span>
                <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                  {describeEvidenceStrength(researchEvaluation.overallConfidence)}
                </span>
              </>
            )}
            <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
              confidence {decisionSummary.confidence}%
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <Section heading="Summary" body={decisionSummary.summary} />
        <Section heading="Recommended Option" body={decisionSummary.recommendedOption} />
        <ListSection heading="Why" items={decisionSummary.why} />
        <ListSection heading="Risks" items={decisionSummary.risks} />
        <ListSection heading="Open Questions" items={decisionSummary.openQuestions} />
        <ListSection heading="Next Actions" items={decisionSummary.nextActions} />
        {researchEvaluation?.gaps.length ? (
          <ListSection heading="Research Gaps" items={researchEvaluation.gaps} />
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
                  <p className="text-sm rt-text-strong">{evidence.claim}</p>
                  {evidence.sourceIds.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {evidence.sourceIds.map((sourceId) => {
                        const source = researchSources.find(
                          (candidate) => candidate.id === sourceId
                        );
                        return source ? (
                          <a
                            key={`${evidence.claim}-${sourceId}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim hover:underline"
                          >
                            {source.id}: {source.domain || source.title}
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

function describeEvidenceStrength(confidence: number) {
  if (confidence >= 70) return 'evidence solid';
  if (confidence >= 45) return 'evidence mixed';
  return 'evidence thin';
}
