# Round Table — LLM Onboarding Context

> **PURPOSE**: This document enables a fresh LLM session to understand the entire Round Table codebase without reading source files. It is structured for machine consumption — dense, cross-referenced, and exhaustive. Updated with each git commit.
>
> **Last updated**: 2026-03-19 | **Commit**: 1315665

---

## §1 SYSTEM OVERVIEW

Round Table is a **multi-agent LLM debate/decision system**. Core flow:

```
User inputs topic + brief
  → Research (Tavily web search)
  → Opening (moderator intro)
  → Initial Responses (N agents in parallel, streamed)
  → Analysis (moderator aggregates, finds agreements/disagreements)
  → Debate loop (up to maxDebateRounds, if disagreements exist)
  → Summary (moderator minutes)
  → Decision Summary + Judge Gate (L0→L1→LLM dimensions → PASS/REWRITE/ESCALATE)
  → Complete
```

**Tech stack**: Next.js 16 (App Router), TypeScript strict, React 19, Zustand 5, Drizzle ORM + better-sqlite3, SSE streaming, Tailwind CSS 4, Framer Motion.

**LLM Providers**: Anthropic (Claude), OpenAI (GPT), DeepSeek, Moonshot (Kimi), SiliconFlow (MiniMax, GLM, Qwen).

---

## §2 FILE STRUCTURE

```
src/
├── app/
│   ├── api/sessions/                    # 22 API route files
│   │   ├── [id]/start/route.ts          # POST — main orchestration entry, SSE stream
│   │   ├── [id]/stop/route.ts           # POST — request session stop
│   │   ├── [id]/interjections/route.ts  # POST — user interjections
│   │   ├── [id]/resume-preview/route.ts # POST — preview resumable state
│   │   ├── [id]/route.ts               # GET session detail, PATCH update review
│   │   ├── [id]/research/              # POST research re-run, verify, sources
│   │   ├── [id]/follow-up/route.ts     # POST create follow-up session
│   │   ├── [id]/action-items/          # PATCH action item status
│   │   ├── [id]/artifacts/             # GET list, GET download
│   │   ├── [id]/ledger/route.ts        # GET task ledger
│   │   ├── route.ts                    # GET list sessions
│   │   ├── ops/route.ts               # GET operational metrics
│   │   └── calibration/route.ts       # POST calibration dashboard
│   ├── page.tsx                        # Main UI (session config + stream display)
│   ├── layout.tsx                      # Root layout (ThemeProvider, Toaster)
│   └── globals.css                     # Tailwind + CSS variables
├── components/
│   ├── discussion/                     # 12 components: discussion-feed, agent-card,
│   │                                   #   decision-summary-card, research-panel,
│   │                                   #   action-items-board, round-table-stage, etc.
│   ├── workspace/                      # 5 workspace shell components
│   └── ui/                            # shadcn base components (button, card, etc.)
├── hooks/
│   └── use-discussion-stream.ts        # SSE client: startDiscussion(), handleEvent()
├── stores/
│   └── discussion-store.ts             # Zustand: all real-time UI state
├── lib/
│   ├── agents/
│   │   ├── registry.ts                 # AGENT_CATALOG (7 agents), getModelId()
│   │   ├── types.ts                    # AgentDefinition, SessionAgent, PersonaPreset
│   │   └── persona-presets.ts          # 10 persona presets
│   ├── orchestrator/
│   │   ├── orchestrator.ts             # DiscussionOrchestrator class (~1600 lines)
│   │   ├── types.ts                    # DiscussionConfig, TaskLedger, phases, etc.
│   │   ├── moderator.ts               # Prompt builders (8 functions)
│   │   ├── task-ledger.ts             # initTaskLedger, updateLedgerFromAnalysis
│   │   ├── resume.ts                  # buildResumePlan (5 resume cases)
│   │   ├── stream-multiplexer.ts      # multiplexStreams, nextWithTimeout
│   │   ├── failure-classifier.ts      # classifyError → transient/degraded/terminal
│   │   ├── ledger-extractor.ts        # Extract structured data from ledger
│   │   ├── ledger-validator.ts        # Validate ledger consistency
│   │   └── cursor-fsm.ts             # Cursor state machine
│   ├── decision/
│   │   ├── judge.ts                   # runL0Checks, runL1Checks, evaluateSummary
│   │   ├── types.ts                   # DecisionSummary, ActionItem, Lesson, etc.
│   │   ├── utils.ts                   # normalizers, parsers, confidence meta
│   │   ├── reflection.ts             # T6: SessionEndReflection, ForecastEntry
│   │   ├── follow-up-context.ts      # T6: buildFollowUpContext (DEAD CODE)
│   │   ├── evaluator.ts              # Legacy evaluator prompts
│   │   ├── templates.ts              # Decision templates
│   │   ├── trust-boundary.ts         # Trust validation
│   │   └── rewrite-loop.ts           # Rewrite logic helpers
│   ├── llm/
│   │   ├── provider-registry.ts       # getProvider(), test overrides
│   │   ├── anthropic-provider.ts      # AnthropicProvider (streamChat, chat)
│   │   ├── openai-provider.ts         # OpenAIProvider
│   │   ├── deepseek-provider.ts       # DeepSeekProvider (maxRetries: 1)
│   │   ├── moonshot-provider.ts       # MoonshotProvider (maxRetries: 1)
│   │   ├── siliconflow-provider.ts    # SiliconFlowProvider (acquireSlot concurrency)
│   │   └── types.ts                   # LLMProvider, ChatParams, StreamChunk
│   ├── search/
│   │   ├── research.ts               # conductResearch (Tavily queries)
│   │   ├── tavily.ts                 # Raw Tavily API call
│   │   ├── browser-verify.ts         # Playwright DOM capture
│   │   ├── utils.ts                  # Citation labels, quality evaluation
│   │   └── types.ts                  # ResearchSource, ResearchConfig
│   ├── sse/
│   │   ├── types.ts                  # SSEEvent, SSEEventType, encodeSSE
│   │   └── event-buffer.ts           # Ring buffer (200/session, 30min TTL)
│   ├── db/
│   │   ├── schema.ts                 # 18 Drizzle tables
│   │   ├── client.ts                 # better-sqlite3 init + ensureColumn migrations
│   │   └── repository.ts            # All DB CRUD (~3000 lines)
│   └── session/types.ts              # SessionDetail, SessionRecord, OpsSummary
├── test/                              # 14 test files (node:test)
└── proxy.ts                          # Development proxy config
```

