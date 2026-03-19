import type { DecisionBrief, DecisionSummary, DecisionSummaryEvidence, TrustValidationResult, TrustViolation, ClaimType, VerificationStatus } from './types';

export function validateDecisionSummary(
  summary: DecisionSummary,
  brief: DecisionBrief,
  sourceCount: number
): TrustValidationResult {
  const violations: TrustViolation[] = [];

  // Rule: nextActions_empty
  if (!summary.nextActions || summary.nextActions.length === 0) {
    violations.push({
      field: 'nextActions',
      rule: 'nextActions_empty',
      severity: 'error',
      message: '决策摘要缺少下一步行动项',
    });
  }

  // Rule: redLines_empty
  if (!summary.redLines || summary.redLines.length === 0) {
    violations.push({
      field: 'redLines',
      rule: 'redLines_empty',
      severity: 'error',
      message: '决策摘要缺少红线条件',
    });
  }

  // Rule: revisitTriggers_empty
  if (!summary.revisitTriggers || summary.revisitTriggers.length === 0) {
    violations.push({
      field: 'revisitTriggers',
      rule: 'revisitTriggers_empty',
      severity: 'error',
      message: '决策摘要缺少复盘触发条件',
    });
  }

  // Rule: evidence_missing
  if (!summary.evidence || summary.evidence.length === 0) {
    violations.push({
      field: 'evidence',
      rule: 'evidence_missing',
      severity: 'error',
      message: '决策摘要缺少证据列表',
    });
  }

  // Rule: evidence_all_gaps (only check if evidence exists)
  if (summary.evidence && summary.evidence.length > 0) {
    const allGaps = summary.evidence.every(
      (e) => (!e.sourceIds || e.sourceIds.length === 0) && e.gapReason
    );
    if (allGaps) {
      violations.push({
        field: 'evidence',
        rule: 'evidence_all_gaps',
        severity: 'warning',
        message: '所有证据条目均为空白说明，无任何来源引用',
      });
    }
  }

  // Rule: why_no_evidence
  if (summary.why && summary.why.length > 0 && summary.evidence && summary.evidence.length > 0) {
    const hasAnySourceIds = summary.evidence.some(
      (e) => e.sourceIds && e.sourceIds.length > 0
    );
    if (!hasAnySourceIds) {
      violations.push({
        field: 'why',
        rule: 'why_no_evidence',
        severity: 'warning',
        message: '推荐理由存在，但所有证据均无来源引用支撑',
      });
    }
  }

  // Rule: confidence_no_sources
  if (summary.confidence >= 70 && summary.evidence && summary.evidence.length > 0) {
    const hasAnySourceIds = summary.evidence.some(
      (e) => e.sourceIds && e.sourceIds.length > 0
    );
    if (!hasAnySourceIds) {
      violations.push({
        field: 'confidence',
        rule: 'confidence_no_sources',
        severity: 'warning',
        message: `置信度为 ${summary.confidence}（≥70）但没有任何来源引用`,
      });
    }
  }

  // Rule: gap_as_conclusion
  // Check if any evidence with only gapReason (no sourceIds) has its claim appearing in why or recommendedOption
  if (summary.evidence && summary.evidence.length > 0) {
    const gapClaims = summary.evidence
      .filter((e) => (!e.sourceIds || e.sourceIds.length === 0) && e.gapReason && e.claim)
      .map((e) => e.claim.toLowerCase());

    const conclusionText = [
      summary.recommendedOption || '',
      ...(summary.why || []),
    ]
      .join(' ')
      .toLowerCase();

    const usedAsConclusion = gapClaims.some((claim) =>
      conclusionText.includes(claim.slice(0, Math.min(claim.length, 20)))
    );

    if (usedAsConclusion) {
      violations.push({
        field: 'evidence',
        rule: 'gap_as_conclusion',
        severity: 'warning',
        message: '部分证据空白（gapReason）的内容被用作推荐结论，存在以缺失证据支撑结论的风险',
      });
    }
  }

  // Rule: recommendation_missing
  if (!summary.recommendedOption || summary.recommendedOption.trim() === '') {
    violations.push({
      field: 'recommendedOption',
      rule: 'recommendation_missing',
      severity: 'warning',
      message: '推荐选项为空',
    });
  }

  // Calculate score: start at 100, deduct for violations
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

  return {
    valid: errorCount === 0,
    violations,
    score,
  };
}

// ── T4-1: Claim Gate ──────────────────────────────────────────────────────────

export interface ClaimGateResult {
  passed: boolean;
  blocked: DecisionSummaryEvidence[];
  enriched: DecisionSummaryEvidence[];
}

/**
 * Classifies and gates each evidence item.
 * - requires_evidence + no sourceIds → blocked (must become gap_only)
 * - gap_only → allowed only in gap section, not recommendation body
 * - allowed_without_evidence → passes through
 *
 * Also enriches each item with verificationStatus based on current state.
 */
export function runClaimGate(evidence: DecisionSummaryEvidence[]): ClaimGateResult {
  const blocked: DecisionSummaryEvidence[] = [];
  const enriched: DecisionSummaryEvidence[] = [];

  for (const ev of evidence) {
    const claimType: ClaimType = ev.claimType ?? inferClaimType(ev);
    const verificationStatus: VerificationStatus = inferVerificationStatus(ev);
    const enrichedEv: DecisionSummaryEvidence = { ...ev, claimType, verificationStatus };

    if (claimType === 'requires_evidence' && (!ev.sourceIds || ev.sourceIds.length === 0)) {
      blocked.push(enrichedEv);
    } else {
      enriched.push(enrichedEv);
    }
  }

  return { passed: blocked.length === 0, blocked, enriched };
}

function inferClaimType(ev: DecisionSummaryEvidence): ClaimType {
  if (ev.sourceIds && ev.sourceIds.length > 0) return 'requires_evidence';
  if (ev.gapReason) return 'gap_only';
  return 'requires_evidence';
}

function inferVerificationStatus(ev: DecisionSummaryEvidence): VerificationStatus {
  if (ev.verificationStatus) return ev.verificationStatus;
  if (!ev.sourceIds || ev.sourceIds.length === 0) {
    return ev.gapReason ? 'inferred' : 'ungrounded';
  }
  return 'extracted'; // has sourceIds but not independently verified
}
