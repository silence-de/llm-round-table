'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalibrationDashboardProps {
  data: {
    reviewedSessions: number;
    averagePredictedConfidence: number;
    averageOutcomeConfidence: number;
    averageOverconfidence: number;
    averageCalibrationGap: number;
    sampleLabel: 'insufficient' | 'emerging' | 'directional' | 'stable';
    sampleNote: string;
    minimumReliableSample: number;
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
      <Card className="border border-white/8 bg-neutral-900">
        <CardContent className="px-4 py-4 text-sm text-neutral-400">
          No reviewed sessions yet. Save outcome reviews to unlock calibration trends.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">
            Calibration snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Metric label="Reviewed" value={data.reviewedSessions} suffix="" />
          <Metric label="Predicted" value={data.averagePredictedConfidence} />
          <Metric label="Outcome" value={data.averageOutcomeConfidence} />
          <Metric label="Gap" value={data.averageCalibrationGap} suffix="pt" />
        </CardContent>
      </Card>

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">Sample reliability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          <MetricRow label="Sample label" value={data.sampleLabel} />
          <MetricRow
            label="Reliable sample target"
            value={`${data.minimumReliableSample} reviewed sessions`}
          />
          <p className="text-xs text-neutral-500">{data.sampleNote}</p>
        </CardContent>
      </Card>

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">Where are we overconfident?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
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
              <p key={`guidance-${index}`} className="text-xs text-neutral-500">
                {item}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">
            Which templates look more reliable?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 pb-4">
          {data.byTemplate.length > 0 ? (
            data.byTemplate.map((item) => (
              <ListRow
                key={`template-${item.templateId}`}
                title={templateLabelFor(item.templateId)}
                body={`hit ${item.hitRate}% · delta ${item.averageOverconfidence}pt · ${item.reviewedSessions} reviewed`}
              />
            ))
          ) : (
            <p className="text-sm text-neutral-400">No template review data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">
            Do source-backed decisions perform better?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 pb-4 text-xs text-neutral-400">
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

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">
            Which agent/model combinations drift more?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 pb-4">
          {data.agentModelDrift.length > 0 ? (
            data.agentModelDrift.map((item) => (
              <ListRow
                key={`${item.agentId}-${item.modelId}`}
                title={`${item.agentId} / ${item.modelId}`}
                body={`${item.reviewedSessions} reviewed · delta ${item.averageDelta}pt · outcome ${item.averageOutcomeConfidence}%`}
              />
            ))
          ) : (
            <p className="text-sm text-neutral-400">No agent/model calibration data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/8 bg-neutral-900">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-neutral-100">Recent prediction vs outcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 pb-4">
          {data.timeline.map((item) => (
            <ListRow
              key={item.sessionId}
              title={`${templateLabelFor(item.templateId)} · ${item.predictedConfidence}% → ${item.outcomeConfidence}%`}
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
    <div className="rounded-lg border border-white/8 bg-neutral-800/50 px-3 py-2.5">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-neutral-100">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-neutral-800/50 px-3 py-2">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-xs text-right font-medium text-neutral-200">{value}</p>
    </div>
  );
}

function ListRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-neutral-800/50 px-3 py-2">
      <p className="text-xs font-medium text-neutral-200">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{body}</p>
    </div>
  );
}

function formatDate(value?: number | string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
