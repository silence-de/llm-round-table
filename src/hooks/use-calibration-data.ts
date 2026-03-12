'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CalibrationDashboardData } from '@/lib/session/types';

export function useCalibrationData() {
  const [calibrationWindow, setCalibrationWindow] =
    useState<CalibrationDashboardData['window']>('90d');
  const [calibrationTemplateFilter, setCalibrationTemplateFilter] = useState('all');
  const [calibrationDecisionTypeFilter, setCalibrationDecisionTypeFilter] =
    useState<string>('all');
  const [calibrationData, setCalibrationData] =
    useState<CalibrationDashboardData | null>(null);
  const [calibrationLoading, setCalibrationLoading] = useState(false);

  const refreshCalibration = useCallback(async () => {
    setCalibrationLoading(true);
    try {
      const search = new URLSearchParams({ window: calibrationWindow });
      if (calibrationDecisionTypeFilter !== 'all') {
        search.set('decisionType', calibrationDecisionTypeFilter);
      }
      if (calibrationTemplateFilter !== 'all') {
        search.set('templateId', calibrationTemplateFilter);
      }

      const response = await fetch(`/api/sessions/calibration?${search.toString()}`);
      if (!response.ok) return;
      const payload = (await response.json()) as CalibrationDashboardData;
      setCalibrationData(payload);
    } finally {
      setCalibrationLoading(false);
    }
  }, [calibrationDecisionTypeFilter, calibrationTemplateFilter, calibrationWindow]);

  useEffect(() => {
    void refreshCalibration();
  }, [refreshCalibration]);

  return {
    calibrationWindow,
    setCalibrationWindow,
    calibrationTemplateFilter,
    setCalibrationTemplateFilter,
    calibrationDecisionTypeFilter,
    setCalibrationDecisionTypeFilter,
    calibrationData,
    calibrationLoading,
    refreshCalibration,
  };
}