---

## §3 DATABASE SCHEMA (18 tables)

### Core tables
| Table | PK | Key columns |
|-------|-----|------------|
| `sessions` | `id` (text) | topic, goal, background, constraints, timeHorizon, nonNegotiables, acceptableDownside, reviewAt, decisionType, desiredOutput, templateId, agendaConfig(JSON), researchConfig(JSON), parentSessionId, resumedFromSessionId, resumeSnapshot, decisionStatus, moderatorAgentId, maxDebateRounds, selectedAgentIds(JSON), modelSelections(JSON), personaSelections(JSON), personas(JSON), usageInputTokens, usageOutputTokens, stopRequested, status, createdAt, updatedAt |
| `messages` | `id` | sessionId, role(`agent`/`moderator`/`user`/`system`), agentId, displayName, phase, round, content, createdAt |
| `minutes` | `sessionId` | content, createdAt, updatedAt |
| `decision_summaries` | `sessionId` | content(JSON→DecisionSummary), predictedConfidence, supportedOnly, evidenceSourceCount, unsupportedClaimCount, unresolvedEvidenceCount |

### Research & evidence
| Table | Key columns |
|-------|------------|
| `research_runs` | sessionId, status, queryPlan(JSON), searchConfig(JSON), summary, evaluation(JSON), rerunCount |
| `research_sources` | researchRunId, sourceType(`research`/`browser_verification`), title, url, domain, snippet, score, selected, pinned, rank, stale, qualityFlags(JSON), publishedDate, snapshotPath, claimHint, verificationNotes(JSON), extractionMethod, captureStatus |
| `decision_claims` | sessionId, claim, kind(`evidence`), gapReason |
| `claim_source_links` | claimId, sourceId |

