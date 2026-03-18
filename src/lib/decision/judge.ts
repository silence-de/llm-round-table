import type { DecisionSummary, DecisionBrief } from './types';
import type { TaskLedger } from '../orchestrator/types';

export interface JudgeDimension {
  name: string;
  passed: boolean;
  score: number;   // 0-100
  reason: string;
}

export interface JudgeEvaluationResult {
  dimensions: JudgeDimension[];
  overallPassed: boolean;
  passedCount: number;
  totalDimensions: number;
  sessionId: string;
  summaryVersion: number;
  evaluatedAt: number;
}

/**
 * 维度1：Brief 约束遵守度
 * 检查 summary 是否覆盖了 brief 的 nonNegotiables 和 constraints
 */
export function evaluateBriefConstraintAdherence(
  summary: DecisionSummary,
  brief: DecisionBrief,
  ledger: TaskLedger
): JudgeDimension {
  const nonNegotiables = ledger.nonNegotiables;
  if (nonNegotiables.length === 0) {
    return { name: 'brief_constraint_adherence', passed: true, score: 100, reason: '无不可妥协项，自动通过' };
  }
  // 检查 summary.redLines 是否覆盖了 nonNegotiables
  const redLines = summary.redLines ?? [];
  const covered = nonNegotiables.filter((nn) =>
    redLines.some((rl) => rl.includes(nn.slice(0, 10)))
  ).length;
  const score = Math.round((covered / nonNegotiables.length) * 100);
  return {
    name: 'brief_constraint_adherence',
    passed: score >= 60,
    score,
    reason: `${covered}/${nonNegotiables.length} 不可妥协项在 redLines 中有对应`,
  };
}

/**
 * 维度2：Evidence 覆盖率
 * 检查 summary.evidence 中有 sourceIds 的比例
 */
export function evaluateEvidenceCoverage(summary: DecisionSummary): JudgeDimension {
  const evidence = summary.evidence ?? [];
  if (evidence.length === 0) {
    return { name: 'evidence_coverage', passed: false, score: 0, reason: '无 evidence 条目' };
  }
  const withSource = evidence.filter((e) => e.sourceIds && e.sourceIds.length > 0).length;
  const score = Math.round((withSource / evidence.length) * 100);
  return {
    name: 'evidence_coverage',
    passed: score >= 50,
    score,
    reason: `${withSource}/${evidence.length} 条 evidence 有 sourceIds`,
  };
}

/**
 * 维度3：风险披露完整性
 * 检查 summary.risks 是否非空，且 ledger.riskRegister 中的 high severity 风险有对应
 */
export function evaluateRiskDisclosure(
  summary: DecisionSummary,
  ledger: TaskLedger
): JudgeDimension {
  const risks = summary.risks ?? [];
  if (risks.length === 0) {
    return { name: 'risk_disclosure', passed: false, score: 0, reason: 'summary.risks 为空' };
  }
  const highRisks = ledger.riskRegister.filter((r) => r.severity === 'high');
  if (highRisks.length === 0) {
    return { name: 'risk_disclosure', passed: true, score: 80, reason: '无 high severity 风险，risks 非空即通过' };
  }
  const covered = highRisks.filter((hr) =>
    risks.some((r) => r.includes(hr.description.slice(0, 15)))
  ).length;
  const score = Math.round((covered / highRisks.length) * 100);
  return {
    name: 'risk_disclosure',
    passed: score >= 50,
    score,
    reason: `${covered}/${highRisks.length} 高风险项在 summary.risks 中有对应`,
  };
}

/**
 * 维度4：内部一致性
 * 检查 summary.recommendedOption 与 summary.why 是否非空，
 * 且 summary.alternativesRejected 非空（有对比分析）
 */
export function evaluateInternalConsistency(summary: DecisionSummary): JudgeDimension {
  const checks = [
    Boolean(summary.recommendedOption?.trim()),
    (summary.why?.length ?? 0) > 0,
    (summary.alternativesRejected?.length ?? 0) > 0,
    (summary.nextActions?.length ?? 0) > 0,
  ];
  const passed = checks.filter(Boolean).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    name: 'internal_consistency',
    passed: score >= 75,
    score,
    reason: `${passed}/${checks.length} 一致性检查通过（recommendation/why/alternatives/nextActions）`,
  };
}

/**
 * 综合评审
 */
export function evaluateSummary(
  sessionId: string,
  summary: DecisionSummary,
  brief: DecisionBrief,
  ledger: TaskLedger,
  summaryVersion = 1
): JudgeEvaluationResult {
  const dimensions = [
    evaluateBriefConstraintAdherence(summary, brief, ledger),
    evaluateEvidenceCoverage(summary),
    evaluateRiskDisclosure(summary, ledger),
    evaluateInternalConsistency(summary),
  ];
  const passedCount = dimensions.filter((d) => d.passed).length;
  return {
    dimensions,
    overallPassed: passedCount >= 3,  // 4 维度中至少 3 个通过
    passedCount,
    totalDimensions: dimensions.length,
    sessionId,
    summaryVersion,
    evaluatedAt: Date.now(),
  };
}
