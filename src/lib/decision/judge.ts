import type { DecisionSummary, DecisionBrief } from './types';
import type { TaskLedger } from '../orchestrator/types';

// ── Gate types ────────────────────────────────────────────────────────────────

export type JudgeGate = 'PASS' | 'REWRITE' | 'ESCALATE';

export interface JudgeDimension {
  name: string;
  result: 'PASS' | 'FAIL' | 'WARN' | 'ABSTAIN';
  issueCode?: string;
  evidencePointers?: string[];
  actionableFixes?: string[];
  /** @internal not exposed to UI or API responses */
  _score?: number;
}

export interface JudgeEvaluationResult {
  gate: JudgeGate;
  dimensions: JudgeDimension[];
  rewriteInstructions?: string[];   // only when gate === 'REWRITE'
  escalateReason?: string;          // only when gate === 'ESCALATE'
  passedCount: number;
  totalDimensions: number;
  sessionId: string;
  summaryVersion: number;
  evaluatedAt: number;
  /** @deprecated kept for backward-compat with existing DB writes; do not use in UI */
  overallPassed: boolean;
}

// ── L0: structural field checks (<100ms, no LLM) ─────────────────────────────

export interface PreCheckResult {
  passed: boolean;
  layer: 'L0' | 'L1';
  issues: string[];
}

export function runL0Checks(summary: DecisionSummary): PreCheckResult {
  const issues: string[] = [];

  if (!summary.summary?.trim()) issues.push('summary 字段为空');
  if (!summary.recommendedOption?.trim()) issues.push('recommendedOption 字段为空');
  if (!summary.why || summary.why.length === 0) issues.push('why 字段为空数组');
  if (!summary.risks || summary.risks.length === 0) issues.push('risks 字段为空���组');
  if (!summary.nextActions || summary.nextActions.length === 0) issues.push('nextActions 字段为空数组');
  if (!summary.evidence || summary.evidence.length === 0) issues.push('evidence 字段为空数组');
  if (typeof summary.confidence !== 'number') issues.push('confidence 字段缺失或非数字');

  return { passed: issues.length === 0, layer: 'L0', issues };
}

export function runL1Checks(
  summary: DecisionSummary,
  /**
   * Set of known citation labels (e.g. "R1", "R2") — NOT raw DB source IDs.
   * Build this from `researchSources.map(getResearchSourceCitationLabel)`.
   * Using raw IDs here would cause false positives since summaries always
   * reference sources by citation label, never by internal DB id.
   */
  knownCitationLabels: Set<string>
): PreCheckResult {
  const issues: string[] = [];

  // Check evidence sourceIds resolve against known citation labels
  if (summary.evidence) {
    for (const ev of summary.evidence) {
      if (ev.sourceIds && ev.sourceIds.length > 0) {
        for (const label of ev.sourceIds) {
          if (!knownCitationLabels.has(label.trim())) {
            issues.push(`evidence sourceId "${label}" 无对应 citation label（已知：${[...knownCitationLabels].join(', ')}）`);
          }
        }
      }
    }
  }

  // risks content quality (L0 already caught empty array)
  if (summary.risks && summary.risks.length > 0 && summary.risks.every((r) => !r?.trim())) {
    issues.push('risks 数组中所有条目均为空字符串');
  }

  return { passed: issues.length === 0, layer: 'L1', issues };
}

// ── Dimension evaluators ──────────────────────────────────────────────────────

/**
 * Hard dimension: brief constraint adherence
 * FAIL blocks PASS gate.
 */
