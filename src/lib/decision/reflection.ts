/**
 * T6-1: Session-end reflection writer.
 *
 * Generates a SessionEndReflection from a completed session's transcript
 * using a lightweight LLM summarizer. Called asynchronously after session
 * completes — never blocks the main orchestrator flow.
 */
import { nanoid } from 'nanoid';
import type {
  AssumptionEntry,
  ForecastEntry,
  GapEntry,
  Lesson,
  LessonCandidate,
  SessionEndReflection,
} from '../decision/types';

// ── Reflection persistence (imported lazily to avoid circular deps) ──

export function buildEmptyReflection(sessionId: string): SessionEndReflection {
  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    decisionSummary: '',
    assumptionsWithStatus: [],
    evidenceGaps: [],
    forecastItems: [],
    lessonsCandidate: [],
  };
}

/**
 * Parse LLM-generated reflection JSON, falling back to empty reflection
 * on any parse error. Never throws.
 */
export function parseReflectionJson(
  sessionId: string,
  raw: string
): SessionEndReflection {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionEndReflection>;
    return {
      sessionId,
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      decisionSummary: typeof parsed.decisionSummary === 'string' ? parsed.decisionSummary : '',
      assumptionsWithStatus: normalizeAssumptions(parsed.assumptionsWithStatus),
      evidenceGaps: normalizeGaps(parsed.evidenceGaps),
      forecastItems: normalizeForecastItems(parsed.forecastItems),
      lessonsCandidate: normalizeLessonCandidates(parsed.lessonsCandidate),
    };
  } catch {
    return buildEmptyReflection(sessionId);
  }
}

function normalizeAssumptions(value: unknown): AssumptionEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const status = r.status;
      if (status !== 'confirmed' && status !== 'refuted' && status !== 'open') return null;
      return {
        text: typeof r.text === 'string' ? r.text : '',
        status,
        howToFalsify: typeof r.howToFalsify === 'string' ? r.howToFalsify : '',
      };
    })
    .filter((x): x is AssumptionEntry => x !== null);
}

function normalizeGaps(value: unknown): GapEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      return {
        topic: typeof r.topic === 'string' ? r.topic : '',
        gapReason: typeof r.gapReason === 'string' ? r.gapReason : '',
        nextAction: typeof r.nextAction === 'string' ? r.nextAction : '',
      };
    })
    .filter((x): x is GapEntry => x !== null);
}

function normalizeForecastItems(value: unknown): ForecastEntry[] {
  if (!Array.isArray(value)) return [];
  const result: ForecastEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const probability = Number(r.probability ?? 0);
    if (!Number.isFinite(probability)) continue;
    result.push({
      id: typeof r.id === 'string' ? r.id : nanoid(),
      claim: typeof r.claim === 'string' ? r.claim : '',
      probability: Math.max(0, Math.min(1, probability)),
      deadline: typeof r.deadline === 'string' ? r.deadline : '',
      measurableOutcome: typeof r.measurableOutcome === 'string' ? r.measurableOutcome : '',
      actualOutcome: null,
      brierScore: null,
      resolvedAt: null,
    });
  }
  return result;
}

function normalizeLessonCandidates(value: unknown): LessonCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      return {
        text: typeof r.text === 'string' ? r.text : '',
        sourceSessionId: typeof r.sourceSessionId === 'string' ? r.sourceSessionId : '',
      };
    })
    .filter((x): x is LessonCandidate => x !== null && x.text.length > 0);
}

// ── T6-4: Brier score for binary forecasts ────────────────────────

/**
 * Compute Brier score for a binary forecast.
 * outcome: true = event occurred, false = did not occur.
 * score = (outcome_numeric - probability)^2
 */
export function computeBrierScore(probability: number, outcome: boolean): number {
  const o = outcome ? 1 : 0;
  return Math.round(((o - probability) ** 2) * 10000) / 10000;
}

/**
 * Record a forecast outcome and compute Brier score.
 * Returns updated ForecastEntry.
 */
export function recordForecastOutcome(
  forecast: ForecastEntry,
  actualOutcome: boolean
): ForecastEntry {
  return {
    ...forecast,
    actualOutcome: actualOutcome ? 'true' : 'false',
    brierScore: computeBrierScore(forecast.probability, actualOutcome),
    resolvedAt: new Date().toISOString(),
  };
}

// ── T6-3: Lesson promotion rules ──────────────────────────────────

const MIN_PATTERN_COUNT = 3;
const MIN_EVIDENCE_BASIS = 2;

export function canPromoteLesson(lesson: Pick<Lesson, 'patternCount' | 'evidenceBasis'>): boolean {
  return (
    lesson.patternCount >= MIN_PATTERN_COUNT &&
    lesson.evidenceBasis.length >= MIN_EVIDENCE_BASIS
  );
}

export function isLessonExpired(
  lesson: Pick<Lesson, 'status' | 'expiryPolicy'>,
  sessionsSinceLastReference: number
): boolean {
  if (lesson.status !== 'active') return false;
  return sessionsSinceLastReference > lesson.expiryPolicy.reviewAfterSessions;
}
