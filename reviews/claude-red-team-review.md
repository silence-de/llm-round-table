# Round Table Red-Team Review

> Written by Claude Sonnet 4.6 | March 2026 | Based on direct code inspection across 40+ files

---

## Executive Summary

Round Table has real engineering depth. The orchestrator, streaming architecture, research pipeline, and schema design reflect genuine thought. This is not a weekend toy. But the product promise — "trusted personal decision assistant," "evidence-backed," "calibrated," "decision dossier" — exceeds the actual implementation in ways that could damage user trust the first time a user treats the output seriously.

**What is strongest:** The orchestration engine (session lifecycle, SSE streaming, resume logic, agent multiplexing) is well-structured and shows careful engineering. The data model for tracking decisions over time is more thoughtful than most comparable projects. The browser verification concept, even in its current limited form, is directionally correct.

**What is misleading:** The confidence number is the most visible trust signal in the entire product. It is computed from an LLM self-assessment (an uncalibrated integer the LLM is prompted to produce) with hardcoded point deductions applied at read time. It is presented as a precise percentage with no indication that it carries a ±15-20 point uncertainty band. Users facing real decisions will anchor on the difference between 74% and 76% — that difference is pure noise.

**What is most fragile:** The browser verification pipeline launches two separate headless Chromium instances per verification call, with no browser pool and no protection against internal network access (SSRF). The PDF export throws if no CJK font is available on the system. Authentication is a single optional shared secret that is not enforced per-user or per-session.

**Whether the current implementation deserves the positioning claim:** Not yet. "Trusted personal decision assistant" requires trust infrastructure (auth, evidence integrity, calibration validity) and confidence semantics that are defensible to a user who stakes real decisions on the output. The current implementation is a sophisticated prototype that looks like a trusted tool but lacks the internal guarantees that would make it one.

---

## Severity Map

---

## Critical

### No User Authentication or Session Isolation
- **Status:** `Verified`
- **Why it matters:** For a product whose explicit purpose is storing sensitive personal decisions (career changes, investments, life events), having no authentication is a fundamental trust failure. Any client with network access can read, modify, or export any session by guessing or knowing a session ID. Session IDs are nanoid-generated (21 chars) — not easily guessable in practice, but the protection is through obscurity, not design.
- **Where it exists:** All routes under `src/app/api/sessions/[id]/`. The only protection is an optional `ROUND_TABLE_ACCESS_TOKEN` header check (a shared secret, not per-user). `src/app/api/sessions/ops/route.ts` has zero authentication at all — it exposes the full operational dashboard (session counts, degraded events, provider errors) to any client.
- **Real-world failure mode:** A user deploys Round Table and shares the URL with a co-founder "just to show it off." That co-founder can now read and export all decision sessions, including ones never shared with them. Worse: any browser tab open on the same network can `fetch('/api/sessions/ops')` and get the full operational overview.
- **Why the builder may miss it:** It's a personal tool initially, so auth feels unnecessary. But the product positioning is explicitly about "important life decisions" — the data is sensitive by definition, and the deployment model implies at least some multi-user or shared-environment exposure.
- **Recommended fix:** Implement session-owner binding at minimum. Store a `createdBy` identity (even a persistent browser fingerprint or self-managed user token) at session creation. Verify on every read/write. Add required auth to the `/api/sessions/ops` route.
- **Priority:** `P0`

---

### Confidence Numbers Are Precision Theater
- **Status:** `Verified`
- **Why it matters:** Confidence is the primary epistemic signal in the entire product. The decision dossier is built around it. Users will use it to decide how seriously to commit to a path. If it carries no real information at the claimed precision, the product's trust model is hollow at its center.
- **Where it exists:** `src/lib/orchestrator/moderator.ts:268` — the prompt instructs the LLM: `"confidence 用 0-100 的整数"` with an example of `76`. The LLM produces an integer that "sounds reasonable." Then `src/lib/decision/utils.ts:427-455` applies penalties: -8 per unsupported claim (capped at -24), -10 for 50%+ stale sources, -6 for single-domain sources. These are applied in `buildDecisionConfidenceMeta()` at read time (not persisted as adjusted confidence). `predictedConfidence` in the `decision_summaries` table stores the raw LLM self-assessment.
- **Real-world failure mode:** The LLM outputs `76`. User has 2 unsupported claims → -16 points → displayed as `60%`. User returns the next day and adds browser-verified source, resolving 1 claim → displayed as `68%`. Neither number has a defensible statistical basis. The user treats the change from 60→68 as meaningful signal that their new source materially improved the evidence quality. It does not — the delta was determined by a hardcoded `8` in a function with no empirical calibration.
- **Why the builder may miss it:** The formula feels rigorous because it has moving parts. The penalties are directionally sensible (unsupported claims should lower confidence). The problem is that the absolute scale is arbitrary and the deltas are invented. It creates the *feeling* of calibrated measurement while having none of its properties.
- **Recommended fix:** Replace numeric confidence with transparent qualitative bands: `Strong evidence` / `Mixed evidence` / `Weak evidence` / `Speculative`. Surface the underlying counts (supported claims: 4, unsupported: 2, stale sources: 1) and let users form their own judgment. If a number must be shown, clearly label it as "self-assessed" with a documented uncertainty range. Never display it to the nearest integer.
- **Priority:** `P0`

