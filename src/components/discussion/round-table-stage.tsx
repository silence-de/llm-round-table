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
    research: 'Research',
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
  const moderatorGlow = moderator.accentGlow ?? 'var(--rt-stage-glow-primary)';

  // ─── Mobile-hybrid layout ────────────────────────────────────────────────
  if (stageMode === 'mobile-hybrid') {
    return (
      <section className="rt-stage-mobile rt-text-strong relative overflow-hidden rounded-3xl border p-4">
        <div className="rt-stage-grid pointer-events-none absolute inset-0 bg-[length:20px_20px] opacity-20" />

        {/* Header row */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="rt-label text-xs uppercase tracking-[0.24em]">Bridge Stage</p>
            <h2 className="rt-text-strong mt-0.5 text-sm font-semibold">{labelPhase(phase)}</h2>
          </div>
          <span className="rt-chip-live rounded-full border px-3 py-1 text-xs font-semibold">
            {isRunning ? 'Live' : 'Idle'}
          </span>
        </div>

        {/* Compact circular stage */}
        <div className="relative z-10 mx-auto mt-3 flex h-40 w-40 items-center justify-center">
          {/* Moderator */}
          <motion.div
            animate={
              activeSpeakerId === 'moderator'
                ? { boxShadow: '0 0 28px color-mix(in srgb, var(--rt-live-state) 55%, transparent)' }
                : { boxShadow: '0 0 16px color-mix(in srgb, var(--rt-stage-glow-secondary) 30%, transparent)' }
            }
            className="rt-moderator-core relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[color:var(--rt-moderator-ring)]"
          >
            <div className="rt-surface-glass rounded-full border p-2">
              <PixelAgentAvatar seed={moderator.id} color={moderator.color} sprite={moderator.sprite} size={36} />
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
                  className="h-3.5 w-3.5 rounded-full border border-[color:var(--rt-border-soft)]"
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
        <div className="rt-surface-glass relative z-10 mt-3 rounded-2xl border p-3">
          <p className="rt-label text-[10px] uppercase tracking-[0.2em]">Active Voice</p>
          <p className="rt-text-strong mt-0.5 text-sm font-semibold">
            {activeSpeakerId === 'moderator'
              ? `${moderator.displayName} (MC)`
              : activeAgent?.displayName ?? 'Waiting…'}
          </p>
          <p className="rt-text-muted mt-0.5 line-clamp-2 text-sm">
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
    <section className="rt-stage rt-text-strong relative overflow-hidden rounded-3xl border p-5 md:p-6">
      {/* Grid texture */}
      <div className="rt-stage-grid pointer-events-none absolute inset-0 bg-[length:24px_24px] opacity-20" />

      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none absolute inset-x-16 top-4 h-16 rounded-full bg-[color-mix(in_srgb,var(--rt-live-state)_15%,transparent)] blur-3xl"
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
                stroke={isActive ? (agent.accentGlow ?? agent.color) : 'var(--rt-border-soft)'}
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
                      : { boxShadow: '0 0 0 1px var(--rt-border-soft)' }
                  }
                  className="rt-surface-glass flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5"
                  style={{ minWidth: 80 }}
                >
                  <div className="relative">
                    <PixelAgentAvatar
                      seed={agent.id}
                      color={agent.color}
                      size={40}
                      sprite={agent.sprite}
                    />
                    {isActive && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--rt-live-state)] shadow-[0_0_8px_color-mix(in_srgb,var(--rt-live-state)_88%,transparent)]" />
                    )}
                    {agent.message?.isStreaming && !isActive && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--rt-warning-state)_80%,transparent)]" />
                    )}
                  </div>

                  <span className="max-w-[80px] truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--rt-text-muted)]">
                    {agent.displayName}
                  </span>

                  {isActive && (
                    <span className="rt-chip-live rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest">
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
                ? { boxShadow: `0 0 0 18px ${moderatorGlow}33, 0 0 60px ${moderatorGlow}66` }
                : { boxShadow: '0 0 0 12px color-mix(in srgb, var(--rt-stage-glow-secondary) 25%, transparent), 0 0 50px color-mix(in srgb, var(--rt-stage-glow-primary) 32%, transparent)' }
            }
            style={{ borderRadius: '50%' }}
          >
          <div className="rt-moderator-core flex h-[180px] w-[180px] items-center justify-center rounded-full border-4 border-[color:var(--rt-moderator-ring)]">
            <div className="rt-surface-glass flex h-[138px] w-[138px] flex-col items-center justify-center rounded-full border px-3 text-center">
              <PixelAgentAvatar
                seed={moderator.id}
                color={moderator.color}
                size={44}
                sprite={moderator.sprite}
              />
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--rt-text-muted)]">
                {activeSpeakerId === 'moderator' ? 'Moderating' : 'MC'}
              </p>
              <p className="mt-0.5 line-clamp-2 max-w-full text-[10px] leading-snug text-[var(--rt-text-strong)]">
                {moderatorMessage?.slice(0, 60) || moderator.displayName}
              </p>
            </div>
          </div>
          </motion.div>
        </div>
      </div>{/* end canvas square */}

      {/* Legend bar */}
      <div className="rt-border-soft rt-text-dim relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <p className="hidden sm:block">
          {isRunning
            ? 'Highlighted nodes are speaking. Follow active spokes.'
            : 'Prime the council with a topic to begin.'}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--rt-live-state)] shadow-[0_0_10px_color-mix(in_srgb,var(--rt-live-state)_85%,transparent)]" />
            Speaking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--rt-moderator-ring)]" />
            MC
          </span>
          <span className="rt-chip-live rounded-full border px-2 py-0.5 font-semibold">
            {labelPhase(phase)}
          </span>
        </div>
      </div>
    </section>
  );
}