export function evaluateBriefConstraintAdherence(
  summary: DecisionSummary,
  _brief: DecisionBrief,
  ledger: TaskLedger
): JudgeDimension {
  const nonNegotiables = ledger.nonNegotiables;
  if (nonNegotiables.length === 0) {
    return { name: 'brief_constraint_adherence', result: 'PASS', _score: 100 };
  }
  const redLines = summary.redLines ?? [];
  const covered = nonNegotiables.filter((nn) =>
    redLines.some((rl) => rl.includes(nn.slice(0, 10)))
  ).length;
  const score = Math.round((covered / nonNegotiables.length) * 100);
  if (score >= 60) {
    return { name: 'brief_constraint_adherence', result: 'PASS', _score: score };
  }
  return {
    name: 'brief_constraint_adherence',
    result: 'FAIL',
    issueCode: 'missing_constraint_coverage',
    evidencePointers: [`covered ${covered}/${nonNegotiables.length} nonNegotiables`],
    actionableFixes: ['在 redLines 中补充对应不可妥协项的约束条件'],
    _score: score,
  };
}

/**
 * Hard dimension: evidence coverage
 * FAIL blocks PASS gate.
 */
export function evaluateEvidenceCoverage(summary: DecisionSummary): JudgeDimension {
  const evidence = summary.evidence ?? [];
  if (evidence.length === 0) {
    return {
      name: 'evidence_coverage',
      result: 'FAIL',
      issueCode: 'no_evidence',
      actionableFixes: ['添加至少一条有 sourceIds 的 evidence 条目'],
      _score: 0,
    };
  }
  const withSource = evidence.filter((e) => e.sourceIds && e.sourceIds.length > 0).length;
  const score = Math.round((withSource / evidence.length) * 100);
  if (score >= 50) {
    return { name: 'evidence_coverage', result: 'PASS', _score: score };
  }
  return {
    name: 'evidence_coverage',
    result: 'FAIL',
    issueCode: 'insufficient_evidence_coverage',
    evidencePointers: [`${withSource}/${evidence.length} 条 evidence 有 sourceIds`],
    actionableFixes: ['为无来源的 evidence 条目补充 sourceIds 或改为 gapReason'],
    _score: score,
  };
}

/**
 * Hard dimension: risk disclosure
 * FAIL blocks PASS gate.
 */
export function evaluateRiskDisclosure(
  summary: DecisionSummary,
  ledger: TaskLedger
): JudgeDimension {
  const risks = summary.risks ?? [];
  if (risks.length === 0) {
    return {
      name: 'risk_disclosure',
      result: 'FAIL',
      issueCode: 'missing_risk_disclosure',
      actionableFixes: ['在 risks 字段中补充至少一条风险披露'],
      _score: 0,
    };
  }
  const highRisks = ledger.riskRegister.filter((r) => r.severity === 'high');
  if (highRisks.length === 0) {
    return { name: 'risk_disclosure', result: 'PASS', _score: 80 };
  }
  const covered = highRisks.filter((hr) =>
    risks.some((r) => r.includes(hr.description.slice(0, 15)))
  ).length;
  const score = Math.round((covered / highRisks.length) * 100);
  if (score >= 50) {
    return { name: 'risk_disclosure', result: 'PASS', _score: score };
  }
  return {
    name: 'risk_disclosure',
    result: 'FAIL',
    issueCode: 'missing_risk_disclosure',
    evidencePointers: [`${covered}/${highRisks.length} 高风险项在 summary.risks ���有对应`],
    actionableFixes: highRisks
      .filter((hr) => !risks.some((r) => r.includes(hr.description.slice(0, 15))))
      .map((hr) => `补充风险披露：${hr.description}`),
    _score: score,
  };
}

