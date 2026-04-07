'use client';

import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalibrationDashboard } from '@/components/discussion/calibration-dashboard';
import type { CalibrationDashboardData, SessionDetail } from '@/lib/session/types';

interface CalibrationPanelProps {
  calibrationWindow: CalibrationDashboardData['window'];
  onChangeWindow: (value: CalibrationDashboardData['window']) => void;
  calibrationDecisionTypeFilter: string;
  onChangeDecisionTypeFilter: (value: string) => void;
  calibrationDecisionTypeOptions: string[];
  calibrationTemplateFilter: string;
  onChangeTemplateFilter: (value: string) => void;
  historyTemplateOptions: string[];
  calibrationLoading: boolean;
  calibrationData: CalibrationDashboardData | null;
  historyDetail: SessionDetail | null;
  templateLabelFor: (templateId: string) => string;
}

export function CalibrationPanel({
  calibrationWindow,
  onChangeWindow,
  calibrationDecisionTypeFilter,
  onChangeDecisionTypeFilter,
  calibrationDecisionTypeOptions,
  calibrationTemplateFilter,
  onChangeTemplateFilter,
  historyTemplateOptions,
  calibrationLoading,
  calibrationData,
  historyDetail,
  templateLabelFor,
}: CalibrationPanelProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/8 bg-neutral-900 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-neutral-500" />
          <p className="text-xs font-medium text-neutral-400">Decision quality</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FilterColumn label="Window" value={calibrationWindow} onValueChange={(value) => onChangeWindow(value as CalibrationDashboardData['window'])}>
            <SelectItem value="30d" className="text-xs">30d</SelectItem>
            <SelectItem value="90d" className="text-xs">90d</SelectItem>
            <SelectItem value="180d" className="text-xs">180d</SelectItem>
            <SelectItem value="all" className="text-xs">All</SelectItem>
          </FilterColumn>
          <FilterColumn label="Decision type" value={calibrationDecisionTypeFilter} onValueChange={(value) => onChangeDecisionTypeFilter(value ?? 'all')}>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            {calibrationDecisionTypeOptions.map((decisionType) => (
              <SelectItem key={decisionType} value={decisionType} className="text-xs">
                {decisionType}
              </SelectItem>
            ))}
          </FilterColumn>
          <FilterColumn label="Template" value={calibrationTemplateFilter} onValueChange={(value) => onChangeTemplateFilter(value ?? 'all')}>
            <SelectItem value="all" className="text-xs">All templates</SelectItem>
            {historyTemplateOptions.map((templateId) => (
              <SelectItem key={templateId} value={templateId} className="text-xs">
                {templateLabelFor(templateId)}
              </SelectItem>
            ))}
          </FilterColumn>
        </div>
      </div>

      {historyDetail?.calibrationContext.reviewedSessions ? (
        <div className="rounded-xl border border-white/8 bg-neutral-900 p-3">
          <p className="text-xs font-medium text-neutral-400">Current session baseline</p>
          <div className="mt-2 space-y-1 text-xs text-neutral-500">
            <p>
              This session uses advisory context only. Historical review suggests a{' '}
              {historyDetail.calibrationContext.penalty}pt caution buffer across{' '}
              {historyDetail.calibrationContext.reviewedSessions} reviewed session(s).
            </p>
            <p>
              Baseline source: {historyDetail.calibrationContext.basedOn} · average
              overconfidence {historyDetail.calibrationContext.averageOverconfidence}pt · hit rate{' '}
              {historyDetail.calibrationContext.templateHitRate}%
            </p>
          </div>
        </div>
      ) : null}

      {calibrationLoading ? (
        <p className="text-sm text-neutral-400">Loading calibration…</p>
      ) : (
        <CalibrationDashboard
          data={calibrationData}
          templateLabelFor={templateLabelFor}
        />
      )}
    </div>
  );
}

function FilterColumn({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 border-white/8 bg-neutral-800 text-xs text-neutral-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
