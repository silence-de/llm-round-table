# Code Review Request — Round Table Multi-Agent Decision System

You are reviewing a batch of changes to a production TypeScript/Next.js multi-agent LLM decision system called "Round Table". The system runs structured multi-agent debates, produces decision summaries with evidence, and tracks calibration over time.

Please review the changes across 4 topics (Topics 3–6) for correctness, robustness, and design quality. Focus on real issues — not style preferences.

---

## System Context

- Stack: Next.js 14 App Router, TypeScript strict mode, Drizzle ORM + SQLite (better-sqlite3), SSE streaming
- Core flow: user submits a decision topic → orchestrator runs multi-agent debate phases → judge evaluates the summary → result persisted to DB
- Key invariant: judge gate and rewrite loop must never block the main SSE stream; all evaluation is best-effort

---

## Topic 3 — Judge Gate Redesign

### What changed

**`src/lib/decision/judge.ts`** — Replaced binary pass/fail with a three-state gate:

```ts
type JudgeGate = 'PASS' | 'REWRITE' | 'ESCALATE';

interface JudgeDimension {
  name: string;
  result: 'PASS' | 'FAIL' | 'WARN' | 'ABSTAIN';
  issueCode?: string;
  evidencePointers?: string[];
  actionableFixes?: string[];
  _score?: number; // internal only
}

interface JudgeEvaluationResult {
  gate: JudgeGate;
  dimensions: JudgeDimension[];
  rewriteInstructions?: string[];  // only when gate === 'REWRITE'
  escalateReason?: string;         // only when gate === 'ESCALATE'
  passedCount: number;
  totalDimensions: number;
  overallPassed: boolean;          // deprecated, kept for DB compat
}
```

- **L0 checks** (`runL0Checks`): structural field presence checks, <100ms, no LLM
- **L1 checks** (`runL1Checks`): citation resolvability — checks that `evidence[].sourceIds` resolve against known research source IDs
- **Hard dimensions** (any FAIL → REWRITE): `brief_constraint_adherence`, `evidence_coverage`, `risk_disclosure`
- **Soft dimension** (WARN only, never blocks): `internal_consistency`
- **Gate logic** (`determineGate`):
  - All hard dims pass → PASS
  - Any hard FAIL + rewriteCount < maxRewrites → REWRITE
  - rewriteCount >= maxRewrites OR any ABSTAIN → ESCALATE

**`src/lib/decision/rewrite-loop.ts`** — Surgical rewrite loop:
- Hard counter `MAX_REWRITES = 2`, counter is source of truth (not LLM output)
- Takes `rewriteInstructions: string[]` from judge (not failed dimension names)
- Keeps the version with the most PASS dimensions if rewrite doesn't improve

**`src/lib/db/schema.ts`** — `judge_evaluations` table gained:
```
gate TEXT NOT NULL DEFAULT 'PASS'
rewrite_instructions_json TEXT NOT NULL DEFAULT '[]'
escalate_reason TEXT NOT NULL DEFAULT ''
human_review_result TEXT  -- 'PASS' | 'FAIL' | null
human_reviewer_id TEXT
reviewed_at INTEGER
agreement INTEGER  -- 1=agree, 0=disagree, null=not reviewed
```

**`src/app/api/sessions/judge-calibration/route.ts`** — GET endpoint returning REWRITE/ESCALATE cases for human review

**`src/app/api/sessions/judge-calibration/[id]/route.ts`** — POST endpoint to record human review result

**`src/lib/orchestrator/orchestrator.ts`** — Replaced old binary evaluator gate with:
1. L0 → L1 pre-checks (non-blocking, emit session events)
2. LLM judge evaluation
3. Rewrite loop (max 2 rounds, hard counter)
4. Legacy LLM evaluator still runs in parallel for backward-compat (non-blocking, try/catch)

### Questions for review
1. Is the `determineGate` logic correct? Specifically: should ABSTAIN always escalate, or only when it's on a hard dimension?
2. The rewrite loop in the orchestrator is inlined (not using `SummaryRewriter` class). Is this a problem?
3. L1 checks compare `evidence[].sourceIds` against `knownSourceIds` — but sourceIds in evidence are citation labels (e.g. "S1", "S2"), not raw DB IDs. Is this check actually useful or always vacuously passing?

---

## Topic 4 — Trust Boundary & Evidence Honesty

### What changed

