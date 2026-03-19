'use client';

/**
 * T6-5: Decision Progress Dashboard.
 *
 * Shown as the first screen when starting a follow-up session.
 * Displays the prior session's reflection: open assumptions,
 * evidence gaps, pending forecasts, and active lessons.
 * User confirms before entering the discussion.
 */
import { useState } from 'react';
import type { AssumptionEntry, ForecastEntry, GapEntry, SessionEndReflection } from '@/lib/decision/types';

interface Props {
  reflection: SessionEndReflection;
  onConfirm: () => void;
  onUpdateAssumption?: (index: number, status: AssumptionEntry['status']) => void;
  onRecordForecastOutcome?: (forecastId: string, outcome: boolean) => void;
}

export function DecisionProgressDashboard({
  reflection,
  onConfirm,
  onUpdateAssumption,
  onRecordForecastOutcome,
}: Props) {
  const [assumptionStatuses, setAssumptionStatuses] = useState<
    AssumptionEntry['status'][]
  >(reflection.assumptionsWithStatus.map((a) => a.status));

  const openAssumptions = reflection.assumptionsWithStatus.filter(
    (_, i) => assumptionStatuses[i] === 'open'
  );
  const pendingForecasts = reflection.forecastItems.filter(
    (f) => f.actualOutcome == null && f.deadline
  );
  const now = new Date().toISOString().slice(0, 10);
  const overdueForecasts = pendingForecasts.filter((f) => f.deadline < now);

  function handleAssumptionStatus(index: number, status: AssumptionEntry['status']) {
    const updated = [...assumptionStatuses];
    updated[index] = status;
    setAssumptionStatuses(updated);
    onUpdateAssumption?.(index, status);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold mb-1">决策进度回顾</h2>
        {reflection.decisionSummary && (
          <p className="text-sm text-muted-foreground">{reflection.decisionSummary}</p>
        )}
      </div>

      {/* Open assumptions */}
      {reflection.assumptionsWithStatus.length > 0 && (
        <Section title={`待验证假设 (${openAssumptions.length} 项未关闭)`}>
          {reflection.assumptionsWithStatus.map((assumption, i) => (
            <AssumptionRow
              key={i}
              assumption={assumption}
              status={assumptionStatuses[i]}
              onStatusChange={(s) => handleAssumptionStatus(i, s)}
            />
          ))}
        </Section>
      )}

      {/* Evidence gaps */}
      {reflection.evidenceGaps.length > 0 && (
        <Section title={`证据缺口 (${reflection.evidenceGaps.length} 项)`}>
          {reflection.evidenceGaps.map((gap, i) => (
            <GapRow key={i} gap={gap} />
          ))}
        </Section>
      )}

      {/* Pending forecasts */}
      {pendingForecasts.length > 0 && (
        <Section
          title={`待验证预测 (${pendingForecasts.length} 项${overdueForecasts.length > 0 ? `，${overdueForecasts.length} 项已到期` : ''})`}
        >
          {pendingForecasts.map((forecast) => (
            <ForecastRow
              key={forecast.id}
              forecast={forecast}
              overdue={forecast.deadline < now}
              onRecord={
                onRecordForecastOutcome
                  ? (outcome) => onRecordForecastOutcome(forecast.id, outcome)
                  : undefined
              }
            />
          ))}
        </Section>
      )}

      <button
        onClick={onConfirm}
        className="mt-2 self-end px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        确认并开始讨论
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function AssumptionRow({
  assumption,
  status,
  onStatusChange,
}: {
  assumption: AssumptionEntry;
  status: AssumptionEntry['status'];
  onStatusChange: (s: AssumptionEntry['status']) => void;
}) {
  const statusColor =
    status === 'confirmed'
      ? 'text-green-600'
      : status === 'refuted'
        ? 'text-red-500'
        : 'text-amber-500';

  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
      <div className="flex-1">
        <p>{assumption.text}</p>
        {assumption.howToFalsify && (
          <p className="text-xs text-muted-foreground mt-0.5">
            可证伪方式：{assumption.howToFalsify}
          </p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {(['confirmed', 'open', 'refuted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${
              status === s
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground'
            }`}
          >
            {s === 'confirmed' ? '已确认' : s === 'refuted' ? '已否定' : '待定'}
          </button>
        ))}
      </div>
    </div>
  );
}

function GapRow({ gap }: { gap: GapEntry }) {
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="font-medium">{gap.topic}</p>
      <p className="text-muted-foreground text-xs mt-0.5">{gap.gapReason}</p>
      {gap.nextAction && (
        <p className="text-xs mt-1">
          <span className="text-muted-foreground">建议行动：</span>
          {gap.nextAction}
        </p>
      )}
    </div>
  );
}

function ForecastRow({
  forecast,
  overdue,
  onRecord,
}: {
  forecast: ForecastEntry;
  overdue: boolean;
  onRecord?: (outcome: boolean) => void;
}) {
  return (
    <div
      className={`rounded-md border p-3 text-sm ${overdue ? 'border-amber-400' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p>{forecast.claim}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            概率 {Math.round(forecast.probability * 100)}% · 截止 {forecast.deadline}
            {overdue && <span className="text-amber-500 ml-1">（已到期）</span>}
          </p>
          {forecast.measurableOutcome && (
            <p className="text-xs text-muted-foreground mt-0.5">
              度量口径：{forecast.measurableOutcome}
            </p>
          )}
        </div>
        {onRecord && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onRecord(true)}
              className="px-2 py-0.5 rounded text-xs border border-green-500 text-green-600 hover:bg-green-50 transition-colors"
            >
              发生了
            </button>
            <button
              onClick={() => onRecord(false)}
              className="px-2 py-0.5 rounded text-xs border border-red-400 text-red-500 hover:bg-red-50 transition-colors"
            >
              未发生
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
