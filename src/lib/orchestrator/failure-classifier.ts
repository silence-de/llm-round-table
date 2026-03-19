/**
 * T5-4: Unified error classification for orchestrator failure handling.
 *
 * Three classes:
 * - transient: network timeout, rate limit → auto-retry (max 3, exponential backoff)
 * - degraded: single agent failure, partial research → skip + annotate gap
 * - terminal: session data corruption, unrecoverable LLM error → stop + notify
 */

export type FailureClass = 'transient' | 'degraded' | 'terminal';

export interface ClassifiedError {
  failureClass: FailureClass;
  originalError: unknown;
  message: string;
  retryable: boolean;
}

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /rate.?limit/i,
  /429/,
  /503/,
  /network/i,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /socket hang up/i,
];

const TERMINAL_PATTERNS = [
  /invalid.?api.?key/i,
  /authentication/i,
  /401/,
  /403/,
  /session.*corrupt/i,
  /database.*error/i,
];

export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);

  if (TERMINAL_PATTERNS.some((p) => p.test(message))) {
    return { failureClass: 'terminal', originalError: error, message, retryable: false };
  }
  if (TRANSIENT_PATTERNS.some((p) => p.test(message))) {
    return { failureClass: 'transient', originalError: error, message, retryable: true };
  }
  // Default: degraded — skip the failing component, continue session
  return { failureClass: 'degraded', originalError: error, message, retryable: false };
}

/**
 * Exponential backoff delay for transient retries.
 * Attempt 1 → 1s, 2 → 2s, 3 → 4s
 */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}
