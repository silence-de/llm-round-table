import type { DecisionSummary, DecisionBrief } from './types';
import type { TaskLedger } from '../orchestrator/types';
import { evaluateSummary } from './judge';
import type { JudgeEvaluationResult } from './judge';

export interface RewriteLoopResult {
  finalSummary: DecisionSummary;
  finalEvaluation: JudgeEvaluationResult;
  attempts: number;
  rewriteTriggered: boolean;
}

type SummaryRewriter = (
  summary: DecisionSummary,
  rewriteInstructions: string[]
) => Promise<DecisionSummary>;

const MAX_REWRITES = 2;

/**
 * Rewrite loop — hard state-machine counter, max 2 rewrites.
 *
 * Rules (per plan T3-3):
 * - Only surgical fixes: fill missing evidence, fix citation mapping,
 *   remove unsupported claims, add risk disclosure.
 * - Counter is non-LLM controlled; LLM cannot bypass it.
 * - After MAX_REWRITES with remaining FAIL → gate becomes ESCALATE automatically
 *   (handled inside evaluateSummary via rewriteCount param).
 */
export async function runRewriteLoop(
  sessionId: string,
  initialSummary: DecisionSummary,
  brief: DecisionBrief,
  ledger: TaskLedger,
  rewriter: SummaryRewriter
): Promise<RewriteLoopResult> {
  // Attempt 1 — evaluate initial summary (rewriteCount=0)
  let bestSummary = initialSummary;
  let bestEvaluation = evaluateSummary(sessionId, initialSummary, brief, ledger, 1, 0, MAX_REWRITES);

  if (bestEvaluation.gate === 'PASS') {
    return { finalSummary: bestSummary, finalEvaluation: bestEvaluation, attempts: 1, rewriteTriggered: false };
  }

  // Rewrite rounds — counter is the source of truth, not LLM output
  for (let rewriteCount = 1; rewriteCount <= MAX_REWRITES; rewriteCount++) {
    if (bestEvaluation.gate === 'ESCALATE') break;

    const instructions = bestEvaluation.rewriteInstructions ?? [];
    try {
      const rewritten = await rewriter(bestSummary, instructions);
      const evaluation = evaluateSummary(
        sessionId,
        rewritten,
        brief,
        ledger,
        rewriteCount + 1,
        rewriteCount,
        MAX_REWRITES
      );

      // Keep version with most PASS dimensions
      if (evaluation.passedCount >= bestEvaluation.passedCount) {
        bestSummary = rewritten;
        bestEvaluation = evaluation;
      }

      if (bestEvaluation.gate === 'PASS') break;
    } catch {
      // rewriter failure — keep best so far, let gate stand
      break;
    }
  }

  return {
    finalSummary: bestSummary,
    finalEvaluation: bestEvaluation,
    attempts: Math.min(MAX_REWRITES + 1, 3),
    rewriteTriggered: true,
  };
}
