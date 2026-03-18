import type { ExtractedEvidence } from './ledger-extractor';
import type { TaskLedger } from './types';

export interface EvidenceCoverageResult {
  coverageRate: number;       // 0-1
  coveredCount: number;
  totalCount: number;
  passed: boolean;            // coverageRate >= threshold
  threshold: number;
}

export interface RiskDisclosureResult {
  disclosed: boolean;
  riskCount: number;
  highSeverityCount: number;
}

export interface LedgerValidationResult {
  evidenceCoverage: EvidenceCoverageResult;
  riskDisclosure: RiskDisclosureResult;
  overallPassed: boolean;
  sessionId: string;
  evaluatedAt: number;
}

const EVIDENCE_COVERAGE_THRESHOLD = 0.85;

/**
 * 校验 evidence 覆盖率
 * 定义：有 citationLabel（hasSource=true）的 claim 占总 claim 数的比例
 */
export function validateEvidenceCoverage(
  evidence: ExtractedEvidence[],
  threshold = EVIDENCE_COVERAGE_THRESHOLD
): EvidenceCoverageResult {
  if (evidence.length === 0) {
    return { coverageRate: 0, coveredCount: 0, totalCount: 0, passed: false, threshold };
  }
  const coveredCount = evidence.filter((e) => e.hasSource).length;
  const coverageRate = coveredCount / evidence.length;
  return {
    coverageRate,
    coveredCount,
    totalCount: evidence.length,
    passed: coverageRate >= threshold,
    threshold,
  };
}

/**
 * 校验风险披露
 * 要求：ledger 中至少有 1 条风险记录
 */
export function validateRiskDisclosure(ledger: TaskLedger): RiskDisclosureResult {
  const riskCount = ledger.riskRegister.length;
  const highSeverityCount = ledger.riskRegister.filter((r) => r.severity === 'high').length;
  return {
    disclosed: riskCount > 0,
    riskCount,
    highSeverityCount,
  };
}

/**
 * 综合校验
 */
export function validateLedger(
  sessionId: string,
  ledger: TaskLedger,
  evidence: ExtractedEvidence[]
): LedgerValidationResult {
  const evidenceCoverage = validateEvidenceCoverage(evidence);
  const riskDisclosure = validateRiskDisclosure(ledger);
  return {
    evidenceCoverage,
    riskDisclosure,
    overallPassed: evidenceCoverage.passed && riskDisclosure.disclosed,
    sessionId,
    evaluatedAt: Date.now(),
  };
}
