'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const PHASE_LABELS: Record<string, { label: string; tone: string }> = {
  research: { label: '网络检索', tone: 'color-mix(in srgb, var(--rt-live-state) 55%, var(--rt-hh6-primary))' },
  opening: { label: '开场', tone: 'var(--rt-stage-glow-primary)' },
  initial_responses: { label: '独立发言', tone: 'var(--rt-live-state)' },
  analysis: {
    label: '分析',
    tone: 'color-mix(in srgb, var(--rt-stage-glow-primary) 65%, var(--rt-hh6-headline))',
  },
  debate: { label: '辩论', tone: 'var(--rt-stage-glow-secondary)' },
  convergence: {
    label: '收敛',
    tone: 'color-mix(in srgb, var(--rt-live-state) 65%, var(--rt-hh6-headline))',
  },
  summary: {
    label: '总结',
    tone: 'color-mix(in srgb, var(--rt-stage-glow-secondary) 45%, var(--rt-stage-glow-primary))',
  },
  completed: {
    label: '完成',
    tone: 'color-mix(in srgb, var(--rt-text-dim) 70%, var(--rt-hh6-headline))',
  },
};

export function PhaseIndicator({
  phase,
  round,
  isRunning,
  moderator,
}: {
  phase: string;
  round: number;
  isRunning: boolean;
  moderator?: string;
}) {
  const phaseInfo = PHASE_LABELS[phase] ?? {
    label: phase || '就绪',
    tone: 'color-mix(in srgb, var(--rt-text-muted) 70%, var(--rt-hh6-headline))',
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <motion.div layout>
        <Badge
          variant="secondary"
          className="px-3 py-1 text-sm font-semibold text-white shadow-sm"
          style={{
            backgroundColor: phaseInfo.tone,
            borderColor: 'color-mix(in srgb, var(--rt-border-strong) 65%, transparent)',
          }}
        >
          {phaseInfo.label}
        </Badge>
      </motion.div>
      {round > 0 && (
        <span className="rt-pill rounded-full border px-3 py-1 text-sm rt-text-strong">
          第 {round + 1} 轮
        </span>
      )}
      {moderator && !isRunning && (
        <span className="text-sm rt-text-muted">MC: {moderator}</span>
      )}
      {isRunning && (
        <motion.span
          initial={{ opacity: 0.82 }}
          animate={{ opacity: [0.82, 1, 0.82], scale: [1, 1.015, 1] }}
          transition={{ duration: 1.35, repeat: Infinity, repeatType: 'mirror', ease: [0.22, 1, 0.36, 1] }}
          className="rt-chip-live flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
        >
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
              animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.7, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]" />
          </span>
          讨论进行中
        </motion.span>
      )}
    </div>
  );
}