**`src/lib/decision/types.ts`** — New types:
```ts
type ClaimType = 'allowed_without_evidence' | 'requires_evidence' | 'gap_only';
type VerificationStatus = 'captured' | 'extracted' | 'evidence_backed' | 'inferred' | 'ungrounded';

interface GapReasonEntry { code: GapReasonCode; detail: string; }
// GapReasonCode: 'no_source_found' | 'source_unverifiable' | 'claim_inferred' | 'time_constraint' | 'out_of_scope'

interface DecisionSummaryEvidence {
  // existing fields...
  claimType?: ClaimType;
  verificationStatus?: VerificationStatus;
}
```

**`src/lib/decision/validators.ts`** — Added `runClaimGate(evidence)`:
- Returns `{ passed, blocked: ClaimGateResult[], enriched: DecisionSummaryEvidence[] }`
- `inferClaimType()` and `inferVerificationStatus()` helpers

**`src/lib/decision/trust-boundary.ts`** — Prompt injection scanner:
```ts
function scanForSuspiciousContent(pageContent: string): ContentScanResult
// High-risk patterns: ignore_instructions, you_are_now, disregard_context, etc.
// Medium-risk: role_play_trigger, forget_instructions, hidden_text_block (>500 chars no whitespace)
// High → 'isolate' (adds manual_review_required flag)
// Medium → 'flag' (adds injection_risk_medium flag)
```

**`src/components/discussion/decision-summary-card.tsx`** — UI de-authoritization:
- Removed raw/adjusted confidence % chips
- Replaced "Confidence explanation" with "Evidence coverage" using honest counts
- Added `EvidenceStatusChip` with 5-state color coding (evidence_backed=green, extracted/captured=gray, inferred=amber, ungrounded=red)
- Renamed "Trust Signals" → "来源覆盖情况" with honest Chinese labels

### Questions for review
1. The injection scanner uses regex patterns on raw page content. Is the hidden_text_block heuristic (>500 chars no whitespace) reliable? What are the false positive risks?
2. `runClaimGate` is defined but not wired into the orchestrator flow. Is this intentional (future use) or a gap?
3. The UI removes confidence % entirely. Is this the right call, or should it be shown with appropriate caveats?

---

## Topic 5 — SSE Reliability / Idempotency

### What changed

**`src/lib/sse/event-buffer.ts`** — In-process ring buffer:
```ts
// 200 events max per session, 30min TTL
// pushToBuffer(sessionId, event) → returns monotonic eventId
// getEventsSince(sessionId, lastEventId) → returns missed events
// Periodic cleanup via setInterval (every 5min)
```

**`src/lib/sse/types.ts`** — `SSEEvent` gained `eventId?: number` and `replayed?: boolean`. `encodeSSE()` emits `id: N\n` SSE field when eventId present.

**`src/app/api/sessions/[id]/events/route.ts`** — GET catch-up replay endpoint:
- Supports `?lastEventId=N` query param and `Last-Event-ID` header
- Returns missed events as JSON array with `replayed: true`

**`src/lib/orchestrator/failure-classifier.ts`** — Error classification:
```ts
type FailureClass = 'transient' | 'degraded' | 'terminal';
// terminal: invalid API key, 401, 403, auth errors
// transient: timeout, rate limit, 429, 503, network errors
// default: degraded
function backoffMs(attempt: number): number  // 1s, 2s, 4s, max 8s
```

**`src/lib/db/repository.ts`** — Idempotency guards:
- `upsertLedgerCheckpoint`: same session+phase+ledgerVersion = no-op
- `upsertSummaryVersion`: same session+version = no-op

**`src/app/api/sessions/ops/reliability/route.ts`** — Phase reliability metrics:
- GET `/api/sessions/ops/reliability?window=1d|7d|30d`
- Aggregates `phase_started` / `phase_completed` / `phase_failed` events
- Returns per-phase success rate and average duration

**`getPhaseReliabilityMetrics` in repository.ts**:
```ts
// Queries session_events for phase_started/completed/failed
// Filters by window in JS (not SQL) because Drizzle SQLite lacks date comparison
// Tracks start times per session+phase key for duration calculation
```

### Questions for review
1. The event buffer is in-process (module-level Map). In a multi-process deployment (e.g. multiple Next.js workers), this breaks — each worker has its own buffer. Is this a known limitation or a bug?
2. `getPhaseReliabilityMetrics` fetches ALL phase events then filters in JS. For high-volume deployments this could be slow. Is a SQL WHERE clause feasible with Drizzle SQLite?
3. The `failure-classifier.ts` is defined but not yet wired into the orchestrator's retry logic. Is this intentional?

---

## Topic 6 — Decision Memory Architecture

### What changed