### Orchestration state
| Table | Key columns |
|-------|------------|
| `session_events` | sessionId, type, provider, modelId, phase, agentId, timeoutType, message, metadata(JSON) |
| `interjections` | sessionId, content, controlType, phaseHint, roundHint, consumed, consumedPhase, consumedRound, consumedAt |
| `agent_reply_artifacts` | sessionId, agentId, phase, round, schemaVersion, artifactJson, parseSuccess, citationResolveRate, warnings(JSON) |
| `task_ledger_checkpoints` | sessionId, phase, ledgerVersion, ledgerJson |
| `ledger_validation_metrics` | sessionId, coverageRate, coveredCount, totalCount, riskCount, highSeverityCount |

### Judge & summary versioning
| Table | Key columns |
|-------|------------|
| `judge_evaluations` | sessionId, summaryVersion, passedCount, totalDimensions, overallPassed, gate(`PASS`/`REWRITE`/`ESCALATE`), rewriteInstructionsJson, escalateReason, dimensionsJson, humanReviewResult |
| `summary_versions` | sessionId, version, summaryJson, rewriteTriggered |

### Action items
| Table | Key columns |
|-------|------------|
| `action_items` | sessionId, content, status(`pending`/`in_progress`/`verified`/`discarded`), source(`generated`/`carried_forward`), owner, dueAt, priority |

### Decision memory (T6) — tables defined but NOT created in migrations
| Table | Key columns |
|-------|------------|
| `session_reflections` | sessionId(unique), decisionSummary, assumptionsJson, evidenceGapsJson, forecastItemsJson, lessonsCandidateJson |
| `lessons` | rule, applicabilityConditions, evidenceBasisJson, patternCount, reviewAfterSessions, conflictMarker, status(`candidate`/`active`/`expired`/`contradicted`) |

---

## §4 CORE TYPE DEFINITIONS

### Enums and unions
```typescript
DiscussionPhase = CREATED | RESEARCH | OPENING | INITIAL_RESPONSES | ANALYSIS | DEBATE | CONVERGENCE | SUMMARY | COMPLETED
ProviderType = 'anthropic' | 'openai' | 'siliconflow' | 'deepseek' | 'moonshot'
DecisionType = 'general' | 'investment' | 'product' | 'career' | 'life' | 'risk'
DesiredOutput = 'recommendation' | 'comparison' | 'risk_assessment' | 'action_plan' | 'consensus'
DecisionStatus = 'draft' | 'completed' | 'adopted' | 'discarded' | 'needs_follow_up' | 'degraded'
ActionItemStatus = 'pending' | 'in_progress' | 'verified' | 'discarded'
DecisionControlType = 'general' | 'add_constraint' | 'ask_comparison' | 'force_converge' | 'continue_debate'
JudgeGate = 'PASS' | 'REWRITE' | 'ESCALATE'
FailureClass = 'transient' | 'degraded' | 'terminal'
SSEEventType = heartbeat | phase_change | agent_start | agent_token | agent_done | agent_error | agent_degraded | moderator_start | moderator_token | moderator_done | user_interjection | discussion_complete | resume_snapshot | research_start | research_result | research_complete | research_failed | system_note
```

### Key interfaces (abbreviated)
```typescript
DecisionBrief { topic, goal, background, constraints, timeHorizon, nonNegotiables, acceptableDownside, reviewAt, decisionType, desiredOutput, templateId? }
DiscussionAgenda { focalQuestions, requiredDimensions, requireResearch: bool, requestRecommendation: bool }
DecisionSummary { summary, recommendedOption, why[], risks[], openQuestions[], nextActions[], alternativesRejected[], redLines[], revisitTriggers[], confidence: 0-100, evidence: DecisionSummaryEvidence[], rawConfidence?, adjustedConfidence?, trustViolations? }
DecisionSummaryEvidence { claim, sourceIds: string[], gapReason?, claimType?, verificationStatus? }
AgentDefinition { id, displayName, provider, modelId, availableModels[], envKeyName, envOverride?, defaultTemperature, maxTokens, color, sprite }
SessionAgent { definition: AgentDefinition, selectedModelId?, personaSelection?, persona? }
DiscussionConfig { sessionId, topic, brief, agenda, researchConfig, agents[], moderatorAgentId, maxDebateRounds, parentContext?, resumeState?, resumeSnapshot?, drainInterjections(), shouldStop(), onMessagePersist(), onSummaryPersist(), onDecisionSummaryPersist(), onResearchRunPersist(), onResearchSourcesPersist(), onUsagePersist(), onSessionEventPersist() }
TaskLedger { briefSummary, nonNegotiables[], acceptedClaims[], rejectedClaims[], unresolvedDisagreements[], evidenceGaps[], currentQuestions[], convergenceReached, lastUpdatedRound, ledgerVersion, threadId, currentPhase, phaseHistory[], riskRegister[], decisionSnapshot, cursor: {nextTaskId, waitingOn, stallSignal} }
SSEEvent { type, agentId?, phase?, content?, round?, meta?, timestamp, eventId?, replayed? }
StreamChunk { type: 'text_delta'|'done'|'error', content, errorCode?, timeoutType? }
LLMProvider { providerId, streamChat(ChatParams) → AsyncIterable<StreamChunk>, chat(ChatParams) → ChatResponse }
StructuredAgentReply { schemaVersion: 'rt.agent.reply.v1', stance, claims[], caveats[], questionsForOthers[], narrative }
ModeratorAnalysis { agreements[], disagreements[], shouldConverge: bool, moderatorNarrative }
JudgeEvaluationResult { gate, dimensions: JudgeDimension[], rewriteInstructions?, escalateReason?, passedCount, totalDimensions, overallPassed }
```