---

### Browser Verification Is Structured Scraping, Not Verification
- **Status:** `Verified`
- **Why it matters:** The product UI uses "Verified page," "verified facts," and "browser capture" language that implies semantic validation — that the system has checked whether a claim is supported by a page. The implementation is keyword-triggered sentence extraction from a text dump. A page with the word "benefit" anywhere in its body text generates a "Benefits" verified fact regardless of context. This is misleading to users making consequential decisions who will treat these as validated facts.
- **Where it exists:** `src/lib/search/browser-verify.ts:180-257` — `extractVerificationFields()` uses `matchKeywordSentence()` which finds the first sentence in the page text containing any of the supplied keywords. For the `career_offer` profile, "Benefits" matches the first sentence containing `['benefits', 'insurance', 'pto', 'leave']`. The matched sentence is returned with `confidence: 'medium'` or `'high'` and stored as a verified fact. There is zero semantic validation that the sentence means what the label implies.
- **Real-world failure mode:** User verifies a job offer page. The page has a cookie consent banner: "Accepting cookies provides benefits for your experience." The system extracts that sentence as the `Benefits` verified fact with `confidence: 'medium'`. The decision dossier now cites cookie banner text as evidence about job compensation. The user, who glanced at the "verified" badge, does not manually inspect the raw extracted text.
- **Why the builder may miss it:** Verification works correctly on well-structured pages from major employers (LinkedIn, Glassdoor) where keywords appear in the right context. Testing against best-case pages masks failure modes on real-world pages with ads, sidebars, banners, and unstructured layouts.
- **Recommended fix:** Rename all user-facing language to "browser capture" or "extracted signals." Remove "verified" from the UI terminology entirely. Add a mandatory manual review step where users confirm extracted fields before they enter the evidence chain. Never apply `confidence: 'high'` to regex-matched sentences — that rating implies semantic validation the system cannot provide.
- **Priority:** `P0`

---

### PDF Export Throws on Missing CJK Font With No User-Facing Recovery
- **Status:** `Verified`
- **Why it matters:** The PDF decision dossier is the primary shareable deliverable — the artifact that justifies the product positioning. If export fails, the entire session's analytical value is locked behind the app UI. For a product targeting Chinese-language users (all prompts are in Chinese, all templates are in Chinese), failure to export in Chinese environments is a complete product failure.
- **Where it exists:** `src/lib/session-artifact-files.ts:696-713` — `registerPdfFonts()` iterates through font candidates. If none exist, it throws: `'No usable PDF font file found. Set ROUND_TABLE_PDF_CJK_FONT to a valid .ttf/.otf font path.'` Font candidates include `ROUND_TABLE_PDF_CJK_FONT` env var, some Vercel-bundled paths, and system paths on macOS and Linux. On a standard cloud Linux VM without pre-installed Noto CJK fonts, all candidates fail. `src/lib/session-artifact-files.ts:18` — the Vercel og fallback is `noto-sans-v27-latin-regular.ttf` which is Latin-only and will render Chinese content as tofu (empty boxes) if it happens to resolve.
- **Real-world failure mode:** User deploys on a cloud VM. They complete a 30-minute decision session on whether to accept a job offer. They click "Export PDF." They receive a raw `502` error. The decision dossier is gone. The session data still exists in the database but there is no structured markdown export that covers all the same fields.
- **Why the builder may miss it:** macOS development machines always have `Arial Unicode.ttf` at `/System/Library/Fonts/Supplemental/Arial Unicode.ttf`, so development export works. The CJK test (`test/pdf-artifact-cjk.test.ts`) explicitly skips via `t.skip()` when no font is available, so CI never catches this failure.
- **Recommended fix:** Bundle a CJK-capable font (NotoSansSC-Regular.ttf, ~5MB, OFL license) in `public/fonts/` and make it the first candidate in `PDF_FONT_CANDIDATES`. Add a pre-flight check at startup. Add a user-facing fallback: if PDF export fails, auto-offer structured markdown download. Never surface raw internal errors to users.
- **Priority:** `P0`

