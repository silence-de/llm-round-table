/**
 * T6-2: Follow-up injection whitelist.
 *
 * Only structured decision state enters the new session prompt.
 * Raw transcripts, low-confidence guesses, expired lessons, and
 * full thought chains are explicitly excluded.
 */
import type { Lesson, SessionEndReflection } from './types';
import { canPromoteLesson } from './reflection';

export interface FollowUpContext {
  decisionSummary: string;
  openAssumptions: string[];
  evidenceGaps: string[];
  activeLessons: string[];
  /** Estimated token count (rough: chars / 4) */
  estimatedTokens: number;
}

/**
 * Build the whitelist-filtered context for a follow-up session.
 *
 * Allowed:
 *   - decisionSummary (last conclusion)
 *   - assumptionsWithStatus where status === 'open'
 *   - evidenceGaps (all)
 *   - lessons where status === 'active' AND patternCount >= 3 AND not expired
 *
 * Explicitly excluded:
 *   - raw transcript / thought chains
 *   - low-confidence old guesses
 *   - expired / contradicted lessons
 *   - full lessonsCandidate list (candidates not yet promoted)
 */
export function buildFollowUpContext(
  reflection: SessionEndReflection,
  lessons: Lesson[]
): FollowUpContext {
  const openAssumptions = reflection.assumptionsWithStatus
    .filter((a) => a.status === 'open')
    .map((a) => `${a.text}${a.howToFalsify ? ` (falsifiable: ${a.howToFalsify})` : ''}`);

  const evidenceGaps = reflection.evidenceGaps.map(
    (g) => `${g.topic}: ${g.gapReason}${g.nextAction ? ` → ${g.nextAction}` : ''}`
  );

  // Only inject active, promoted, non-expired lessons
  const activeLessons = lessons
    .filter(
      (l) =>
        l.status === 'active' &&
        canPromoteLesson(l) &&
        l.conflictMarker == null
    )
    .map((l) => l.rule);

  const parts = [
    reflection.decisionSummary,
    ...openAssumptions,
    ...evidenceGaps,
    ...activeLessons,
  ];
  const estimatedTokens = Math.ceil(parts.join(' ').length / 4);

  return {
    decisionSummary: reflection.decisionSummary,
    openAssumptions,
    evidenceGaps,
    activeLessons,
    estimatedTokens,
  };
}

/**
 * Render the follow-up context as a prompt string.
 * Used when injecting into the new session's system prompt.
 */
export function renderFollowUpContextPrompt(ctx: FollowUpContext): string {
  const lines: string[] = [];

  if (ctx.decisionSummary) {
    lines.push(`上次决策结论：${ctx.decisionSummary}`);
  }

  if (ctx.openAssumptions.length > 0) {
    lines.push('待验证假设：');
    for (const a of ctx.openAssumptions) {
      lines.push(`  - ${a}`);
    }
  }

  if (ctx.evidenceGaps.length > 0) {
    lines.push('证据缺口：');
    for (const g of ctx.evidenceGaps) {
      lines.push(`  - ${g}`);
    }
  }

  if (ctx.activeLessons.length > 0) {
    lines.push('适用教训：');
    for (const l of ctx.activeLessons) {
      lines.push(`  - ${l}`);
    }
  }

  return lines.join('\n');
}
