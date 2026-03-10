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
          initial={{ opacity: 0.75 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.9 }}
          className="rt-chip-live flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--rt-stage-glow-secondary)] shadow-[0_0_12px_color-mix(in_srgb,var(--rt-stage-glow-secondary)_78%,transparent)]" />
          讨论进行中
        </motion.span>
      )}
    </div>
  );
}
