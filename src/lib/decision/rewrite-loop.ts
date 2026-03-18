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
  failedDimensions: string[]
) => Promise<DecisionSummary>;

/**
 * 最多 2 轮重写循环
 * 如果 Judge 通过则直接返回；否则触发 rewriter，最多重写 2 次
 * 失败时返回通过维度最多的版本
 */
export async function runRewriteLoop(
  sessionId: string,
  initialSummary: DecisionSummary,
  brief: DecisionBrief,
  ledger: TaskLedger,
  rewriter: SummaryRewriter,
  maxAttempts = 2
): Promise<RewriteLoopResult> {
  let bestSummary = initialSummary;
  let bestEvaluation = evaluateSummary(sessionId, initialSummary, brief, ledger, 1);

  if (bestEvaluation.overallPassed) {
    return {
      finalSummary: bestSummary,
      finalEvaluation: bestEvaluation,
      attempts: 1,
      rewriteTriggered: false,
    };
  }

  for (let attempt = 2; attempt <= maxAttempts + 1; attempt++) {
    const failedDimensions = bestEvaluation.dimensions
      .filter((d) => !d.passed)
      .map((d) => d.name);

    try {
      const rewritten = await rewriter(bestSummary, failedDimensions);
      const evaluation = evaluateSummary(sessionId, rewritten, brief, ledger, attempt);

      // 保留通过维度最多的版本
      if (evaluation.passedCount >= bestEvaluation.passedCount) {
        bestSummary = rewritten;
        bestEvaluation = evaluation;
      }

      if (bestEvaluation.overallPassed) break;
    } catch {
      // rewriter 失败时保留当前最佳版本
      break;
    }
  }

  return {
    finalSummary: bestSummary,
    finalEvaluation: bestEvaluation,
    attempts: Math.min(maxAttempts + 1, 3),
    rewriteTriggered: true,
  };
}
