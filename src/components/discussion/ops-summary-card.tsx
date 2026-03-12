'use client';

import { AlertTriangle, Activity, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OpsSummaryCardProps {
  summary: {
    sessionsAnalyzed: number;
    metrics: {
      timeoutRate: number;
      resumeSuccessRate: number;
      agentDegradedRate: number;
      unresolvedEvidenceRate: number;
    };
    recentFailures: Array<{
      sessionId: string;
      status: string;
      createdAt?: number | string;
    }>;
    degradedAgentSessions: Array<{
      sessionId: string;
      status?: string;
      createdAt?: number | string;
      degradedEventCount?: number;
    }>;
    unresolvedEvidenceSessions: Array<{
      sessionId: string;
      unresolvedEvidenceCount: number;
      createdAt?: number | string;
    }>;
    calibration: {
      reviewedSessions: number;
      averagePredictedConfidence: number;
      averageOutcomeConfidence: number;
      averageOverconfidence: number;
      averageCalibrationGap: number;
      sourcedVsUnsourcedOutcomeGap: {
        sourcedAverage: number;
        unsourcedAverage: number;
        delta: number;
      };
      templateHitRates: Array<{
        templateId: string;
        reviewedSessions: number;
        hitRate: number;
      }>;
      agentModelOverconfidence: Array<{
        agentId: string;
        modelId: string;
        reviewedSessions: number;
        averageDelta: number;
        averageOutcomeConfidence: number;
      }>;
      overconfidenceTrend: Array<{
        sessionId: string;
        createdAt?: number | string;
        predictedConfidence: number;
        outcomeConfidence: number;
        delta: number;
      }>;
    };
  } | null;
}

export function OpsSummaryCard({ summary }: OpsSummaryCardProps) {
  if (!summary || summary.sessionsAnalyzed === 0) return null;

  return (
    <Card className="rt-surface">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm rt-text-strong">
          <Activity className="h-4 w-4 rt-text-muted" />
          <span>Ops Watch</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="Timeout rate" value={summary.metrics.timeoutRate} />
          <Metric label="Resume success" value={summary.metrics.resumeSuccessRate} />
          <Metric label="Degraded rate" value={summary.metrics.agentDegradedRate} />
          <Metric
            label="Unresolved evidence"
            value={summary.metrics.unresolvedEvidenceRate}
          />
        </div>

        {summary.recentFailures.length > 0 && (
          <div className="space-y-1">
            <SectionTitle icon={AlertTriangle} label="Recent Failures" />
            {summary.recentFailures.map((item) => (
              <p key={`failure-${item.sessionId}`} className="text-[11px] rt-text-dim">
                {item.sessionId.slice(0, 8)} · {item.status} · {formatWhen(item.createdAt)}
              </p>
            ))}
          </div>
        )}

        {summary.degradedAgentSessions.length > 0 && (
          <div className="space-y-1">
            <SectionTitle icon={ShieldAlert} label="Degraded Sessions" />
            {summary.degradedAgentSessions.map((item) => (
              <p key={`degraded-${item.sessionId}`} className="text-[11px] rt-text-dim">
                {item.sessionId.slice(0, 8)} · {item.degradedEventCount ?? 0} event(s) ·{' '}
                {formatWhen(item.createdAt)}
              </p>
            ))}
          </div>
        )}

        {summary.unresolvedEvidenceSessions.length > 0 && (
          <div className="space-y-1">
            <SectionTitle icon={AlertTriangle} label="Evidence Gaps" />
            {summary.unresolvedEvidenceSessions.map((item) => (
              <p key={`evidence-${item.sessionId}`} className="text-[11px] rt-text-dim">
                {item.sessionId.slice(0, 8)} · {item.unresolvedEvidenceCount} unresolved ·{' '}
                {formatWhen(item.createdAt)}
              </p>
            ))}
          </div>
        )}

        {summary.calibration.reviewedSessions > 0 && (
          <div className="space-y-2">
            <SectionTitle icon={Activity} label="Calibration" />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric
                label="Predicted avg"
                value={summary.calibration.averagePredictedConfidence}
              />
              <Metric
                label="Outcome avg"
                value={summary.calibration.averageOutcomeConfidence}
              />
              <Metric
                label="Overconfidence"
                value={summary.calibration.averageOverconfidence}
              />
              <Metric
                label="Gap"
                value={summary.calibration.averageCalibrationGap}
              />
            </div>
            <p className="text-[11px] rt-text-dim">
              Sourced avg {summary.calibration.sourcedVsUnsourcedOutcomeGap.sourcedAverage}% ·
              Unsourced avg {summary.calibration.sourcedVsUnsourcedOutcomeGap.unsourcedAverage}% ·
              Delta {summary.calibration.sourcedVsUnsourcedOutcomeGap.delta}pt
            </p>
            {summary.calibration.templateHitRates.length > 0 && (
              <div className="space-y-1">
                {summary.calibration.templateHitRates.map((item) => (
                  <p key={`template-${item.templateId}`} className="text-[11px] rt-text-dim">
                    {item.templateId} · {item.hitRate}% hit · {item.reviewedSessions} review(s)
                  </p>
                ))}
              </div>
            )}
            {summary.calibration.agentModelOverconfidence.length > 0 && (
              <div className="space-y-1">
                <SectionTitle icon={ShieldAlert} label="Agent / Model Drift" />
                {summary.calibration.agentModelOverconfidence.map((item) => (
                  <p
                    key={`agent-model-${item.agentId}-${item.modelId}`}
                    className="text-[11px] rt-text-dim"
                  >
                    {item.agentId} · {item.modelId} · {item.averageDelta}pt over ·{' '}
                    {item.averageOutcomeConfidence}% outcome · {item.reviewedSessions} review(s)
                  </p>
                ))}
              </div>
            )}
            {summary.calibration.overconfidenceTrend.length > 0 && (
              <div className="space-y-1">
                <SectionTitle icon={Activity} label="Recent Prediction Gaps" />
                {summary.calibration.overconfidenceTrend.map((item) => (
                  <p key={`trend-${item.sessionId}`} className="text-[11px] rt-text-dim">
                    {item.sessionId.slice(0, 8)} · {item.predictedConfidence}% to{' '}
                    {item.outcomeConfidence}% · {item.delta}pt
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border rt-border-soft p-2">
      <p className="text-[10px] uppercase tracking-[0.16em] rt-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold rt-text-strong">{value}%</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: typeof AlertTriangle;
  label: string;
}) {
  return (
    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </p>
  );
}

function formatWhen(value?: number | string) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
