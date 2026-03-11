'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useDiscussionStore } from '@/stores/discussion-store';

const PHASE_LABELS: Record<string, string> = {
  research: '🔍 网络检索开始',
  opening: '🎙️ 开场阶段',
  summary: '📋 进入总结阶段',
  completed: '✅ 讨论完成',
};

export function useToastBridge() {
  const error = useDiscussionStore((s) => s.error);
  const phase = useDiscussionStore((s) => s.phase);
  const isRunning = useDiscussionStore((s) => s.isRunning);

  // Error toasts
  const prevError = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== prevError.current) {
      toast.error(error, { duration: 6000 });
    }
    prevError.current = error;
  }, [error]);

  // Phase change toasts (only while running)
  const prevPhase = useRef('');
  useEffect(() => {
    if (!isRunning || !phase || phase === prevPhase.current) return;
    const label = PHASE_LABELS[phase];
    if (label) {
      toast(label, { duration: 3000 });
    }
    prevPhase.current = phase;
  }, [phase, isRunning]);

  // Session completion toast
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current === true && isRunning === false && prevPhase.current !== '') {
      toast.success('会议已结束', { duration: 5000 });
    }
    prevRunning.current = isRunning;
  }, [isRunning]);
}