---

## §5 AGENT CATALOG (7 agents)

| id | displayName | provider | defaultModel | envKey | SiliconFlow? |
|----|------------|----------|-------------|--------|:---:|
| claude | Claude | anthropic | claude-sonnet-4-20250514 | ANTHROPIC_API_KEY | - |
| gpt | GPT | openai | gpt-4o | OPENAI_API_KEY | - |
| deepseek | DeepSeek | deepseek | deepseek-chat | DEEPSEEK_API_KEY | - |
| minimax | MiniMax | siliconflow | Pro/MiniMaxAI/MiniMax-M2.5 | SILICONFLOW_API_KEY | yes |
| kimi | Kimi | moonshot | kimi-k2.5 | MOONSHOT_API_KEY | - |
| glm | GLM | siliconflow | Pro/zai-org/GLM-5 | SILICONFLOW_API_KEY | yes |
| qwen | Qwen | siliconflow | Qwen/Qwen3.5-397B-A17B | SILICONFLOW_API_KEY | yes |

SiliconFlow agents share one API key and are subject to batch concurrency limits (env: `ROUND_TABLE_SILICONFLOW_BATCH_SIZE`, default 1).

---

## §6 REQUEST LIFECYCLE (POST /api/sessions/{id}/start)

### 6.1 Entry (start/route.ts)
1. Parse body → normalize brief, agenda, researchConfig
2. Resolve agents from AGENT_CATALOG (check env keys, validate models, resolve personas)
3. Handle resume (buildResumePlan) or parent session (buildParentContext)
4. createSession() → DB insert
5. Wire persistence callbacks (onMessagePersist → appendMessage, etc.)
6. Instantiate DiscussionOrchestrator with full config
7. Create ReadableStream, wire SSE encoding + event buffer + heartbeat (15s interval)
8. `for await (event of orchestrator.run())` → push to buffer → encode SSE → enqueue
9. On catch: persist error event, emit agent_error SSE
10. Finally: updateSessionStatus (completed/failed/stopped), close stream

### 6.2 Orchestrator.run() phase sequence
```
async *run(): AsyncIterable<SSEEvent>
  ├── shouldStop() check (cached 3s)
  ├── If NOT resuming:
  │   ├── phaseResearch()     → Tavily search, citation labels (R1, R2...)
  │   ├── phaseOpening()      → Moderator intro (streaming)
  │   └── phaseInitialResponses() → All agents parallel (streaming + structured block filter)
  ├── If resuming: skip completed phases based on resumeState.nextPhase
  ├── Debate loop (round 0..maxDebateRounds-1):
  │   ├── consumeInterjections(ANALYSIS, round)
  │   ├── phaseAnalysis(round)   → Moderator chat() → parseAnalysis → ModeratorAnalysis
  │   ├── If forceConvergeRequested: break
  │   ├── If disagreements && !shouldConverge:
  │   │   ├── consumeInterjections(DEBATE, round)
  │   │   └── phaseDebate(round) → Each disagreement → agents parallel (streaming)
  │   └── updateLedgerFromAnalysis()
  ├── consumeInterjections(SUMMARY)
  ├── phaseSummary()         → Moderator streaming
  ├── generateDecisionSummary()  → Judge Gate → Rewrite Loop
  ├── Yield phase_change(COMPLETED)
  └── Yield discussion_complete
```