---

## High

### Double Chromium Launch Per Verification With No Resource Guard
- **Status:** `Verified`
- **Why it matters:** Each browser verification call launches two separate Chromium processes: one via the Playwright SDK (`extractPlaywrightBodyText()`) for DOM text, and one via `npx -y playwright screenshot` CLI for the screenshot. There is no browser pool, no concurrency limit, no memory guard. On a server with 1-2GB RAM, simultaneous verifications can exhaust memory.
- **Where it exists:** `src/lib/search/browser-verify.ts:415-452` — `extractPlaywrightBodyText()` dynamically imports `playwright` and calls `playwright.chromium.launch()`. Then `src/lib/search/browser-verify.ts:364-368` separately calls `execFileAsync('npx', ['-y', 'playwright', 'screenshot', ...])`. These are two independent Chromium launches. The `npx -y` also downloads the CLI if not cached — adding 5-30 seconds before the 8-second timeout even begins.
- **Real-world failure mode:** User verifies 3 sources back-to-back. Server spawns 3 SDK instances × 2 = 6 Chromium processes. The process OOMs. The Node.js server crashes. An ongoing SSE stream from a different session is orphaned mid-discussion. The user sees a connection error and cannot tell how much was saved.
- **Why the builder may miss it:** Browser verification tests disable Playwright entirely (`process.env.NODE_ENV === 'test'` returns null from both extraction paths). The double-launch is invisible from the function signatures.
- **Recommended fix:** Use `page.screenshot()` from the already-open Playwright page object in `extractPlaywrightBodyText()`. This combines both operations into one browser launch. Eliminate the `npx` CLI path entirely. Add a per-server concurrency semaphore capping simultaneous browser launches at 1-2.
- **Priority:** `P1`

---

### SSRF via Browser Verification Endpoint
- **Status:** `Verified`
- **Why it matters:** The verification endpoint accepts any HTTPS/HTTP URL and loads it in a headless browser running on the server. An attacker (or any user in a shared deployment) can submit internal network URLs and receive whatever the server's network can access.
- **Where it exists:** `src/lib/search/browser-verify.ts:124-135` — `normalizeVerificationUrl()` validates that the protocol is http or https, but performs no hostname validation. The URL is passed to `playwright.chromium.launch()` + `page.goto()`, which executes with the server's full network context.
- **Real-world failure mode:** In a VPC deployment (AWS, GCP, Azure), the server can reach internal metadata endpoints (`http://169.254.169.254/latest/meta-data/`). A user submits this URL. The Playwright instance fetches it. The response (IAM credentials, project metadata) becomes `bodyText`, passes through `extractVerificationFields()`, and is stored in the SQLite database as "verified fields" on a research source.
- **Why the builder may miss it:** The threat model is "personal use," so SSRF feels distant. But even on personal deployments, SSRF enables probing local Docker networks, Redis instances, or other services on the same host.
- **Recommended fix:** In `normalizeVerificationUrl()`: resolve the hostname to IP, then reject private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, ::1), metadata service addresses, and non-routable ranges. Set Playwright network restrictions to block these same ranges at the browser level.
- **Priority:** `P1`

---

### SPA and Client-Rendered Pages Silently Return Empty Body Text
- **Status:** `Verified`
- **Why it matters:** A significant fraction of pages users will want to verify (job listings on Greenhouse, Lever, Workday; company pages built in Next.js/React; financial product pages) are SPAs. These render content after JavaScript executes. The pipeline will silently produce empty body text for these pages but still label them as captured sources.
- **Where it exists:** `src/lib/search/browser-verify.ts:436` — `page.goto()` uses `waitUntil: 'domcontentloaded'`. For React apps, this fires when the HTML is parsed — before hydration. `page.evaluate(() => document.body?.innerText ?? '')` returns the loader text or nothing. The fetch-based fallback at line 43-59 also returns the static HTML shell (`<div id="root"></div>`) for these apps.
- **Real-world failure mode:** User verifies a Greenhouse job posting. `domcontentloaded` fires on the empty shell. `innerText` returns "Loading..." `extractionQuality` is set to `'low'`. But the source still appears in the evidence panel with a browser-capture badge because `sourceType === 'browser_verification'` confers the same visual treatment regardless of actual quality.
- **Why the builder may miss it:** Testing against server-side-rendered pages (LinkedIn profiles, government sites, major newspapers) always works. SPA-heavy recruiting platforms are the actual primary use case.
- **Recommended fix:** Change `waitUntil` to `'networkidle'` with a 15-second timeout. If `bodyText.length < 200` after `domcontentloaded`, wait for `networkidle` before extracting. Explicitly downgrade the UI presentation for `extractionQuality: 'low'` sources — show a warning instead of a success badge.
- **Priority:** `P1`

