'use client';

import { motion } from 'framer-motion';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';
import type { AgentMessage, StageMode } from '@/stores/discussion-store';

interface StageAgent {
  id: string;
  displayName: string;
  color: string;
  accentGlow?: string;
  sprite?: string;
  message?: AgentMessage;
}

interface RoundTableStageProps {
  moderator: {
    id: string;
    displayName: string;
    color: string;
    sprite?: string;
    accentGlow?: string;
  };
  moderatorMessage?: string;
  agents: StageAgent[];
  activeSpeakerId?: string | null;
  phase: string;
  isRunning: boolean;
  stageMode: StageMode;
}

function labelPhase(phase: string) {
  const map: Record<string, string> = {
    opening: 'Opening',
    initial_responses: 'Initial',
    analysis: 'Analysis',
    debate: 'Debate',
    summary: 'Summary',
    completed: 'Completed',
  };
  return map[phase] ?? (phase || 'Standby');
}

// Size of the virtual square canvas (px). SVG viewBox + CSS layout both use this.
const CANVAS = 640;
const CENTER = CANVAS / 2; // 320
const ORBIT_RADIUS = 210; // px from center to agent node center

export function RoundTableStage({
  moderator,
  moderatorMessage,
  agents,
  activeSpeakerId,
  phase,
  isRunning,
  stageMode,
}: RoundTableStageProps) {
  const activeAgent = agents.find((a) => a.id === activeSpeakerId);

  // ─── Mobile-hybrid layout ────────────────────────────────────────────────
  if (stageMode === 'mobile-hybrid') {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200/35 bg-[radial-gradient(circle_at_20%_8%,rgba(98,70,234,0.3),transparent_34%),radial-gradient(circle_at_88%_90%,rgba(228,88,88,0.2),transparent_30%),linear-gradient(165deg,#101021,#191b38)] p-4 text-indigo-50">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* Header row */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-200/80">Bridge Stage</p>
            <h2 className="mt-0.5 text-sm font-semibold text-indigo-100">{labelPhase(phase)}</h2>
          </div>
          <span className="rounded-full border border-indigo-300/35 bg-indigo-300/15 px-3 py-1 text-xs font-semibold text-indigo-100">
            {isRunning ? 'Live' : 'Idle'}
          </span>
        </div>

        {/* Compact circular stage */}
        <div className="relative z-10 mx-auto mt-3 flex h-40 w-40 items-center justify-center">
          {/* Moderator */}
          <motion.div
            animate={
              activeSpeakerId === 'moderator'
                ? { boxShadow: '0 0 28px rgba(98,70,234,0.55)' }
                : { boxShadow: '0 0 16px rgba(228,88,88,0.3)' }
            }
            className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 border-rose-300/65 bg-[radial-gradient(circle,#ffe4e4_0%,#e45858_58%,#6246ea_100%)]"
          >
            <div className="rounded-full border border-rose-50/60 bg-black/55 p-2">
              <PixelAgentAvatar seed={moderator.id} color={moderator.color} label={moderator.displayName} sprite={moderator.sprite} size={36} />
            </div>
          </motion.div>

          {/* Orbit dots */}
          {agents.slice(0, 8).map((agent, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(1, Math.min(8, agents.length)) - Math.PI / 2;
            const r = 64;
            const dx = Math.cos(angle) * r;
            const dy = Math.sin(angle) * r;
            const isActive = activeSpeakerId === agent.id;
            return (
              // CSS positioning so framer-motion scale/opacity don't clobber centering
              <div
                key={agent.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `calc(50% + ${dx}px)`, top: `calc(50% + ${dy}px)` }}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.25 : 1, opacity: isActive ? 1 : 0.65 }}
                  transition={{ duration: 0.35 }}
                  className="h-3.5 w-3.5 rounded-full border border-indigo-100/40"
                  style={{
                    backgroundColor: agent.color,
                    boxShadow: isActive ? `0 0 10px ${agent.accentGlow ?? agent.color}` : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Active voice info */}
        <div className="relative z-10 mt-3 rounded-2xl border border-indigo-300/20 bg-black/35 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200/70">Active Voice</p>
          <p className="mt-0.5 text-sm font-semibold text-indigo-50">
            {activeSpeakerId === 'moderator'
              ? `${moderator.displayName} (MC)`
              : activeAgent?.displayName ?? 'Waiting…'}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-indigo-100/75">
            {activeSpeakerId === 'moderator'
              ? moderatorMessage?.slice(0, 120) || 'Preparing…'
              : activeAgent?.message?.content?.slice(0, 120) || 'Waiting for first response.'}
          </p>
        </div>
      </section>
    );
  }

  // ─── Desktop round-table layout ──────────────────────────────────────────
  // Uses a square canvas so orbit positions are a true circle, not an ellipse.
  return (
    <section className="relative overflow-hidden rounded-3xl border border-indigo-200/40 bg-[radial-gradient(circle_at_35%_10%,rgba(98,70,234,0.3),transparent_45%),radial-gradient(circle_at_82%_92%,rgba(228,88,88,0.2),transparent_40%),linear-gradient(160deg,#121629,#1d2142)] p-5 text-indigo-50 md:p-6">
      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none absolute inset-x-16 top-4 h-16 rounded-full bg-indigo-300/10 blur-3xl"
        animate={{ opacity: isRunning ? 0.9 : 0.4 }}
        transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse' }}
      />

      {/* ── Square canvas: aspect-square so orbit is always circular ── */}
      <div className="relative mx-auto w-full" style={{ maxWidth: CANVAS, aspectRatio: '1 / 1' }}>

        {/* SVG spoke lines — viewBox matches CANVAS so coords are 1:1 px */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${CANVAS} ${CANVAS}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {agents.map((agent, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(1, agents.length) - Math.PI / 2;
            const x2 = CENTER + Math.cos(angle) * ORBIT_RADIUS;
            const y2 = CENTER + Math.sin(angle) * ORBIT_RADIUS;
            const isActive = activeSpeakerId === agent.id;
            return (
              <motion.line
                key={`${agent.id}-spoke`}
                x1={CENTER}
                y1={CENTER}
                x2={x2}
                y2={y2}
                stroke={isActive ? (agent.accentGlow ?? agent.color) : 'rgba(209,209,233,0.22)'}
                initial={{ opacity: 0.4 }}
                animate={{
                  opacity: isActive ? 0.9 : 0.4,
                  strokeWidth: isActive ? 1.2 : 0.5,
                }}
                strokeDasharray={isActive ? undefined : '3 5'}
                transition={{ duration: 0.3 }}
              />
            );
          })}
        </svg>

        {/* Agent nodes — CSS positioning (calc) + framer-motion only for scale/glow.
            IMPORTANT: never mix framer-motion x/y with Tailwind -translate-* on the
            same element — framer-motion's inline transform overrides Tailwind's. */}
        {agents.map((agent, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, agents.length) - Math.PI / 2;
          const cx = Math.cos(angle) * ORBIT_RADIUS; // px offset from canvas center
          const cy = Math.sin(angle) * ORBIT_RADIUS;
          const isActive = activeSpeakerId === agent.id;

          return (
            // Outer div: CSS positions node center on orbit using calc + translate
            <div
              key={agent.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${cx}px)`,
                top: `calc(50% + ${cy}px)`,
              }}
            >
              {/* Scale wrapper — framer-motion handles only scale, no position */}
              <motion.div
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Glow wrapper */}
                <motion.div
                  animate={
                    isActive
                      ? { boxShadow: `0 0 0 1.5px ${agent.accentGlow ?? agent.color}, 0 0 22px ${agent.accentGlow ?? agent.color}55` }
                      : { boxShadow: '0 0 0 1px rgba(209,209,233,0.2)' }
                  }
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-indigo-300/30 bg-black/40 px-3 py-2.5 backdrop-blur"
                  style={{ minWidth: 80 }}
                >
                  <div className="relative">
                    <PixelAgentAvatar
                      seed={agent.id}
                      color={agent.color}
                      label={agent.displayName}
                      size={40}
                      sprite={agent.sprite}
                    />
                    {isActive && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]" />
                    )}
                    {agent.message?.isStreaming && !isActive && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400/80" />
                    )}
                  </div>

                  <span className="max-w-[80px] truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100/80">
                    {agent.displayName}
                  </span>

                  {isActive && (
                    <span className="rounded-full border border-indigo-300/50 bg-indigo-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-indigo-200">
                      live
                    </span>
                  )}
                </motion.div>
              </motion.div>
            </div>
          );
        })}

        {/* Moderator at center — static CSS positioning, framer-motion only on inner glow */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={
              activeSpeakerId === 'moderator'
                ? { boxShadow: `0 0 0 18px ${moderator.accentGlow ?? '#6246ea'}33, 0 0 60px ${moderator.accentGlow ?? '#e45858'}55` }
                : { boxShadow: '0 0 0 12px rgba(228,88,88,0.15), 0 0 50px rgba(98,70,234,0.25)' }
            }
            style={{ borderRadius: '50%' }}
          >
          <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-4 border-rose-300/70 bg-[radial-gradient(circle,#ffe6e6_0%,#e45858_50%,#6246ea_100%)]">
            <div className="flex h-[138px] w-[138px] flex-col items-center justify-center rounded-full border border-rose-50/60 bg-black/55 px-3 text-center">
              <PixelAgentAvatar
                seed={moderator.id}
                color={moderator.color}
                label={moderator.displayName}
                size={44}
                sprite={moderator.sprite}
              />
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-rose-100/80">
                {activeSpeakerId === 'moderator' ? 'Moderating' : 'MC'}
              </p>
              <p className="mt-0.5 line-clamp-2 max-w-full text-[10px] leading-snug text-rose-100/90">
                {moderatorMessage?.slice(0, 60) || moderator.displayName}
              </p>
            </div>
          </div>
          </motion.div>
        </div>
      </div>{/* end canvas square */}

      {/* Legend bar */}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-indigo-200/15 pt-3 text-xs text-indigo-100/65">
        <p className="hidden sm:block">
          {isRunning
            ? 'Highlighted nodes are speaking. Follow active spokes.'
            : 'Prime the council with a topic to begin.'}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-300 shadow-[0_0_10px_rgba(165,180,252,0.8)]" />
            Speaking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-300" />
            MC
          </span>
          <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-2 py-0.5 font-semibold text-indigo-100/90">
            {labelPhase(phase)}
          </span>
        </div>
      </div>
    </section>
  );
}