/**
 * Soft dimension: internal consistency
 * WARN does not block PASS gate.
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
  if (score >= 75) {
    return { name: 'internal_consistency', result: 'PASS', _score: score };
  }
  return {
    name: 'internal_consistency',
    result: 'WARN',
    issueCode: 'incomplete_structure',
    evidencePointers: [`${passed}/${checks.length} 一致性检查通过`],
    actionableFixes: [
      !summary.recommendedOption?.trim() ? '补充 recommendedOption' : null,
      (summary.why?.length ?? 0) === 0 ? '补充 why 列表' : null,
      (summary.alternativesRejected?.length ?? 0) === 0 ? '补充 alternativesRejected' : null,
      (summary.nextActions?.length ?? 0) === 0 ? '补充 nextActions' : null,
    ].filter((x): x is string => x !== null),
    _score: score,
  };
}

// ── Gate determination ────────────────────────────────────────────────────────

const HARD_DIMENSIONS = new Set([
  'brief_constraint_adherence',
  'evidence_coverage',
  'risk_disclosure',
]);

function determineGateWithSet(
  dimensions: JudgeDimension[],
  hardDimensions: Set<string>,
  rewriteCount: number,
  maxRewrites: number
): { gate: JudgeGate; rewriteInstructions?: string[]; escalateReason?: string } {
  const hasAbstain = dimensions.some((d) => d.result === 'ABSTAIN');
  const hardFails = dimensions.filter(
    (d) => hardDimensions.has(d.name) && d.result === 'FAIL'
  );

  if (hasAbstain) {
    return { gate: 'ESCALATE', escalateReason: '存在 ABSTAIN 维度，无法自动判定' };
  }

  if (hardFails.length === 0) {
    return { gate: 'PASS' };
  }

  if (rewriteCount >= maxRewrites) {
    return {
      gate: 'ESCALATE',
      escalateReason: `已达最大重写次数 (${maxRewrites})，仍有 ${hardFails.length} 个硬性维度未通过`,
    };
  }

  const rewriteInstructions = hardFails.flatMap((d) => d.actionableFixes ?? []);
  return { gate: 'REWRITE', rewriteInstructions };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function evaluateSummary(
  sessionId: string,
  summary: DecisionSummary,
  brief: DecisionBrief,
  ledger: TaskLedger,
  summaryVersion = 1,
  rewriteCount = 0,
  maxRewrites = 2,
  /**
   * Pre-check results from L0/L1 (pass these in so they drive the gate,
   * not just get logged as session events).
   */
  preChecks?: { l0?: PreCheckResult; l1?: PreCheckResult }
): JudgeEvaluationResult {
  const dimensions: JudgeDimension[] = [];

  // Inject L0 failures as a hard FAIL dimension before LLM dimensions
  if (preChecks?.l0 && !preChecks.l0.passed) {
    dimensions.push({
      name: 'structural_completeness',
      result: 'FAIL',
      issueCode: 'l0_structural_fail',
      evidencePointers: preChecks.l0.issues,
      actionableFixes: preChecks.l0.issues.map((issue) => `修复：${issue}`),
    });
  }

  // Inject L1 failures as a hard FAIL dimension
  if (preChecks?.l1 && !preChecks.l1.passed) {
    dimensions.push({
      name: 'citation_resolvability',
      result: 'FAIL',
      issueCode: 'l1_citation_fail',
      evidencePointers: preChecks.l1.issues,
      actionableFixes: preChecks.l1.issues.map((issue) => `修复：${issue}`),
    });
  }

  // LLM-based dimensions
  dimensions.push(
    evaluateBriefConstraintAdherence(summary, brief, ledger),
    evaluateEvidenceCoverage(summary),
    evaluateRiskDisclosure(summary, ledger),
    evaluateInternalConsistency(summary)
  );

  const EFFECTIVE_HARD_DIMENSIONS = new Set([
    ...HARD_DIMENSIONS,
    'structural_completeness',
    'citation_resolvability',
  ]);

  const passedCount = dimensions.filter((d) => d.result === 'PASS').length;
  const { gate, rewriteInstructions, escalateReason } = determineGateWithSet(
    dimensions,
    EFFECTIVE_HARD_DIMENSIONS,
    rewriteCount,
    maxRewrites
  );

  return {
    gate,
    dimensions,
    rewriteInstructions,
    escalateReason,
    passedCount,
    totalDimensions: dimensions.length,
    sessionId,
    summaryVersion,
    evaluatedAt: Date.now(),
    overallPassed: gate === 'PASS',
  };
}