### 6.3 phaseInitialResponses detail
- Gets active participants (non-moderator, non-degraded)
- Builds per-agent prompts with structured reply schema (---STRUCTURED--- marker)
- Streams all agents in parallel via stream multiplexer
- Filters out ---STRUCTURED--- blocks from SSE events (server-side)
- On completion: parseStructuredAgentReply → split narrative + JSON → persist artifacts

### 6.4 generateDecisionSummary + Judge Gate
```
1. Build decision summary prompt (Chinese, JSON schema output)
2. provider.chat() → parse JSON → DecisionSummary
3. L0 check (structural: non-empty fields)
4. L1 check (citation labels resolve to known R1-Rn)
5. evaluateSummary() → 4-6 dimensions:
   - structural_completeness (from L0, hard)
   - citation_resolvability (from L1, hard)
   - brief_constraint_adherence (hard) — redLines cover nonNegotiables ≥60%
   - evidence_coverage (hard) — sourced evidence ≥50%
   - risk_disclosure (hard) — high-severity risks covered ≥50%
   - internal_consistency (soft/WARN) — logical coherence ≥75%
6. Gate decision:
   - PASS: no hard FAILs
   - REWRITE: hard FAILs exist, rewriteCount < 2
   - ESCALATE: ABSTAIN dimension OR maxRewrites reached
7. Rewrite loop (max 2):
   - Append judge fix instructions to prompt
   - Re-generate → re-evaluate
   - Keep better version (by passedCount)
8. Persist: recordJudgeEvaluation, upsertSummaryVersion, upsertDecisionSummary
```

---

## §7 SSE EVENT FLOW

### Server emits (orchestrator → route handler → SSE stream)
| Event | When | Key payload fields |
|-------|------|--------------------|
| phase_change | Phase transition | phase, round? |
| agent_start | Before agent streams | agentId |
| agent_token | Each token from agent | agentId, content |
| agent_done | Agent finished | agentId |
| agent_error | Agent error/timeout | agentId?, content, meta.errorCode |
| agent_degraded | Agent exceeded timeout threshold | agentId, content |
| moderator_start | Before moderator streams | - |
| moderator_token | Each moderator token | content |
| moderator_done | Moderator finished | - |
| research_start | Research begins | - |
| research_result | Sources found | content (JSON array of ResearchSource) |
| research_complete | Research done | content (summary text), meta.status |
| user_interjection | Interjection consumed | content, phase?, round? |
| resume_snapshot | Resume state sent | content (JSON DiscussionResumeSnapshot) |
| discussion_complete | Session finished | - |
| heartbeat | Every 15s | - |

### Client consumes (use-discussion-stream.ts → Zustand store)
- SSE parsed via ReadableStream reader + TextDecoder
- Buffer split on `\n\n`, extract `data: ` lines, JSON.parse
- Events dispatched to store actions via `handleEvent()` switch
- Watchdog: 5s interval, error if no event for 30s
- Post-completion: hydrate artifacts via GET /api/sessions/{id}

---

## §8 STREAM MULTIPLEXER

`stream-multiplexer.ts` — runs N agent streams in parallel, yielding events as they arrive.

```
multiplexStreams(agentStreams: AgentStream[]) → AsyncIterable<SSEEvent>

Per agent: {agentId, stream: AsyncIterable<StreamChunk>, startupTimeoutMs?, idleTimeoutMs?}

1. Create iterators for all streams
2. Yield agent_start for each
3. Promise.race all pending reads:
   - text_delta → yield agent_token, queue next read
   - error → yield agent_error, remove from pending
   - done → yield agent_done, remove from pending
4. Timeout via nextWithTimeout():
   - Before first token: startupTimeoutMs
   - After first token: idleTimeoutMs
   - Timeout resolves as error StreamChunk with errorCode
```

---

## §9 TIMEOUT HIERARCHY