**`src/lib/decision/types.ts`** — New memory types:
```ts
interface SessionEndReflection {
  sessionId: string;
  generatedAt: string;
  decisionSummary: string;
  assumptionsWithStatus: AssumptionEntry[];  // { text, status: 'confirmed'|'refuted'|'open', howToFalsify }
  evidenceGaps: GapEntry[];                  // { topic, gapReason, nextAction }
  forecastItems: ForecastEntry[];            // { id, claim, probability, deadline, measurableOutcome, actualOutcome, brierScore, resolvedAt }
  lessonsCandidate: LessonCandidate[];
}

interface Lesson {
  id: string;
  rule: string;
  applicabilityConditions: string;
  evidenceBasis: string[];   // session_id list
  patternCount: number;
  expiryPolicy: { reviewAfterSessions: number; autoFlagIfContradicted: boolean; }
  conflictMarker?: string;
  status: 'candidate' | 'active' | 'expired' | 'contradicted';
}
```

**`src/lib/decision/reflection.ts`** — Reflection utilities:
- `parseReflectionJson`: safe parse with fallback to empty reflection
- `computeBrierScore(probability, outcome)`: `(outcome - probability)^2`
- `recordForecastOutcome(forecast, actualOutcome)`: returns updated ForecastEntry
- `canPromoteLesson`: patternCount >= 3 AND evidenceBasis.length >= 2
- `isLessonExpired`: sessionsSinceLastReference > reviewAfterSessions

**`src/lib/decision/follow-up-context.ts`** — Whitelist-filtered follow-up context:
- Allowed: decisionSummary, open assumptions, evidence gaps, active+promoted lessons
- Explicitly excluded: raw transcripts, expired/contradicted lessons, full lessonsCandidate
- `renderFollowUpContextPrompt(ctx)`: renders as Chinese-language prompt string

**`src/lib/db/schema.ts`** — Two new tables:
```sql
session_reflections (id, session_id UNIQUE, generated_at, decision_summary, assumptions_json, evidence_gaps_json, forecast_items_json, lessons_candidate_json, created_at, updated_at)
lessons (id, rule, applicability_conditions, evidence_basis_json, pattern_count, review_after_sessions, auto_flag_if_contradicted, conflict_marker, status, created_at, updated_at)
```

**`src/lib/db/repository.ts`** — New functions:
- `upsertSessionReflection`, `getSessionReflection`
- `updateForecastOutcome(sessionId, forecastId, actualOutcome)`
- `upsertLesson`, `listLessons(filter?)`
- `reconcileLessonStatuses(sessionsSinceReference: Map<string, number>)`

**`src/components/discussion/decision-progress-dashboard.tsx`** — React component:
- Shows open assumptions (with confirm/refute/open toggle), evidence gaps, pending/overdue forecasts
- Callbacks: `onUpdateAssumption`, `onRecordForecastOutcome`
- Shown as first screen before follow-up session starts

### Questions for review
1. `SessionEndReflection` is generated by an LLM summarizer (described in plan, not yet implemented). The schema and types are in place but the actual LLM call is missing. Is this a meaningful gap or acceptable as a first phase?
2. `reconcileLessonStatuses` takes a `Map<string, number>` (lessonId → sessions since last reference). Who is responsible for computing this map? It's not clear from the code.
3. The `follow-up-context.ts` `buildFollowUpContext` checks `canPromoteLesson` again even though `listLessons({ status: 'active' })` should already only return promoted lessons. Is this double-check intentional or redundant?
4. Brier score is computed as `(outcome - probability)^2` for binary forecasts. Is this the correct formula? (Standard Brier score for binary: yes, this is correct.)

---

## Cross-cutting concerns

1. **No DB migrations**: New tables (`session_reflections`, `lessons`) are added to the schema but there are no migration files. The project appears to use `push` mode (schema sync). Is this safe for production?
2. **No tests added**: All 4 topics add zero new tests. The existing test suite has pre-existing failures (`.ts` extension imports, `sourceDiversity` type mismatch). Should any of the new logic (judge gate, Brier score, lesson promotion, injection scanner) have unit tests?
3. **`failure-classifier.ts` is unused**: Defined but not wired into the orchestrator. Same for `runClaimGate` in validators. Are these intentional stubs for a future phase?
4. **In-process SSE buffer**: Works for single-process dev but breaks in multi-worker production. Is there a plan to move this to Redis or a shared store?
5. **`getPhaseReliabilityMetrics` JS-side filtering**: Fetches all phase events then filters in memory. For large deployments this is a performance risk.

---

Please provide:
- A severity rating for each issue you find (critical / major / minor / suggestion)
- Specific file and line references where possible
- Concrete fix suggestions, not just problem descriptions
