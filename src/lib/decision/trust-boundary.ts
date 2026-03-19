/**
 * T4-2: Untrusted content scan — injection detection for external research sources.
 *
 * External page content is untrusted by default. This module detects prompt
 * injection patterns and assigns a suspicion level. High-suspicion content is
 * isolated for manual review rather than hard-blocked (avoids false positives
 * while the detection baseline matures).
 */

export type SuspicionLevel = 'low' | 'medium' | 'high';

export interface ContentScanResult {
  suspicionLevel: SuspicionLevel;
  matchedPatterns: string[];
  recommendation: 'allow' | 'flag' | 'isolate';
}

// Patterns that indicate likely prompt injection attempts
const HIGH_RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'ignore_instructions', pattern: /ignore\s+(previous|prior|all)\s+instructions/i },
  { label: 'you_are_now', pattern: /you\s+are\s+now\s+(a|an|the)\s+/i },
  { label: 'disregard_context', pattern: /disregard\s+(the\s+)?(above|previous|prior|context)/i },
  { label: 'new_instructions', pattern: /new\s+instructions?\s*:/i },
  { label: 'system_prompt_override', pattern: /\[system\]|\[INST\]|<\|system\|>/i },
  { label: 'jailbreak_trigger', pattern: /DAN\s+mode|jailbreak|do\s+anything\s+now/i },
];

const MEDIUM_RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'role_play_trigger', pattern: /pretend\s+(you\s+are|to\s+be)|act\s+as\s+(if\s+you\s+are|a\s+)/i },
  { label: 'forget_instructions', pattern: /forget\s+(everything|all|your)\s+(you\s+know|instructions|training)/i },
  { label: 'hidden_text_block', pattern: /\S{500,}/ }, // >500 chars no whitespace
];

export function scanForSuspiciousContent(pageContent: string): ContentScanResult {
  const matchedHigh: string[] = [];
  const matchedMedium: string[] = [];

  for (const { label, pattern } of HIGH_RISK_PATTERNS) {
    if (pattern.test(pageContent)) matchedHigh.push(label);
  }
  for (const { label, pattern } of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(pageContent)) matchedMedium.push(label);
  }

  if (matchedHigh.length > 0) {
    return {
      suspicionLevel: 'high',
      matchedPatterns: matchedHigh,
      // Isolate for manual review — do NOT auto-block to avoid false positives
      recommendation: 'isolate',
    };
  }
  if (matchedMedium.length > 0) {
    return {
      suspicionLevel: 'medium',
      matchedPatterns: matchedMedium,
      recommendation: 'flag',
    };
  }
  return { suspicionLevel: 'low', matchedPatterns: [], recommendation: 'allow' };
}

/**
 * Apply scan result to a research source's qualityFlags.
 * Returns updated qualityFlags array (immutable).
 */
export function applyInjectionScanToFlags(
  qualityFlags: string[],
  scanResult: ContentScanResult
): string[] {
  const flags = qualityFlags.filter(
    (f) => f !== 'injection_risk_medium' && f !== 'manual_review_required'
  );
  if (scanResult.recommendation === 'isolate') {
    flags.push('manual_review_required');
  } else if (scanResult.recommendation === 'flag') {
    flags.push('injection_risk_medium');
  }
  return flags;
}