| Layer | Value | Source |
|-------|-------|--------|
| Route maxDuration | 300s (5 min) | start/route.ts:35 |
| Per-agent request timeout | 90-300s by provider/phase | orchestrator.ts:362-427 |
| Per-agent startup timeout | 60-240s by provider/phase | orchestrator.ts:362-427 |
| Per-agent idle timeout | 45-90s by provider/phase | orchestrator.ts:362-427 |
| Client watchdog | 30s no-event → error | use-discussion-stream.ts:46-54 |
| Heartbeat interval | 15s | start/route.ts:327 |

Provider-specific timeouts (requestTimeoutMs / startupTimeoutMs / idleTimeoutMs):
- SiliconFlow Qwen: 300/240/90 (debate: 240/180/75)
- SiliconFlow others: 240/180/75 (debate: 180/120/60)
- DeepSeek/Moonshot: 135/120/60 (debate: 120/90/45)
- Anthropic/OpenAI: 105/90/60 (debate: 90/60/45)

---

## §10 AGENT DEGRADATION

1. Each timeout increments `agentTimeoutCount[agentId]`
2. When count ≥ `degradedThreshold` (default 2, env: `ROUND_TABLE_AGENT_DEGRADE_TIMEOUT_THRESHOLD`):
   - Agent added to `degradedAgentIds` set
   - `agent_degraded` SSE event emitted
   - Agent excluded from `getActiveParticipants()` in subsequent phases
3. Counter NOT reset between phases (known issue)
4. No recovery mechanism (known issue)

---

## §11 RESUME FLOW

### Resume decision tree (resume.ts:buildResumePlan)
| Condition | nextPhase | Inherited | Discarded |
|-----------|-----------|-----------|-----------|
| No opening messages | OPENING | research? | everything else |
| Incomplete initial responses | INITIAL_RESPONSES | opening, research? | partial responses onward |
| Summary exists | SUMMARY | all earlier phases | summary only |
| No analysis | ANALYSIS (round 0) | opening, initial | analysis onward |
| Partial analysis/debate | ANALYSIS (max round) | opening, initial | trailing unconfirmed |

### Execution
1. Client calls POST /resume-preview → returns snapshot
2. Client calls POST /start with `resumeFromSessionId`
3. Route handler: getSessionDetail → buildResumePlan → extract state + snapshot
4. Orchestrator: seedResumeState → skip completed phases → resume from nextPhase

**Known issue**: `enrichResumePlanWithLedger()` never called — ledger context lost on resume.

---

## §12 INTERJECTION FLOW

1. Client POST /api/sessions/{id}/interjections → `{content, controlType?, phase?, round?}`
2. Server: validate session running, enqueueInterjection (DB insert), appendMessage
3. Orchestrator: `consumeInterjections()` called before Analysis, Debate, Summary phases
4. drainPendingInterjections: transactional SELECT+UPDATE (consumed=1)
5. `force_converge` control type sets `forceConvergeRequested = true` → breaks debate loop
6. Interjection text accumulated in `interjectionContext[]` → injected into subsequent prompts

---

## §13 RESEARCH FLOW

1. phaseResearch: if enabled + TAVILY_API_KEY present
2. conductResearch: build query plan from brief → Promise.allSettled Tavily searches
3. Deduplicate by URL, sort by score + domain boost, slice to maxSources
4. Evaluate quality: coverage/recency/diversity scores (0-100)
5. Attach citation labels: `R1`, `R2`, ... by rank
6. Persist: researchRuns + researchSources tables
7. Sources available in prompts via `researchBrief` text + research section in decision prompt
8. L1 judge check validates evidence sourceIds against known citation labels

---

## §14 DECISION MEMORY (T6) — PARTIALLY IMPLEMENTED

### What exists
- Schema tables: `session_reflections`, `lessons` (defined but **NOT created in DB init**)
- Types: SessionEndReflection, ForecastEntry, LessonCandidate, Lesson
- Functions: buildEmptyReflection, parseReflectionJson, recordForecastOutcome (Brier score), canPromoteLesson (patternCount≥3 + evidenceBasis≥2), isLessonExpired
- Follow-up: buildFollowUpContext, renderFollowUpContextPrompt — **NEVER CALLED (dead code)**

