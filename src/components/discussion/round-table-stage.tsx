'use client';

import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';
import type { AgentMessage } from '@/stores/discussion-store';

interface StageAgent {
  id: string;
  displayName: string;
  color: string;
  message?: AgentMessage;
}

export function RoundTableStage({
  moderator,
  moderatorMessage,
  agents,
}: {
  moderator: { id: string; displayName: string; color: string };
  moderatorMessage?: string;
  agents: StageAgent[];
}) {
  const radius = 34;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-200/40 bg-[radial-gradient(circle_at_50%_20%,rgba(22,180,230,0.18),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(255,188,86,0.22),transparent_40%),linear-gradient(160deg,#09121f,#0e1d2f)] p-4 text-cyan-50 md:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative mx-auto flex h-[580px] max-w-5xl items-center justify-center md:h-[640px]">
        {agents.map((agent, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, agents.length) - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const preview = (agent.message?.content ?? '').slice(0, 110);

          return (
            <div
              key={agent.id}
              className="absolute w-[160px] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${x}%)`,
                top: `calc(50% + ${y}%)`,
              }}
            >
              <div className="rounded-xl border border-cyan-200/30 bg-black/35 p-2 backdrop-blur">
                <div className="mb-2 flex justify-center">
                  <PixelAgentAvatar
                    seed={agent.id}
                    color={agent.color}
                    label={agent.displayName}
                    size={48}
                  />
                </div>
                <p className="min-h-[64px] max-h-[88px] overflow-hidden text-[11px] leading-relaxed text-cyan-100/90">
                  {preview || '等待发言...'}
                  {agent.message?.isStreaming && (
                    <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-cyan-300" />
                  )}
                </p>
              </div>
            </div>
          );
        })}

        <div className="relative z-10 flex h-[230px] w-[230px] items-center justify-center rounded-full border-4 border-amber-300/70 bg-[radial-gradient(circle,#ffcf8f_0%,#f2a85f_48%,#b26924_100%)] shadow-[0_0_0_14px_rgba(255,192,120,0.15),0_0_80px_rgba(40,180,255,0.25)]">
          <div className="h-[180px] w-[180px] rounded-full border border-amber-50/60 bg-black/55 p-4 text-center">
            <div className="mb-2 flex justify-center">
              <PixelAgentAvatar
                seed={moderator.id}
                color={moderator.color}
                label={moderator.displayName}
                size={50}
              />
            </div>
            <p className="max-h-[54px] overflow-hidden text-[11px] leading-relaxed text-amber-100">
              {moderatorMessage?.slice(0, 90) || '主持人等待中...'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
