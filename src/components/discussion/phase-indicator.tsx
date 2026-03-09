'use client';

import { Badge } from '@/components/ui/badge';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  opening: { label: '开场', color: 'bg-blue-500' },
  initial_responses: { label: '独立发言', color: 'bg-green-500' },
  analysis: { label: '分析', color: 'bg-yellow-500' },
  debate: { label: '辩论', color: 'bg-orange-500' },
  convergence: { label: '收敛', color: 'bg-purple-500' },
  summary: { label: '总结', color: 'bg-emerald-500' },
  completed: { label: '完成', color: 'bg-gray-500' },
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
  const phaseInfo = PHASE_LABELS[phase] ?? { label: phase || '就绪', color: 'bg-gray-400' };

  return (
    <div className="flex items-center gap-3">
      <Badge
        variant="secondary"
        className={`${phaseInfo.color} text-white px-3 py-1`}
      >
        {phaseInfo.label}
      </Badge>
      {round > 0 && (
        <span className="text-sm text-muted-foreground">第 {round + 1} 轮</span>
      )}
      {moderator && !isRunning && (
        <span className="text-xs text-muted-foreground">MC: {moderator}</span>
      )}
      {isRunning && (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          讨论进行中
        </span>
      )}
    </div>
  );
}
