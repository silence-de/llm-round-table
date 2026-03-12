'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDetail, SessionRecord } from '@/lib/session/types';

interface UseSessionHistoryOptions {
  onError: (message: string) => void;
  onLoadStart?: () => void;
  onLoaded?: () => void;
}

export function useSessionHistory({
  onError,
  onLoadStart,
  onLoaded,
}: UseSessionHistoryOptions) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SessionDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [compareSessionIds, setCompareSessionIds] = useState<string[]>([]);
  const [compareDetails, setCompareDetails] = useState<SessionDetail[]>([]);
  const loadHistoryRequestRef = useRef(0);

  const refreshSessions = useCallback(async () => {
    const response = await fetch('/api/sessions');
    if (!response.ok) return;
    const payload = (await response.json()) as SessionRecord[];
    setSessions([...payload].reverse());
  }, []);

  const loadHistory = useCallback(
    async (id: string) => {
      const requestId = ++loadHistoryRequestRef.current;
      onLoadStart?.();
      setLoadingHistory(true);
      setActiveHistoryId(id);
      try {
        const response = await fetch(`/api/sessions/${id}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as SessionDetail;
        if (requestId !== loadHistoryRequestRef.current) return;
        setHistoryDetail(payload);
        onLoaded?.();
      } catch (error) {
        if (requestId !== loadHistoryRequestRef.current) return;
        onError(error instanceof Error ? error.message : String(error));
      } finally {
        if (requestId !== loadHistoryRequestRef.current) return;
        setLoadingHistory(false);
      }
    },
    [onError, onLoaded, onLoadStart]
  );

  const deleteHistory = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        onError(`Delete failed: ${response.status}`);
        return false;
      }
      if (activeHistoryId === id) {
        setActiveHistoryId(null);
        setHistoryDetail(null);
      }
      setCompareSessionIds((prev) => prev.filter((sessionId) => sessionId !== id));
      setCompareDetails((prev) =>
        prev.filter((detail) => detail.session.id !== id)
      );
      await refreshSessions();
      return true;
    },
    [activeHistoryId, onError, refreshSessions]
  );

  useEffect(() => {
    if (compareSessionIds.length === 0) {
      setCompareDetails([]);
      return;
    }

    let cancelled = false;
    void Promise.all(
      compareSessionIds.map(async (id) => {
        const response = await fetch(`/api/sessions/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to load comparison session ${id}`);
        }
        return (await response.json()) as SessionDetail;
      })
    )
      .then((details) => {
        if (!cancelled) {
          setCompareDetails(details);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compareSessionIds, onError]);

  return {
    sessions,
    setSessions,
    refreshSessions,
    activeHistoryId,
    setActiveHistoryId,
    historyDetail,
    setHistoryDetail,
    loadingHistory,
    loadHistory,
    deleteHistory,
    compareSessionIds,
    setCompareSessionIds,
    compareDetails,
  };
}
