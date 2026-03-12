# Round Table Red-Team Review (Exhaustive Deep Dive)

## Executive Summary
Following a comprehensive inspection of the `src/` directory—spanning the Drizzle repository, Next.js API routes, Zustand state management, SSE multiplexing, and PDF generation—Round Table reveals itself as a beautifully constructed UX layer built atop fragile, probabilistic, and occasionally broken data foundations. 

While the "decision dossier output" and "follow-up" workflows are structurally present, the core promises of "calibration" and "evidence-backed" discussion are functionally misleading. The system masks generative LLM hallucinations with authoritative UI components, relies on arbitrary hardcoded math rather than true calibration, and contains catastrophic scaling and data-loss bugs hidden behind the polished UI.

## Severity Map: Verified Code-Level Flaws

### 1. The Calibration Promise is Security Theater (Arbitrary Hardcoded Math)
- **Status:** `Verified`
- **Where it exists:** `src/lib/decision/utils.ts` (`normalizeEvidenceConfidence`)
- **The Code Reality:** The architecture claims a sophisticated "Retrospective Calibration" system tracking model overconfidence. In reality, the prompt asks the LLM for a confidence score (which LLMs are notoriously bad at estimating), and then the backend explicitly mutates that number using arbitrary hardcoded subtractions:
  ```typescript
  const unsupportedClaims = evidence.filter((item) => item.sourceIds.length === 0).length;
  confidence -= Math.min(unsupportedClaims * 8, 24);
  // ...
  if (citedSources.length > 0 && staleCount / citedSources.length >= 0.5) {
    confidence -= 10;
  }
  ```
- **Why it matters:** The entire premise of a "trusted personal decision assistant" rests on accurate calibration. Silently subtracting `-8` or `-10` points behind the scenes creates a completely manufactured confidence score that trains the user to trust a mathematical illusion. 
- **Priority:** `P0` (Violates core product promise)

### 2. PDF Dossier Silent Data Loss (ASCII Stripping)
- **Status:** `Verified`
- **Where it exists:** `src/lib/session-artifact-files.ts` (`toPdfSafeText`)
- **The Code Reality:** `replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')`
- **Why it matters:** The system is explicitly prompted to generate outputs in Chinese (`所有文本都用中文。` in `moderator.ts`). This regex silently strips all non-ASCII characters from the PDF payload. The exported Dossier will be completely blank for all core content. 
- **Priority:** `P0` 

### 3. N+1 Calibration Dashboard Collapse
- **Status:** `Verified`
- **Where it exists:** `src/lib/db/repository.ts` (`getCalibrationDashboard`)
- **The Code Reality:** The SQL schema (`src/lib/db/schema.ts`) traps the `predictedConfidence` inside a JSON string blob (`decision_summaries.summaryJson`). To render the calibration dashboard, the DB repository loops over every single historical session and executes `getSessionDetail()`, which triggers roughly 9 separate table queries per session. 
- **Why it matters:** A user with 100 historical decisions triggers ~900 synchronous SQLite queries to load the dashboard, leading to instant request timeouts, Vercel function limits, and unrecoverable database locks.
- **Priority:** `P1`

### 4. Zustand State Hydration Race Condition
- **Status:** `Verified`
- **Where it exists:** `src/hooks/use-discussion-stream.ts` (`hydrateSessionArtifactsFromSession`)
- **The Code Reality:** When `discussion_complete` fires via SSE, the frontend asynchronously fetches the final session artifacts. It reads the current `sessionId`, awaits the fetch, and then writes the result to the store (`useDiscussionStore.getState().setUsage(...)`).
  ```typescript
  async function hydrateSessionArtifactsFromSession() {
    const sessionId = useDiscussionStore.getState().sessionId;
    // ... await fetch ...
    useDiscussionStore.getState().setDecisionSummary(data);
  }
  ```
- **Why it matters:** If a user clicks "Start New Discussion" immediately after one finishes, the `sessionId` in the store changes. The pending `fetch` from the previous session resolves and silently overwrites the *new* session's clean state with the *old* session's tokens, summary, and action items. This cross-session data contamination violates user trust.
- **Priority:** `P1`

### 5. Brittle SPA Browser Verification (Blind AI)
- **Status:** `Verified`
- **Where it exists:** `src/lib/search/browser-verify.ts`
- **The Code Reality:** Verification relies on `await fetch(url)`. For modern SPAs (React, Vue, single-page newsletters), this returns `<div id="root"></div>`. Meanwhile, the `captureScreenshot` function successfully takes a Playwright visual snapshot.
- **Why it matters:** The UI shows a beautiful, verifiable screenshot to the human, making the human think the AI read the page. In reality, the AI was fed an empty HTML string. The system is unknowingly asking the LLM to hallucinate evidence based purely on the URL slug.
- **Priority:** `P1`

### 6. Generative Attribution Hallucination
- **Status:** `Verified`
- **Where it exists:** `src/lib/orchestrator/moderator.ts` (`buildDecisionSummaryPrompt`)
- **The Code Reality:** The system instructs the LLM to cite sources via JSON arrays (`"sourceIds": ["R1"]`). The UI components parse this perfectly and render authoritative "supported" badges with hyperlinks. There is absolutely zero programmatic validation that the text in `R1` actually entails or supports the claim. 
- **Why it matters:** The UI masks the probabilistic nature of generative AI behind deterministic-looking, hardcoded badges. Given the browser fetch failures (Point 5), the LLM will frequently output confident claims mapped to sources it never actually read.
- **Priority:** `P2`

## Architectural Conclusions
Round Table is a masterclass in UI/UX frontend engineering that successfully creates the *feeling* of a rigorous, moderator-led decision pipeline. However, its backend logic leverages "security theater"—using string manipulation, arbitrary arithmetic, and untested JSON maps to enforce structural guarantees that simply do not exist at runtime. 

If this product is intended for "high-stakes personal decisions", it is currently unsafe for use.

## Recommended Immediate Action Plan
1. **Remove `toPdfSafeText` completely** and import a standard Unicode CJK font for PDFKit.
2. **Denormalize the Database:** Add `predictedConfidence` directly as an integer column to the `sessions` table. Do not parse JSON in `getCalibrationDashboard`.
3. **Fix the Zustand Race:** Pass `sessionId` directly into `hydrateSessionArtifactsFromSession(id)` and verify it matches `useDiscussionStore.getState().sessionId` *after* the `await` returns before applying mutations.
4. **Remove Arbitrary Confidence Math:** Strip `normalizeEvidenceConfidence` of its `-8` and `-10` logic. Return the raw LLM confidence, or build an actual programmatic derivation model.
5. **Move to Playwright text extraction:** Stop using raw `fetch` for browser verification if Playwright is already being spun up for screenshots. Extract the actual DOM `innerText`.
