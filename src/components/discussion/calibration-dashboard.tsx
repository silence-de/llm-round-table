'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalibrationDashboardProps {
  data: {
    reviewedSessions: number;
    averagePredictedConfidence: number;
    averageOutcomeConfidence: number;
    averageOverconfidence: number;
    averageCalibrationGap: number;
    byTemplate: Array<{
      templateId: string;
      reviewedSessions: number;
      averagePredictedConfidence: number;
      averageOutcomeConfidence: number;
      averageOverconfidence: number;
      hitRate: number;
    }>;
    byDecisionType: Array<{
      decisionType: string;
      reviewedSessions: number;
      averagePredictedConfidence: number;
      averageOutcomeConfidence: number;
      averageOverconfidence: number;
      hitRate: number;
    }>;
    sourcedVsUnsourced: {
      sourcedSessions: number;
      unsourcedSessions: number;
      sourcedAverage: number;
      unsourcedAverage: number;
      delta: number;
    };
    agentModelDrift: Array<{
      agentId: string;
      modelId: string;
      reviewedSessions: number;
      averageDelta: number;
      averageOutcomeConfidence: number;
    }>;
    timeline: Array<{
      sessionId: string;
      createdAt?: number | string;
      predictedConfidence: number;
      outcomeConfidence: number;
      delta: number;
      templateId: string;
      decisionType: string;
    }>;
    confidencePenaltyGuidance: string[];
    mostReliableTemplate: string;
    largestBlindSpot: string;
  } | null;
  templateLabelFor?: (templateId: string) => string;
}

export function CalibrationDashboard({
  data,
  templateLabelFor = (templateId) => templateId,
}: CalibrationDashboardProps) {
  if (!data || data.reviewedSessions === 0) {
    return (
      <Card className="rt-panel">
        <CardContent className="px-3 py-4 text-sm rt-text-muted">
          No reviewed sessions yet. Save outcome reviews to unlock calibration trends.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">
            How accurate have recent recommendations been?
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 px-3 pb-3">
          <Metric label="Reviewed" value={data.reviewedSessions} suffix="" />
          <Metric label="Predicted" value={data.averagePredictedConfidence} />
          <Metric label="Outcome" value={data.averageOutcomeConfidence} />
          <Metric label="Gap" value={data.averageCalibrationGap} suffix="pt" />
        </CardContent>
      </Card>

      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">Where are we overconfident?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          <MetricRow
            label="Average overconfidence"
            value={`${data.averageOverconfidence}pt`}
          />
          <MetricRow
            label="Largest blind spot"
            value={data.largestBlindSpot || 'Not enough data'}
          />
          <MetricRow
            label="Most reliable template"
            value={data.mostReliableTemplate || 'Not enough data'}
          />
          <div className="space-y-1">
            {data.confidencePenaltyGuidance.map((item, index) => (
              <p key={`guidance-${index}`} className="text-[11px] rt-text-dim">
                - {item}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">
            Which templates hold up better after review?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-3 pb-3">
          {data.byTemplate.length > 0 ? (
            data.byTemplate.map((item) => (
              <ListRow
                key={`template-${item.templateId}`}
                title={templateLabelFor(item.templateId)}
                body={`hit ${item.hitRate}% · delta ${item.averageOverconfidence}pt · ${item.reviewedSessions} reviewed`}
              />
            ))
          ) : (
            <p className="text-sm rt-text-muted">No template review data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">
            Do source-backed decisions perform better?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-3 pb-3 text-xs rt-text-muted">
          <p>
            Sourced sessions: {data.sourcedVsUnsourced.sourcedSessions} · avg outcome{' '}
            {data.sourcedVsUnsourced.sourcedAverage}%
          </p>
          <p>
            Unsourced sessions: {data.sourcedVsUnsourced.unsourcedSessions} · avg outcome{' '}
            {data.sourcedVsUnsourced.unsourcedAverage}%
          </p>
          <p>
            Outcome delta: {data.sourcedVsUnsourced.delta >= 0 ? '+' : ''}
            {data.sourcedVsUnsourced.delta}pt
          </p>
        </CardContent>
      </Card>

      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">
            Which agent/model combinations drift more?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-3 pb-3">
          {data.agentModelDrift.length > 0 ? (
            data.agentModelDrift.map((item) => (
              <ListRow
                key={`${item.agentId}-${item.modelId}`}
                title={`${item.agentId} / ${item.modelId}`}
                body={`${item.reviewedSessions} reviewed · delta ${item.averageDelta}pt · outcome ${item.averageOutcomeConfidence}%`}
              />
            ))
          ) : (
            <p className="text-sm rt-text-muted">No agent/model calibration data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rt-panel">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="text-sm rt-text-strong">Recent calibration timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-3 pb-3">
          {data.timeline.map((item) => (
            <ListRow
              key={item.sessionId}
              title={`${templateLabelFor(item.templateId)} · ${item.predictedConfidence}% -> ${item.outcomeConfidence}%`}
              body={`${formatDate(item.createdAt)} · gap ${item.delta}pt · ${item.decisionType}`}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = '%',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border rt-border-soft px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold rt-text-strong">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border rt-border-soft px-2 py-2">
      <p className="text-[11px] rt-text-muted">{label}</p>
      <p className="text-[11px] text-right rt-text-strong">{value}</p>
    </div>
  );
}

function ListRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border rt-border-soft px-2 py-2">
      <p className="text-xs font-medium rt-text-strong">{title}</p>
      <p className="mt-1 text-[11px] rt-text-dim">{body}</p>
    </div>
  );
}

function formatDate(value?: number | string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