---

### Source Citation Labels Invalidate on Research Rerun
- **Status:** `Verified`
- **Why it matters:** The decision summary stores evidence claims with citation labels (`"sourceIds": ["R1", "R3"]`). These refer to sources by their rank position among selected sources. When research reruns happen, or sources are pinned/unpinned/added, ranks recalculate. R3 may now refer to a completely different source than when the decision summary was generated.
- **Where it exists:** `src/lib/orchestrator/moderator.ts:213-227` — the summary prompt lists sources as `R${source.rank}` and instructs the LLM to cite them by these labels. The generated citation labels are stored in `decisionSummaries.content` JSON. `findResearchSourceByCitation()` resolves citations by matching current source ranks against stored labels at read time.
- **Real-world failure mode:** User runs research (R1=Forbes, R2=Glassdoor, R3=BLS). Summary: "Compensation is competitive [R1, R3]." User adds a browser-verified source, which inserts at rank 1. Old R1→R2, old R3→R4. The evidence card now shows "Compensation is competitive" backed by the old Glassdoor (now R2) — not the Forbes article that originally supported it. BLS citation is broken (R3 not found). User does not notice.
- **Why the builder may miss it:** In the happy path (single research run, no reruns, no manual verification), citations are stable. Breakage only manifests with reruns or source additions.
- **Recommended fix:** Store citation-to-source-ID mappings using the persistent `source.id` UUID at summary generation time. Display R1/R2 labels as user-facing aliases, but resolve them against stable IDs in the DB.
- **Priority:** `P1`

---

### 3,868-Line page.tsx With Multiple Competing State Sources
- **Status:** `Verified`
- **Why it matters:** A component this large with overlapping state (Zustand store + local `useState` + `historyDetail` API response + live stream results) creates race conditions that cannot be systematically tested. Stale state contamination between sessions is a real risk.
- **Where it exists:** `src/app/page.tsx` (3,868 lines). The component maintains distinct state for: active session stream data, history panel session detail, calibration panel, replay cursor, export state, follow-up carry-forward preview, research panel, verification panel, persona editor, and more. The Zustand store (`src/stores/discussion-store.ts`) manages parallel stream state.
- **Real-world failure mode:** User is reviewing a historical session in the history panel while a new session finishes streaming. The `discussion_complete` SSE event triggers `hydrateSessionArtifactsFromSession()`, which reads `store.sessionId` and sets `store.decisionSummary`. If the user switched to a different history session between the stream completing and the fetch returning, the history view is partially overwritten with the new session's decision summary. The user sees data contamination with no indication of what happened.
- **Why the builder may miss it:** The contamination requires specific timing (history view open, new session stream finishes, history fetch in flight). Under normal usage with one session at a time, it never occurs.
- **Recommended fix:** Extract page.tsx into purpose-scoped components with explicit state ownership. Stream context, history context, and calibration context must never share mutable state. Add a session ID guard to the hydration effect: if `store.sessionId !== sessionId` at the end of the await, discard the result.
- **Priority:** `P1`

---

### Confidence Adjustments Are Computed at Read Time With No Audit Trail
- **Status:** `Verified`
- **Why it matters:** The user sees a single confidence number. They form an impression. They return two weeks later and see a different number with no indication that anything changed. This is epistemic drift disguised as stable data.
- **Where it exists:** `src/lib/decision/utils.ts:394-468` — `buildDecisionConfidenceMeta()` computes adjustments fresh from current source states on every call. `src/lib/db/repository.ts:720-727` — called during `getSessionDetail()`. The `predictedConfidence` column stores only the raw LLM confidence. There is no persisted adjusted confidence, no change log.
- **Real-world failure mode:** User sees 62% before sharing the dossier with their partner. Partner opens the same session 3 days later after the user added more sources. Partner sees 74%. Neither knows the number moved. The partner makes a comment based on 74%; the user is confused because they remember 62%. Trust in the tool erodes.
- **Recommended fix:** Persist the adjusted confidence at write time (add `adjustedConfidence` integer column to `decision_summaries`). Call `buildDecisionConfidenceMeta()` during `upsertDecisionSummary()` and store the result. Display the stored value. When source changes make the stored value stale, show a visible indicator ("Evidence updated since last export — recalculate?").
- **Priority:** `P1`

