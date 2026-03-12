# Round Table Red-Team Review

**Reviewer**: Claude Opus 4.6 (adversarial red-team)
**Date**: 2026-03-12
**Codebase snapshot**: master branch, commit 613286a

---

## Executive Summary

Round Table is a genuinely ambitious project that has built a vertically integrated decision workflow — from structured brief through multi-agent discussion, evidence attachment, decision dossier, follow-up, and retrospective calibration — in a single-developer codebase. The amount of conceptual ground covered is impressive for the stage.

**What is strongest**: The decision brief model is well-thought-out. The claim-to-evidence linkage is a real differentiator. The trust signal pipeline (source quality flags, stale detection, gap reasons, confidence penalties) is more honest than most AI tools. The template system for personal decision types is practical and well-scoped.

**What is misleading**: The confidence numbers. They look precise and authoritative but are built on LLM self-report, heuristic penalties, and calibration math that lacks statistical rigor. The word "verified" in browser verification gives false assurance — the extraction is regex-based keyword matching, not semantic verification. The calibration dashboard implies actuarial-grade analysis but can't function meaningfully until hundreds of reviewed sessions exist.

**What is most fragile**: The 4,300-line monolithic page.tsx that holds all UI state. The calibration pipeline with its N+1 queries. The browser verification extraction that will fail on any non-trivial page structure. The PDF export's `toPdfSafeText` function that strips all non-ASCII characters, silently destroying the Chinese content this product is built around.

**Does the current implementation deserve the positioning claim?** Not yet. This is a sophisticated prototype with real architectural bones, but it is not yet a "trusted personal decision assistant." Trust requires consistency between what the product claims and what it actually does, and there are too many places where the presentation exceeds the underlying capability.

---

## Severity Map

## Critical

### PDF Export Silently Destroys Chinese Content

