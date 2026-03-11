import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AUTH_MISSING_KEY'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT_STARTUP'
  | 'TIMEOUT_IDLE'
  | 'TIMEOUT_REQUEST'
  | 'RATE_LIMITED'
  | 'PARSE_FAILED'
  | 'ACTION_INVALID_TRANSITION'
  | 'ACTION_VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  error: string;
  code: ApiErrorCode;
  details?: Record<string, unknown>;
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  const payload: ApiErrorPayload = {
    error: message,
    code,
    ...(details ? { details } : {}),
  };
  return NextResponse.json(payload, { status });
}

export function toClientErrorMessage(input: unknown, fallback: string) {
  if (!input || typeof input !== 'object') return fallback;
  const record = input as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const error = typeof record.error === 'string' ? record.error : '';
  if (error && code) return `[${code}] ${error}`;
  if (error) return error;
  return fallback;
}