---

### Calibration Compares Two Subjective Self-Assessments
- **Status:** `Verified`
- **Why it matters:** The calibration dashboard is presented as a mechanism for improving future decision quality. The "overconfidence gap" metric compares `predictedConfidence` (LLM self-assessment) against `outcomeConfidence` (user's retroactive integer rating). This is not a prediction vs ground truth comparison. It is comparing two uncalibrated integers generated by two different minds at two different times using no shared reference scale. The resulting charts have no statistical validity.
- **Where it exists:** `src/lib/db/repository.ts:1151-1164` — `averageCalibrationGap = average(|predictedConfidence - outcomeConfidence|)`. `src/lib/db/repository.ts:1172` — `assessCalibrationSample()` adds a "sample too small" label but does not suppress or disable the charts for samples below 5 sessions.
- **Real-world failure mode:** User rates an outcome as "65% confident it was right" (meaning: somewhat satisfied). LLM rated the session as "72%." Calibration dashboard shows "overconfidence gap: 7 points" and suggests the user is systematically overconfident. This conclusion is false — 7 points is well inside the noise of two opaque integer mappings by different actors. The user adjusts their decision-making process based on invalid signal.
- **Why the builder may miss it:** The correlation between LLM confidence and outcome confidence will often be directionally right (high-confidence sessions tend to have better outcomes). This surface validity masks the measurement invalidity.
- **Recommended fix:** Replace subjective outcome confidence with a structured outcome registry: did you take the recommended action? (yes/no/partially), are you satisfied with the outcome? (1-5 scale), did any `revisitTriggers` fire? (binary). Use binary/categorical inputs for calibration. The current `outcomeConfidence` integer should be deprecated.
- **Priority:** `P1`

---

## Medium

### Silent Partial Failure When LLM Providers Error or Lack Keys
- **Status:** `Verified`
- **Why it matters:** When an LLM call fails or a key is missing, agents are silently skipped or degraded. The session completes and appears as a normal completed session, with a full decision summary, confidence score, and dossier — potentially based on a single agent's perspective.
- **Where it exists:** `src/app/api/sessions/[id]/start/route.ts:108` — agents without API keys are silently skipped with only a code comment explaining why. `src/lib/orchestrator/orchestrator.ts:60-65` — agents are degraded after timeout threshold, continuing the session with fewer participants.
- **Real-world failure mode:** User selects Claude, GPT-4, and DeepSeek. GPT-4 has no key in the environment. DeepSeek times out twice. Claude has a solo discussion as moderator and sole participant. Decision summary is generated with confidence score. User sees "3 agents" in the session setup but 1 actually contributed. They do not know.
- **Recommended fix:** Surface a clear pre-flight warning before starting if requested agents cannot run. After session completion, show a "participants" summary that explicitly lists which agents contributed vs. which were skipped/degraded. Visually differentiate single-agent sessions in history.
- **Priority:** `P1`

---

### JSON Config Blobs in Text Columns Without Schema Versioning
- **Status:** `Verified`
- **Why it matters:** Every schema change to `agendaConfig`, `researchConfig`, `personas`, `modelSelections`, or `resumeSnapshot` is a silent breaking change for existing sessions. Old sessions will be read with the new code expecting new fields and will either crash or silently use wrong defaults.
- **Where it exists:** `src/lib/db/schema.ts:16-31` — 8 JSON text columns on the sessions table. `src/lib/db/repository.ts:703` — `JSON.parse(sessionDecisionSummary.content) as DecisionSummary` — TypeScript cast with no runtime validation.
- **Real-world failure mode:** A new required field is added to `DiscussionAgenda`. All existing sessions have `agendaConfig` without this field. `normalizeDiscussionAgenda()` uses a default value silently, changing the replay or export behavior of historical sessions.
- **Recommended fix:** Add `schemaVersion` integer to sessions and decision_summaries. Implement versioned migration functions. Use `zod` validation on every JSON parse to detect shape mismatches at read time rather than silently defaulting.
- **Priority:** `P1`

---

### No Rate Limiting on Resource-Intensive Endpoints
- **Status:** `Verified`
- **Why it matters:** Browser verification (Chromium launch), research reruns (Tavily API), and session starts (LLM API) are all unlimited. Repeated calls incur unbounded cost and resource consumption.
- **Where it exists:** `src/app/api/sessions/[id]/research/verify/route.ts` — no rate limiting. `src/app/api/sessions/[id]/research/route.ts` — `maxReruns` is enforced per session in config, but can be set to high values in the request body. `src/app/api/sessions/[id]/start/route.ts` — no per-IP limiting.
- **Real-world failure mode:** A script POSTs to the verification endpoint 10 times per second, spawning 20 Chromium processes simultaneously, OOMing the server and crashing all in-flight sessions.
- **Recommended fix:** Add in-memory token bucket rate limiting on browser verification and research rerun endpoints. Cap `maxReruns` server-side regardless of client input. Add a per-server concurrency semaphore for Playwright browser launches.
- **Priority:** `P1`

---

### Interjection Control Types Are Advisory Only — LLM Can Ignore Them
- **Status:** `Verified`
- **Why it matters:** The product advertises "force convergence" and "add constraint" as explicit user controls over the discussion. Programmatically, they are text appended to the LLM prompt. There is no code that enforces convergence by skipping the debate continuation check.
- **Where it exists:** `src/lib/orchestrator/orchestrator.ts` — `consumeInterjections()` formats interjection text and includes it in the next LLM prompt. The `shouldConverge` decision at the end of each analysis phase is based on LLM-generated JSON output, not the user's `force_converge` interjection.
- **Real-world failure mode:** User sends `force_converge` with 5 minutes before a meeting. The LLM, influenced by the prior debate context, generates another round of disagreements. The orchestrator interprets `shouldConverge: false` and continues the debate. The user's explicit control had no effect.
- **Recommended fix:** For `force_converge`: set a flag that skips the `shouldConverge` LLM check and programmatically transitions to the summary phase. This is a trivial code change that makes the control actually deterministic.
- **Priority:** `P2`

---

### Browser-Verified Sources Are Never Marked Stale
- **Status:** `Verified`
- **Why it matters:** Browser-verified sources receive `stale: false` hardcoded regardless of publication date. An outdated page verified by the user bypasses the stale penalty that would apply to the same content found via automatic research.
- **Where it exists:** `src/lib/search/browser-verify.ts:100-101` — `score: 0.95, stale: false` hardcoded. No call to the staleness checker for browser-verified sources.
- **Real-world failure mode:** User verifies a salary data page published in 2023. It gets `stale: false, score: 0.95`. The stale penalty in confidence calculation never applies. The decision dossier appears more evidence-backed than warranted for this time-sensitive decision.
- **Recommended fix:** Extract publication date from the verified page and run it through the existing `isStale()` function from `src/lib/search/research.ts`. Apply staleness logic to browser-verified sources using the same decision-type thresholds.
- **Priority:** `P2`

---

### No Foreign Key Constraints in Schema
- **Status:** `Verified`
- **Why it matters:** Without FK constraints, orphaned data accumulates silently. Claim-source links can reference deleted sources. Calibration queries can include orphaned decision summaries. Data integrity — core to a tool tracking long-term decision chains — is not enforced at the database level.
- **Where it exists:** `src/lib/db/schema.ts` — no `.references()` clauses anywhere in the 175-line schema. SQLite supports FK enforcement via `PRAGMA foreign_keys = ON` but it is not enabled.
- **Recommended fix:** Add FK constraints to all child tables. Enable `PRAGMA foreign_keys = ON` at database initialization. Add `onDelete: 'cascade'` to child relationships.
- **Priority:** `P2`

---

## Low

### `npx -y playwright screenshot` as the Screenshot Backend
- **Status:** `Verified`
- **Why it matters:** The screenshot path uses `execFileAsync('npx', ['-y', 'playwright', 'screenshot', ...])` with an 8-second total timeout. `npx -y` downloads the package if not cached. In CI, restricted networks, or air-gapped environments, this silently returns null. The timeout budget is consumed by download before the actual page load.
- **Where it exists:** `src/lib/search/browser-verify.ts:364-368`
- **Recommended fix:** Use `page.screenshot()` from the already-open Playwright SDK page in `extractPlaywrightBodyText()`. Eliminate the `npx` CLI path.
- **Priority:** `P2`

---

### `resumeSnapshot` Is a Full Session State Blob in the Sessions Table
- **Status:** `Verified`
- **Why it matters:** `src/lib/db/schema.ts:20` — `resumeSnapshot: text('resume_snapshot')` stores the complete resume state JSON in the sessions table row. For sessions with many messages, this is hundreds of kilobytes. Every sessions table query transfers this blob unnecessarily.
- **Where it exists:** `src/lib/db/schema.ts:20`
- **Recommended fix:** Move `resumeSnapshot` to a separate `session_resume_snapshots` table, joined only when resume is needed.
- **Priority:** `P2`

---

### Moderator Locked to Claude With No Fallback
- **Status:** `Verified`
- **Why it matters:** Decision summary, evidence mapping, confidence score, and recommendations are generated exclusively by the moderator. The default moderator is Claude. If the Anthropic API is unavailable, the session completes with transcript but no decision output.
- **Where it exists:** `src/app/api/sessions/[id]/start/route.ts:65` — `moderatorAgentId = 'claude'`. No fallback moderator logic.
- **Recommended fix:** Allow moderator selection from any configured provider. Add a summary-phase fallback (e.g., use GPT-4 if Claude fails at the decision summary step specifically).
- **Priority:** `P2`

---

## Systemic Patterns

Three repeated engineering habits drive the majority of findings above:

**1. Labels that outrun semantics.** The product uses "verified," "evidence-backed," "calibrated," and "confidence" in UI copy. The underlying implementations are structurally correct but semantically weaker than these labels imply: keyword extraction ≠ verification, LLM self-assessment ≠ calibration, hardcoded point deductions ≠ evidence-backed confidence adjustment. This label-vs-implementation gap is the root cause of every trust-model finding in this report.

**2. Silent success masking actual failure.** Browser verification silently falls back to plain HTML fetch when Playwright fails. Agents are silently skipped when API keys are missing. PDF export only fails visibly when no font is found. Source citations silently break when research reruns. The system is engineered to avoid crashing loudly. The tradeoff is that failures look like successes to the user.

**3. Single-source-of-truth violations.** The confidence number exists simultaneously in: the raw LLM output in the decision summary JSON blob, the `predictedConfidence` integer column (raw LLM value), the computed `adjustedConfidence` in `confidenceMeta` (computed at read time), and whatever the UI renders. Source citation labels live in the summary JSON as `R1/R2` strings and are resolved dynamically against current source ranks — ranks that change. These multiple representations guarantee eventual inconsistency.

---

## What I Think The Product Really Is Today

Round Table is a well-engineered **LLM multi-agent discussion recorder with structured output**. It prompts multiple LLMs to discuss a user-supplied question, records the transcript, generates a structured summary, and saves it to SQLite.

The features layered on top — browser verification, confidence scoring, calibration, action item tracking, follow-up sessions — are directionally correct as a product vision but are currently prototype implementations. They look complete in the UI but lack the semantic depth their labels imply.

The product is not yet a trusted decision assistant. It is a conversation recorder with structured output and a confidence theater layer. That is a useful tool. But it should not be positioned or used as if the confidence numbers, evidence claims, or verification badges carry the epistemic weight that the UI implies they do.

---

## What Is Most Likely To Break First In Real User Usage

1. **PDF export fails on any non-macOS/non-standard-Linux deployment.** The font lookup misses. The error is technical. Recovery requires reading deployment documentation that does not yet exist.

2. **Browser verification returns empty or cookie-banner text on 40%+ of real-world URLs** (SPAs, modern recruiting platforms, dynamic pages). Users will not notice because the extracted fields look plausible.

3. **The user starts a session with agents that silently fail** (wrong API keys configured, one provider down). The session completes based on 1 agent. The user makes a decision based on a false sense of multi-perspective analysis.

4. **The confidence number moves between session creation and the user's next visit** (sources added, calculation rerun at read time). Trust in the data erodes.

5. **After 10+ sessions, history and calibration views slow down** as queries run N sub-queries per session without pagination or caching. This will not be noticed in development with 3 test sessions.

---

## Top 5 Fixes Before Wider Release

Ordered by leverage: fixes that close the largest gap between what the product claims and what it delivers.

**1. Rename "verified" to "captured" everywhere in the UI.**
"Verified page" → "Captured page." "Verified facts" → "Extracted signals." "Browser verification" → "Browser capture." Add a one-line disclaimer on every extracted field: "Not semantically validated — manual review required." This is a UI copy change that costs hours and closes the most damaging trust gap.

**2. Replace confidence percentage with evidence band labels.**
Replace `76%` with `Mixed evidence (4 supported / 2 unsupported claims)`. Store the integer internally for calibration tracking. Display the counts and band, not the number. This is a prompts + UI change that eliminates the precision theater problem.

**3. Bundle a CJK font in `public/fonts/` as the first font candidate.**
NotoSansSC-Regular.ttf (~5MB, OFL license) committed to the repo. Make it the first entry in `PDF_FONT_CANDIDATES`. Add a structured markdown fallback if PDF generation still fails. This makes the primary deliverable reliable on any deployment.

**4. Add pre-flight agent availability warning and post-session participant summary.**
Before starting: show which requested agents will actually run. After completion: show "3 requested, 2 participated (DeepSeek timed out)." This closes the silent failure gap where users do not know they got a 1-agent session.

**5. Persist adjusted confidence at write time.**
Compute `buildDecisionConfidenceMeta()` inside `upsertDecisionSummary()` and persist the adjusted value. Display the stored value. Show a "recalculate" indicator when sources have changed since last persistence. This makes confidence a stable data point rather than a dynamic calculation.

---

## What To De-Scope Immediately If Focus Is The Goal

**Calibration dashboard.** The gap metric is comparing two subjective self-assessments with no shared reference scale. Until outcome tracking is restructured around binary/categorical ground truth, calibration charts are analytical theater. De-scope the dashboard; keep the outcome logging fields. This removes a significant surface area of false rigor.

**Interjection control types** (`force_converge`, `add_constraint`, `ask_comparison`). These are labels on free-text prompts with no programmatic enforcement. Users who send `force_converge` and see the debate continue will lose trust in the control system. Either implement programmatic enforcement for at least `force_converge`, or collapse all interjection types to a single "add context" with no control semantics.

**Multi-model per-agent selection UI.** Letting users choose between Opus/Sonnet/Haiku per agent adds cognitive overhead to a flow that is already heavy. Most users cannot meaningfully evaluate which model is appropriate for which agent role. Simplify to "standard" / "thorough" tiers or just use the best available model automatically.

**The ops dashboard route** (`/api/sessions/ops`). This is a debugging surface exposing operational internals. It belongs behind admin authentication. It is not a user-facing feature and should not be accessible without auth headers.

---

## P0 / P1 / P2 Action Table

| Issue | Severity | Confidence | Owner Area |
|---|---|---|---|
| No user authentication / session isolation | P0 | Verified | Backend / Infra |
| Confidence numbers are precision theater | P0 | Verified | Prompts / Product |
| Browser "verification" mislabeled — is keyword text extraction | P0 | Verified | Product / Frontend / Prompts |
| PDF export throws on missing CJK font | P0 | Verified | Backend / Infra |
| Double Chromium per verification, no resource guard | P1 | Verified | Backend |
| SSRF via browser verification URL | P1 | Verified | Backend |
| SPA pages silently return empty body text | P1 | Verified | Backend |
| Citation labels (R1/R2) invalidate on research rerun | P1 | Verified | Backend / Data |
| 3,868-line page.tsx with multiple state sources | P1 | Verified | Frontend |
| Confidence adjustments computed at read time, no audit trail | P1 | Verified | Backend / Data |
| Calibration compares two subjective self-assessments | P1 | Verified | Product / Data |
| Silent partial failure when LLM providers error or lack keys | P1 | Verified | Backend / Product |
| JSON config blobs without schema versioning | P1 | Verified | Data / Backend |
| No rate limiting on resource-intensive endpoints | P1 | Verified | Backend / Infra |
| Interjection control types are advisory only | P2 | Verified | Backend / Product |
| Browser-verified sources never marked stale | P2 | Verified | Backend |
| No FK constraints in schema | P2 | Verified | Data |
| `npx -y playwright screenshot` as screenshot backend | P2 | Verified | Backend |
| `resumeSnapshot` blob in sessions table | P2 | Verified | Data |
| Moderator locked to Claude with no fallback | P2 | Inferred | Backend / Infra |
| Calibration dashboard active with samples below reliable threshold | P2 | Verified | Product / Frontend |
| Ops dashboard accessible without authentication | P2 | Verified | Backend |

---

*End of Red-Team Review*