### What's missing
- Tables not in CREATE TABLE block (crashes on use)
- No orchestrator call to generate reflections
- No lesson promotion in normal flow
- Follow-up context not wired into session init
- Zero test coverage

---

## §15 ZUSTAND STORE (discussion-store.ts)

### State shape
```typescript
{
  sessionId: string | null,
  phase: string, round: number, isRunning: boolean,
  usageInputTokens: number, usageOutputTokens: number,
  agentMessages: Map<string, AgentMessage>,  // {agentId, content, isStreaming, phase}
  moderatorMessages: Array<{content, phase}>,
  interjections: Array<{content, phase?, round?}>,
  decisionSummary: DecisionSummary | null,
  actionItems: ActionItem[],
  review: {retrospectiveNote, outcomeSummary},
  error: string | null,
  resumeSnapshot: DiscussionResumeSnapshot | null,
  degradedAgents: string[],
  research: {status, sources: ResearchSource[], briefText, run},
  ui: {activeSpeakerId, stageMode, autoScroll},
  replay: {status, cursor}
}
```

### Key actions
- `startAgent/appendAgentToken/finalizeAgent` — per-token Map copy (performance issue)
- `startModerator/appendModeratorToken/finalizeModerator`
- `setPhase/setRound/setRunning/setError/setDecisionSummary/setActionItems`
- `addResearchSources/setResearchStatus/setResearchBriefText`
- `reset()` — clears all state (known issue: doesn't clear `error`)

---

## §16 PROMPT TEMPLATES (all in Chinese)

All prompts hardcoded in `moderator.ts`. Key builders:

| Function | Purpose | Output |
|----------|---------|--------|
| `buildOpeningPrompt` | Moderator opening | 250 chars max, introduce topic, 2-3 sub-questions |
| `buildAgentSystemPrompt` | Agent initial response | 300-500 chars, includes structured reply schema |
| `buildAnalysisPrompt` | Moderator analysis | JSON: agreements, disagreements, shouldConverge |
| `buildDebatePrompt` | Agent debate response | 200-300 chars, respond to disagreement |
| `buildSummaryPrompt` | Moderator minutes | Full discussion summary |
| `buildDecisionSummaryPrompt` | Decision summary | JSON: DecisionSummary schema |
| `buildDecisionContextBlock` | Shared context block | Topic, goal, constraints, research brief |

Structured reply marker: `---STRUCTURED---` separates narrative from JSON block.

---

## §17 DB WRITE PATTERNS

| Pattern | Functions | Behavior |
|---------|-----------|----------|
| **Fire-and-forget** | appendMessage, appendSessionEvent, updateSessionUsage, shadowWriteLedgerCheckpoint | `void` prefix, no await, errors silently swallowed |
| **Transactional** | drainPendingInterjections | sqlite.transaction() — atomic SELECT+UPDATE |
| **Idempotent** | upsertSummaryVersion, upsertAgentReplyArtifact | Check uniqueness first, skip if exists |
| **Upsert** | upsertMinutes, upsertDecisionSummary | Check exists → UPDATE or INSERT |

**No transactions** for multi-table finalization (messages + decisionSummary + judgeEval + sessionStatus).

---

## §18 ENVIRONMENT VARIABLES

```
# Provider keys
ANTHROPIC_API_KEY, OPENAI_API_KEY, SILICONFLOW_API_KEY, DEEPSEEK_API_KEY, MOONSHOT_API_KEY

# Model overrides
CLAUDE_MODEL_ID, GPT_MODEL_ID, DEEPSEEK_MODEL_ID, MINIMAX_MODEL_ID, KIMI_MODEL_ID, GLM_MODEL_ID, QWEN_MODEL_ID

# DB & paths
ROUND_TABLE_DB_PATH=./data/round-table.db
ROUND_TABLE_DATA_DIR=./data

# Research
TAVILY_API_KEY
ROUND_TABLE_DISABLE_PLAYWRIGHT_DOM_CAPTURE=0
ROUND_TABLE_DISABLE_SCREENSHOT_CAPTURE=0

# Orchestration tuning
DEFAULT_MODERATOR=claude
MAX_DEBATE_ROUNDS=2
ROUND_TABLE_AGENT_DEGRADE_TIMEOUT_THRESHOLD=2
ROUND_TABLE_SILICONFLOW_BATCH_SIZE=1
SILICONFLOW_MAX_CONCURRENCY=1

# Provider timeouts (ms)
SILICONFLOW_TIMEOUT_MS=240000, SILICONFLOW_QWEN_TIMEOUT_MS=300000
DEEPSEEK_TIMEOUT_MS=135000, DEEPSEEK_REASONER_TIMEOUT_MS=150000
MOONSHOT_TIMEOUT_MS=135000, MOONSHOT_PREVIEW_TIMEOUT_MS=150000

# Access control
ROUND_TABLE_ACCESS_TOKEN=
```

---

## §19 TEST COVERAGE

Test runner: `node --experimental-transform-types --test` (node:test)

| File | Coverage | Key gaps |
|------|----------|----------|
| test/orchestrator.test.ts | 1 happy-path test | No timeout/degradation, no debate rounds, no convergence logic |
| test/decision-utils.test.ts | Normalizers, parsers, confidence | Missing: trust validation edge cases |
| test/judge.test.ts | L0/L1/dimension checks | Missing: rewrite loop, edge cases |
| test/structured-reply.test.ts | Parse structured replies | OK coverage |
| test/sse-parser.test.ts | SSE encoding/parsing | OK coverage |
| test/event-buffer.test.ts | Ring buffer | OK coverage |
| test/resume.test.ts | Resume plan building | OK coverage |
| test/task-ledger.test.ts | Ledger init/update | Missing: serialization round-trip |
| test/research.test.ts | Research quality eval | Missing: Tavily integration |
| test/smoke-api.test.ts | API route smoke tests | Minimal coverage |
| **NOT TESTED** | reflection.ts, follow-up-context.ts, stream-multiplexer error paths, provider streaming errors, DB transaction integrity |

---

## §20 KNOWN ISSUES & TECH DEBT

### Critical (P0)
1. **Route timeout 300s vs orchestration 6000s+** — sessions abort mid-generation
2. **T6 tables not created in DB init** — session_reflections, lessons crash on use
3. **Error state not cleared between sessions** — old errors persist in store

### Important (P1)
- SQLite no WAL mode, no busy_timeout — concurrent session writes serialize
- Provider 429/503 no auto-retry — failure-classifier exists but unused
- Store per-token Map copy — 500 allocations per agent response
- No distributed tracing — cannot diagnose slow phases
- T6 follow-up context never wired — dead code
- Multi-table updates without transactions — data corruption risk
- Structured output not validated before persistence
- SiliconFlow dual queuing (orchestrator + provider internal)

### Architecture notes
- Orchestrator is single async generator — no per-phase error recovery
- SSE event buffer in-memory only — lost on process crash
- Lesson lifecycle never auto-promoted to active
- All prompts hardcoded Chinese — no i18n

---

## §21 SCRIPTS & COMMANDS

```bash
npm run dev          # Start dev server
npm run build        # Production build (webpack)
npm run test         # Run all tests (node:test, sequential)
npm run test:smoke-api  # Smoke test API routes
npm run gate         # Full gate: test + lint + build + smoke
npm run doctor       # Check environment (pre-dev/pre-start hook)
```

---

## §22 RECENT COMMITS (as of 2026-03-19)

```
1315665 fix: SSE parser, structured-block leak, controller guard, GPT review docs
5de4e59 fix: address GPT review findings — L0/L1 gate wiring, L1 ID space, SSE catch-up, params typing
6434060 feat(memory): Topic 6 — decision memory architecture, lessons lifecycle, forecast tracking
45cdcc8 feat(reliability): Topic 5 — SSE event buffer, failure classifier, idempotency, phase metrics
92bdf13 feat(trust): Topic 4 — claim gate, injection scan, honest evidence UI
```

---

## §23 HOW TO USE THIS DOCUMENT

When starting a new LLM session for this project:

1. **Paste this entire document** as initial context
2. **Ask the LLM to read specific files** only when you need implementation details beyond what's here
3. **Reference section numbers** (e.g., "see §6.4 for Judge Gate flow") when asking questions
4. **Update this document** after significant changes — run a context-refresh to capture new types, routes, or architectural changes

This document should be sufficient for:
- Understanding any error or bug report
- Planning feature implementations
- Code review with full architectural context
- Debugging data flow issues end-to-end