- Status: `Verified`
- Why it matters: The product is designed for Chinese-speaking users. All prompts are in Chinese. All LLM output is in Chinese. The PDF dossier is the primary shareable artifact — the thing you show your family, co-founder, or mentor. But `toPdfSafeText()` in `src/lib/session-artifact-files.ts:634-641` strips all non-ASCII characters: `value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')`. This means every Chinese character in every decision summary, every risk, every recommendation is silently removed from the PDF.
- Where it exists: `src/lib/session-artifact-files.ts:634-641`
- Real-world failure mode: User completes a full decision session, exports a polished PDF to share with their spouse or manager, and the PDF contains only English labels with blank content fields. The product promise of "export a PDF dossier that can be shared with family, co-founders, or mentors" is completely broken for the actual target audience.
- Why the builder may miss it: The PDF smoke test (`test/pdf-artifact-smoke.test.ts`) likely validates structure and file generation but not content correctness. PDFKit with Helvetica fonts can't render CJK characters anyway, so even without the regex strip, the output would be wrong. This is a compound failure — wrong font + wrong regex.
- Recommended fix: Use a CJK-capable font (e.g., Noto Sans CJK embedded via pdfkit's `registerFont`). Remove the ASCII-only sanitization regex. Add a test that asserts Chinese content survives into the PDF text stream.
- Priority: `P0`

### Calibration Confidence Penalty Is Invisible and Unreproducible

- Status: `Verified`
- Why it matters: The calibration system silently modifies the displayed confidence of historical sessions. When `getSessionDetail()` is called in `src/lib/db/repository.ts`, it calls `applyCalibrationPenalty()` which reduces confidence based on historical overconfidence patterns. But this penalty is: (1) not persisted — it's computed on read, so it changes retroactively as more reviews accumulate; (2) not visible to users — no UI element explains that confidence was adjusted; (3) different between live and history views — during a live session users see raw confidence, but in history they see penalized confidence.
- Where it exists: `src/lib/db/repository.ts` (getSessionDetail → applyCalibrationPenalty), `src/lib/decision/utils.ts` (normalizeEvidenceConfidence)
- Real-world failure mode: User sees confidence of 76% during live session. Later opens history and sees 58%. Thinks the system is buggy. Or worse, makes a different decision based on the retroactively-adjusted number without understanding why it changed.
- Why the builder may miss it: The penalty is conceptually defensible ("adjust for historical overconfidence"), so it feels like a feature. But its invisibility and retroactive nature violate the trust promise.
- Recommended fix: Either persist the penalty at review time (so it becomes stable) and show it explicitly in UI ("raw 76%, adjusted 58% based on 12 prior reviews"), or remove the penalty and instead show calibration context as advisory ("your prior decisions of this type were overconfident by ~18pt on average").
- Priority: `P0`

### Single-File UI Monolith Creates Systemic Maintenance Risk

- Status: `Verified`
- Why it matters: `src/app/page.tsx` is ~4,300 lines containing 32+ useState calls, all session management, all panel logic, all export functions, all history/replay/calibration UI, and all streaming orchestration. Any change to any feature touches this file. State synchronization between the Zustand store, the component's local state, and the backend is unmanageable at this scale.
- Where it exists: `src/app/page.tsx`
- Real-world failure mode: Adding any new feature (e.g., collaborative sessions, session templates, notification preferences) requires modifying a 4,300-line file where every useState and useCallback interacts with every other. Race conditions between historyDetail, store.decisionSummary, and the live session state are already present and will multiply.
- Why the builder may miss it: The file grew organically and still works. Each addition was small. The total weight becomes apparent only when reviewing the whole.
- Recommended fix: Split into ~8-10 feature-focused components: BriefPanel, CouncilPanel, ResearchPanel (already exists), DiscussionView, HistoryView, CalibrationView, ExportActions, SessionControls. Each gets its own state management hook. The main page becomes a layout coordinator.
- Priority: `P0`

---

### Confidence Numbers Are Precision Theater

- Status: `Inferred`
- Why it matters: The product displays confidence as a precise integer (e.g., "confidence 76%") at multiple levels: decision confidence, research confidence, outcome confidence, calibration gap. This implies measurement precision that doesn't exist. The base confidence comes from an LLM self-report in response to a prompt that says "confidence 用 0-100 的整数." The LLM has no calibration — it's producing a number that sounds reasonable, not measuring anything.
- Where it exists: `src/lib/orchestrator/moderator.ts:249` (prompt asks for integer), `src/lib/decision/utils.ts:386-416` (normalizeEvidenceConfidence applies penalties in 6-8-10 point increments), `src/components/discussion/decision-summary-card.tsx` (displays to user)
- Real-world failure mode: User sees "confidence 76%" and treats it as meaningfully different from 72% or 80%. In reality, the number is an artifact of LLM temperature, prompt wording, and heuristic penalties. The 8-point penalty for each unsupported claim (line 397) and the 10-point penalty for stale sources (line 409) are arbitrary constants that look scientific.
- Why the builder may miss it: The penalty system creates the appearance of rigor. Each penalty has a reason. But the base number is not meaningful, so adjusting it with fixed penalties creates false precision layered on false precision.
- Recommended fix: Replace numeric confidence with categorical bands: "strong evidence", "mixed evidence", "weak evidence", "insufficient evidence." If keeping numeric, display as a range (e.g., "60-80%") and explicitly label it as "model estimate, not a measurement." Add a tooltip or footnote explaining the source.
- Priority: `P0`

---

## High

### Browser Verification Is Keyword Matching, Not Verification

- Status: `Verified`
- Why it matters: The term "browser verification" and "verified facts" implies the system has confirmed the truth of claims against authoritative sources. In reality, `extractVerificationFields()` in `src/lib/search/browser-verify.ts:156-233` does regex-based sentence matching. It searches the page body for keywords like "salary", "location", "fee" and returns the first sentence containing that keyword. This is extraction, not verification. The extracted sentence could be from an ad, a sidebar, or an unrelated section.
- Where it exists: `src/lib/search/browser-verify.ts:156-233`, `src/components/discussion/research-panel.tsx` (UI shows "verified page", "Verified facts")
- Real-world failure mode: User verifies a job listing page. The system extracts "Compensation: $150,000" from a "similar jobs" sidebar, not from the actual listing. User treats this as verified evidence for their decision.
- Why the builder may miss it: The extraction works on well-structured pages with clear text. On demo pages or hand-picked URLs, it looks impressive. But real-world pages have nav bars, ads, related articles, cookie banners, and dynamic content that break sentence-level extraction.
- Recommended fix: Rename "verified" to "captured" or "extracted" throughout. Change "Verified facts" to "Extracted signals (manual review required)." Add a confidence indicator per extracted field that reflects extraction quality, not just a static high/medium/low.
- Priority: `P1`

### Calibration Dashboard Has N+1 Query Problem

- Status: `Verified`
- Why it matters: `getCalibrationDashboard()` in `src/lib/db/repository.ts` loops through all filtered sessions and calls `getSessionDetail(row.id)` for each one inside the loop. Each `getSessionDetail` call does multiple queries (session, decision summary, research run, sources, action items, events). With 100 reviewed sessions, this is 600+ queries per calibration load. With 1000, it's 6000+.
- Where it exists: `src/lib/db/repository.ts` (getCalibrationDashboard)
- Real-world failure mode: After 6 months of use with 200+ sessions, opening the calibration dashboard takes 10+ seconds. User thinks the app is broken.
- Why the builder may miss it: Works fine with <20 sessions. The performance cliff is invisible during development.
- Recommended fix: Write a single aggregation query that computes calibration stats directly from the sessions + decision_summaries tables with JOINs. No per-session detail fetch needed for aggregate stats.
- Priority: `P1`

### Research Evidence Silently Degrades Without User Awareness

- Status: `Verified`
- Why it matters: When TAVILY_API_KEY is not set, research silently skips and emits `research_complete` with empty content (`src/lib/orchestrator/orchestrator.ts:486-497`). The discussion proceeds without evidence, and the decision summary is generated with no source backing. But the product promise is "evidence-backed discussion." A discussion without research produces a decision card that looks identical to one with research, except with empty evidence fields and a slightly lower confidence score.
- Where it exists: `src/lib/orchestrator/orchestrator.ts:486-497` (silent skip), `src/components/discussion/decision-summary-card.tsx` (no visual differentiation)
- Real-world failure mode: User forgets to set TAVILY_API_KEY or it expires. All subsequent sessions complete successfully but with zero evidence. The decision cards still show recommendations, risks, and next actions — all of which are pure LLM confabulation rather than evidence-backed analysis. User doesn't notice because the UI doesn't make the absence of evidence salient.
- Why the builder may miss it: The graceful degradation was intentional — research is "optional." But for a product positioning itself on trust and evidence, silent evidence absence is a trust failure.
- Recommended fix: When research is skipped or failed, add a persistent banner on the decision card: "This decision was made without evidence research. Recommendations are based on model reasoning only." Differentiate the visual treatment (e.g., different card color, missing "evidence" badges).
- Priority: `P1`

### No Foreign Key Constraints or Referential Integrity

- Status: `Verified`
- Why it matters: The SQLite schema in `src/lib/db/client.ts` defines no foreign key constraints. `messages.session_id`, `research_sources.research_run_id`, `action_items.session_id`, `claim_source_links.claim_id`, `claim_source_links.source_id` — none have REFERENCES clauses. SQLite foreign keys are disabled by default anyway, but the schema doesn't even declare them.
- Where it exists: `src/lib/db/client.ts:22-187`
- Real-world failure mode: A session is deleted (if that feature is ever added) but its messages, research sources, claims, and action items remain as orphans. Or a research source is deleted but `claim_source_links` still reference it, causing the decision summary to show broken citation links.
- Why the builder may miss it: Application-level code currently manages relationships, and there's no delete session feature. But any future data management operation (cleanup, migration, merge) will be error-prone without referential integrity.
- Recommended fix: Add REFERENCES clauses with ON DELETE CASCADE to all foreign key columns. Enable `PRAGMA foreign_keys = ON` after database initialization. Add a test that verifies cascade behavior.
- Priority: `P1`

### Token Usage Estimation Is Systematically Wrong

- Status: `Verified`
- Why it matters: `estimateTokens()` in `src/lib/orchestrator/orchestrator.ts:297-299` estimates tokens as `Math.ceil(text.length / 4)`. This is wrong for Chinese text, where each character is 1-3 tokens (not 0.25). A 500-character Chinese response is ~500-1500 tokens, not 125. The system underreports token usage by 4-12x for Chinese content.
- Where it exists: `src/lib/orchestrator/orchestrator.ts:297-299`
- Real-world failure mode: User checks token usage in session detail and sees implausibly low numbers. If token usage is used for cost estimation or budgeting, it's off by an order of magnitude.
- Why the builder may miss it: The `text.length / 4` heuristic is common for English. The product produces Chinese output exclusively.
- Recommended fix: Use character-aware estimation: for CJK characters, count each as ~1.5 tokens; for ASCII, use length/4. Or use the actual token counts from API responses (which are available in `result.usage` for non-streaming calls, and could be accumulated for streaming calls).
- Priority: `P1`

### Action Item State Machine Allows Data Loss

- Status: `Verified`
- Why it matters: `ACTION_ITEM_TRANSITIONS` in `src/lib/decision/utils.ts:18-23` allows `pending → in_progress` but not `pending → verified` or `pending → discarded`. Once an item is `verified` or `discarded`, it can never transition to any other state. But during `syncGeneratedActionItems()` in `upsertDecisionSummary()`, action items are regenerated from the decision summary, potentially overwriting user edits.
- Where it exists: `src/lib/decision/utils.ts:18-23`, `src/lib/db/repository.ts` (upsertDecisionSummary → syncGeneratedActionItems)
- Real-world failure mode: User manually marks action items as in_progress, adds owners and notes. Then reruns research and the decision summary is re-generated. `syncGeneratedActionItems` runs and creates new action items from the new nextActions, potentially duplicating or overwriting the manually-edited ones.
- Why the builder may miss it: The sync is designed to keep action items aligned with the latest decision summary. But it conflicts with the manual editing workflow.
- Recommended fix: Never overwrite action items that have been manually edited (status != pending, or note/owner non-empty). Only add new items or soft-delete removed ones.
- Priority: `P1`

---

## Medium

### Resume Logic Is Complex But Untested

- Status: `Verified`
- Why it matters: `src/lib/orchestrator/resume.ts` is a 366-line state machine that determines how to resume failed/stopped sessions. It decides which phase to restart from, which messages to inherit, and which to discard. But there are zero tests for this module. The orchestrator tests test basic flow but don't cover resume at all.
- Where it exists: `src/lib/orchestrator/resume.ts`, `test/orchestrator.test.ts`
- Real-world failure mode: A session fails mid-debate. User resumes. The resume logic incorrectly determines the next phase, leading to duplicate messages, skipped analysis, or a summary generated from incomplete context.
- Why the builder may miss it: Resume works in the common case (session stopped cleanly, resume from beginning). Edge cases — partial debate rounds, degraded agents, research that completed but opening that didn't — are untested.
- Recommended fix: Add at least 8 test cases: resume from each phase, resume with degraded agents, resume with partial messages, resume with completed research but failed opening.
- Priority: `P1`

### Hardcoded Chinese Prompts Prevent Internationalization

- Status: `Verified`
- Why it matters: All moderator and agent prompts in `src/lib/orchestrator/moderator.ts` are hardcoded in Chinese (e.g., "你是一场圆桌讨论的主持人", "请用简洁的方式", "用中文回答"). The agent initial prompt is also Chinese: "请就以下议题发表你的观点：「${this.config.topic}」" (orchestrator.ts:718). The product cannot serve non-Chinese users without duplicating all prompt logic.
- Where it exists: `src/lib/orchestrator/moderator.ts`, `src/lib/orchestrator/orchestrator.ts:718`
- Real-world failure mode: Any attempt to expand to English or bilingual users requires rewriting or forking all prompts. The decision type labels, analysis checklist, and template content are all Chinese.
- Why the builder may miss it: The product is currently Chinese-only, so this isn't a bug — it's a positioning constraint. But it limits growth and makes it harder for non-Chinese contributors to work on the codebase.
- Recommended fix: Extract all prompts into a locale file. Add a language parameter to the discussion config. Implement English prompts as a second locale. This isn't urgent but prevents a hard rewrite later.
- Priority: `P2`

### Store and Component State Diverge During Async Operations

- Status: `Inferred`
- Why it matters: The Zustand store (discussion-store) and the page.tsx component state manage overlapping data. `historyDetail` in page.tsx has its own copy of actionItems, decisionSummary, and research data. The store has its own copies. When a user modifies an action item, page.tsx updates historyDetail locally, but the store may not be updated, and vice versa.
- Where it exists: `src/app/page.tsx` (historyDetail state vs. store state), `src/stores/discussion-store.ts`
- Real-world failure mode: User opens history for session A, sees action items. Switches to session B (historyDetail updates), then back to session A. If the async load for session A is slow, they might briefly see session B's data in session A's context.
- Why the builder may miss it: Each individual state update is correct. The problem is the interaction between multiple async updates happening concurrently.
- Recommended fix: Use a request ID or session ID guard on all async state updates. Discard results from stale requests. Consider consolidating historyDetail into the Zustand store to have one source of truth.
- Priority: `P2`

### Tavily Search Has No Rate Limiting or Cost Control

- Status: `Verified`
- Why it matters: `conductResearch()` in `src/lib/search/research.ts` fires up to 3 concurrent Tavily searches per session, with no per-user or per-session rate limiting. The research rerun endpoint allows up to `maxReruns` (default 2) additional research runs. A user could trigger 3 × 3 = 9 Tavily API calls per session.
- Where it exists: `src/lib/search/research.ts:26-33`, `src/app/api/sessions/[id]/research/route.ts`
- Real-world failure mode: Tavily API costs accumulate. A user running 10 sessions per day with reruns could generate 90+ Tavily calls daily. No visibility into cost.
- Why the builder may miss it: Tavily basic plans have generous limits. The cost isn't visible until it's a problem.
- Recommended fix: Add a daily API call counter. Display estimated research cost in the UI. Consider caching Tavily results for identical queries within a time window.
- Priority: `P2`

### Snapshot Files Accumulate Without Cleanup

- Status: `Verified`
- Why it matters: `writeVerificationSnapshot()` and `capturePageScreenshot()` in `src/lib/search/browser-verify.ts` write files to `data/verification-captures/` with unique filenames (nanoid). These files are never cleaned up — no TTL, no session-deletion cascade, no garbage collection. Screenshots are PNG files that could be 1-5MB each.
- Where it exists: `src/lib/search/browser-verify.ts:272-315` (write), no cleanup logic exists
- Real-world failure mode: After 6 months of daily use with browser verification, `data/verification-captures/` contains thousands of files totaling 5-20GB. Disk fills up silently.
- Why the builder may miss it: Local development uses few verifications. The accumulation is slow.
- Recommended fix: Add a cleanup job that removes snapshots older than 90 days, or snapshots whose session has been deleted. Add a session-deletion cascade that removes associated snapshot files.
- Priority: `P2`

### No Authentication or Session Isolation

- Status: `Verified`
- Why it matters: All API routes are public. Any client can start sessions, read any session's details, modify action items, trigger research, or export artifacts for any session ID. There is no user concept in the schema.
- Where it exists: All routes in `src/app/api/sessions/`
- Real-world failure mode: If deployed to any non-localhost environment, anyone with the URL can access all decision data. Since this is a "personal decision assistant" for "high-stakes decisions," the data is inherently sensitive (career decisions, financial allocations, life choices).
- Why the builder may miss it: Currently running localhost only. Authentication is deferred.
- Recommended fix: Before any deployment beyond localhost, add at minimum: session-level access tokens, or a simple auth layer. For personal use, a passphrase-protected mode would suffice.
- Priority: `P2`

### SSE Stream Has No Heartbeat or Reconnection Logic

- Status: `Verified`
- Why it matters: The start route returns an SSE stream that runs for up to 5 minutes (maxDuration = 300). If the connection drops mid-session, there's no heartbeat to detect it and no reconnection mechanism. The client will stop receiving updates but the orchestrator continues running server-side, persisting messages to the DB that the client never sees.
- Where it exists: `src/app/api/sessions/[id]/start/route.ts:301-338` (stream), client-side SSE handling in page.tsx
- Real-world failure mode: User on flaky WiFi loses connection during debate phase. Backend continues generating, but frontend freezes. When user refreshes, they see a completed session they didn't watch.
- Why the builder may miss it: Works perfectly on localhost with stable connection. SSE reconnection is a known hard problem.
- Recommended fix: Add a 15-second heartbeat event. Client should detect missed heartbeats and attempt reconnection. Use the resume logic to catch up on missed events from persisted messages.
- Priority: `P2`

---

## Low

### ESLint Configuration Is Minimal

- Status: `Verified`
- Why it matters: `eslint.config.mjs` only extends `next/core-web-vitals` and `next/typescript`. No React Hooks exhaustive-deps rule, no component complexity rules, no accessibility rules. The 4,300-line page.tsx would be flagged by any reasonable complexity rule.
- Where it exists: `eslint.config.mjs`
- Recommended fix: Add `eslint-plugin-react-hooks` with exhaustive-deps warning, and consider `@eslint/complexity` for file-level complexity limits.
- Priority: `P2`

### Legacy Source Index Migration Has Diminishing Returns

- Status: `Verified`
- Why it matters: `normalizeEvidenceItem()` in `src/lib/decision/utils.ts:344-384` handles both `sourceIds` (citation labels like "R1") and legacy `sourceIndices` (numeric array indexes). The legacy path adds complexity but only matters for sessions created before the citation label system was introduced.
- Where it exists: `src/lib/decision/utils.ts:354-367`
- Recommended fix: Add a one-time migration script that converts all legacy sourceIndices to sourceIds in the database, then remove the legacy code path.
- Priority: `P2`

### Cover Page Layout Hardcodes Pixel Positions

- Status: `Verified`
- Why it matters: `renderCoverPage()` in `src/lib/session-artifact-files.ts:214-273` uses hardcoded y-offsets (bodyY=120, bodyY+78, bodyY+182, bodyY+300). If the topic title is long (3+ lines), it overlaps with the summary text below it. The recommendation box is positioned at x=390, which overflows on narrower page sizes.
- Where it exists: `src/lib/session-artifact-files.ts:214-273`
- Recommended fix: Use a flow-based layout where each element's y position depends on the previous element's rendered height. PDFKit supports `doc.y` tracking for this.
- Priority: `P2`

---

## Systemic Patterns

Three recurring design patterns cause multiple problems:

1. **Trust theater over trust substance**: The product adds trust-signaling UI elements (confidence percentages, "verified" labels, calibration metrics, evidence badges) faster than it builds the underlying rigor. Each individual signal is defensible, but collectively they create an impression of precision that the system cannot deliver. A user seeing "confidence 76%, research 82%, backed 4, unsupported 1, sources 3, domains 2, stale 0" will treat this as measurement rather than approximation.

2. **Vertical integration without modular boundaries**: The system is vertically integrated from DB through API through orchestrator through LLM through UI. This gives end-to-end control but means every subsystem knows too much about every other. The orchestrator imports search types. The repository imports decision types. The UI imports everything. Changes to any layer ripple through all layers. The 4,300-line page.tsx is the extreme expression of this pattern.

3. **Optimistic persistence without transactional safety**: Most DB writes are fire-and-forget callbacks (`onMessagePersist`, `onUsagePersist`, `onSessionEventPersist`). If any callback fails, the orchestrator continues running — meaning the in-memory state and the DB state diverge silently. There are no transactions wrapping related writes (e.g., decision summary + action items + claims should be atomic). This is fine for a local prototype but becomes a data integrity risk at any scale.

---

## What I Think The Product Really Is Today

Round Table is a well-structured research prototype for a personal decision assistant. It has:

- A complete end-to-end flow from brief to dossier
- A multi-provider multi-model agent infrastructure that actually works
- A thoughtful decision model with briefs, claims, evidence, and action items
- An operational monitoring surface (ops watch, degraded agents, session events)
- A calibration concept that is directionally interesting

It is NOT yet:

- A trusted tool (too many places where presentation exceeds capability)
- A production system (no auth, no error recovery, no file cleanup)
- A usable tool for non-technical users (extreme cognitive load, builder-centric terminology)
- A calibrated system (needs hundreds of reviewed sessions to produce meaningful statistics)

The product is currently in the "impressive demo" phase — it works end-to-end for a patient technical user who understands its limitations, but would confuse or mislead a user who takes the UI at face value.

---

## What Is Most Likely To Break First In Real User Usage

1. **PDF export**: User exports their first dossier and it's blank (Chinese stripped). Instant trust destruction.
2. **Cognitive overload**: User opens the app, sees 8 input fields + agent selection + model selection + persona selection + research config + template selection, and closes the tab. The brief-to-discussion funnel has too much friction.
3. **Research failure without explanation**: Tavily key expires or is never set. Sessions complete without evidence. User doesn't notice until they review the decision card weeks later.
4. **Slow calibration page**: After 50+ sessions, the calibration dashboard takes 5+ seconds to load. User assumes the feature is broken.
5. **Browser verification on real pages**: User tries to verify a Glassdoor page, a Zillow listing, or a bank product page. The keyword extraction returns nonsense or nothing, because real pages are JavaScript-heavy, have complex layouts, and don't have clean text content.

---

## Top 5 Fixes Before Wider Release

1. **Fix PDF CJK rendering**: Embed a CJK font, remove ASCII-only sanitization. This is a 2-hour fix that prevents the most visible trust failure.

2. **Make evidence absence visible**: When research is skipped/failed, show a persistent warning on the decision card and in the dossier. "This decision was made without external evidence." This is a 1-hour fix that prevents the most dangerous trust failure.

3. **Refactor page.tsx**: Split into 6-8 focused components. This is a 2-day effort that unlocks all future development velocity.

4. **Replace "verified" with "captured"**: Change terminology throughout browser verification. "Verified facts" → "Extracted signals." "verified page" → "captured page." This is a 30-minute find-and-replace that prevents misplaced trust.

5. **Make confidence visible as a range, not a point**: Show "confidence: 70-80% (model estimate)" instead of "confidence: 76%." Add a tooltip explaining the source. This prevents users from over-indexing on fake precision.

---

## What To De-Scope Immediately If Focus Is The Goal

1. **Calibration dashboard**: It needs hundreds of reviewed sessions to be meaningful. Before then, it's analytical theater. Ship it as a hidden/advanced feature, not a top-level tab. The complexity it adds (N+1 queries, penalty computation, confidence adjustment, template hit rates, agent model drift) is not paying off at current scale.

2. **Persona presets and custom personas**: The agent persona system adds a third layer of customization (agent → model → persona) that most users will never touch. The default behavior is good enough. De-scope to reduce brief-form complexity.

3. **Session resume logic**: 366 lines of untested state machine logic for a feature that fires rarely (only when sessions fail). Simpler alternative: just offer "start over" with the same brief pre-filled. This eliminates resume.ts entirely.

4. **Replay mode**: The replay system adds significant UI complexity (replay controls, replay position tracking, message visibility filtering) for a feature that's rarely used. Users care about the decision card, not rewatching the discussion.

5. **Verification profiles**: 6 domain-specific extraction profiles that depend on regex keyword matching. The extraction quality is too low to justify the profile-selection UX. Simplify to a single "capture page" action without profile selection.

---

## P0 / P1 / P2 Action Table

| Issue | Severity | Confidence | Owner Area |
|-------|----------|------------|------------|
| PDF strips all Chinese content | P0 | Verified | backend / export |
| Calibration penalty invisible and retroactive | P0 | Verified | backend / data / frontend |
| page.tsx monolith (4,300 lines) | P0 | Verified | frontend |
| Confidence numbers are precision theater | P0 | Inferred | prompts / frontend / product |
| "Verified" label misleads about extraction quality | P1 | Verified | frontend / product |
| Calibration N+1 query problem | P1 | Verified | backend / data |
| Research skip is invisible | P1 | Verified | frontend / product |
| No foreign keys or referential integrity | P1 | Verified | data |
| Token estimation wrong for Chinese | P1 | Verified | backend |
| Action items overwritten by decision re-sync | P1 | Verified | backend / data |
| Resume logic untested | P1 | Verified | backend / test |
| Hardcoded Chinese prompts | P2 | Verified | prompts |
| Store/component state divergence | P2 | Inferred | frontend |
| No Tavily rate limiting | P2 | Verified | backend |
| Snapshot file accumulation | P2 | Verified | backend / infra |
| No authentication | P2 | Verified | infra |
| SSE no heartbeat/reconnection | P2 | Verified | backend / frontend |
| ESLint too minimal | P2 | Verified | infra |
| Legacy sourceIndices migration | P2 | Verified | data |
| PDF cover layout hardcoded | P2 | Verified | backend / export |
