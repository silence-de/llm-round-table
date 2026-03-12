'use client';

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
      <div className="rounded-xl border rt-surface p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 rt-text-muted" />
          <p className="rt-eyebrow">Decision Quality</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="rt-eyebrow pl-0.5">Window</span>
            <Select value={calibrationWindow} onValueChange={(value) => onChangeWindow(value as CalibrationDashboardData['window'])}>
              <SelectTrigger className="rt-input h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d" className="text-xs">30d</SelectItem>
                <SelectItem value="90d" className="text-xs">90d</SelectItem>
                <SelectItem value="180d" className="text-xs">180d</SelectItem>
                <SelectItem value="all" className="text-xs">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="rt-eyebrow pl-0.5">Decision Type</span>
            <Select value={calibrationDecisionTypeFilter} onValueChange={(value) => onChangeDecisionTypeFilter(value ?? 'all')}>
              <SelectTrigger className="rt-input h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All types</SelectItem>
                {calibrationDecisionTypeOptions.map((decisionType) => (
                  <SelectItem key={decisionType} value={decisionType} className="text-xs">
                    {decisionType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="rt-eyebrow pl-0.5">Template</span>
            <Select value={calibrationTemplateFilter} onValueChange={(value) => onChangeTemplateFilter(value ?? 'all')}>
              <SelectTrigger className="rt-input h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All templates</SelectItem>
                {historyTemplateOptions.map((templateId) => (
                  <SelectItem key={templateId} value={templateId} className="text-xs">
                    {templateLabelFor(templateId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {historyDetail?.calibrationContext.reviewedSessions ? (
        <div className="rounded-xl border rt-surface p-2.5">
          <p className="rt-eyebrow">Current Session Baseline</p>
          <div className="mt-2 space-y-1 text-xs rt-text-muted">
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
        <p className="text-sm rt-text-muted">Loading calibration…</p>
      ) : (
        <CalibrationDashboard
          data={calibrationData}
          templateLabelFor={templateLabelFor}
        />
      )}
    </div>
  );
}
