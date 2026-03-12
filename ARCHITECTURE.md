# Architecture

## System Goal

Round Table is designed as a trusted decision workflow, not a generic agent shell.

The architectural priority order is:

1. trust
2. follow-up
3. calibration
4. selective execution

## End-to-End Flow

1. The user fills a structured decision brief.
2. The client starts a session with selected agents and a moderator.
3. The orchestrator runs the discussion phases and emits live SSE events.
4. Research and optional browser verification produce evidence sources.
5. The moderator generates a claim-first decision summary.
6. The repository persists transcript, research, claims, action items, and review data.
7. The UI hydrates history, dossier views, ops metrics, and follow-up previews from persisted state.

## Decision Model

Every session is expected to produce more than a recommendation.

The brief captures:

- topic
- goal
- background
- constraints
- time horizon
- non-negotiables
- acceptable downside
- review date
- decision type
- desired output

The final summary captures:

- recommendation
- why
- risks
- open questions
- next actions
- alternatives rejected
- red lines
- revisit triggers
- evidence map with citation labels or `gapReason`

## Core Subsystems

- **Provider Layer**: unified model access across Anthropic, OpenAI, and SiliconFlow.
- **Moderator Layer**: forces convergence and requires strongest counterargument plus decision-structured output.
- **Research Layer**: query planning, reruns, source scoring, citation labeling, stale-source detection.
- **Browser Verification Layer**: read-only URL verification that captures title, excerpt, capture time, and snapshot.
- **Persistence Layer**: sessions, messages, minutes, decision summaries, decision claims, source links, action items, session events.
- **Calibration Layer**: derives outcome gaps from historical reviews and applies confidence penalties in session detail.
- **Artifact Layer**: markdown exports and a PDF dossier export for external sharing.

## Trust Model

Trust is represented explicitly in data and UI.

- evidence references shown to users are citation labels like `R1`, `R2`
- database source ids remain internal
- unsupported or stale claims lower confidence
- unresolved evidence is surfaced in both session detail and ops
- research diversity and recency affect confidence posture

## Follow-Up Model

Follow-up is a first-class workflow, not a separate reporting tool.

- unfinished action items can be carried forward
- parent session review is shown before opening a new follow-up
- history detail shows prior predicted confidence vs actual outcome
- retrospective fields feed future calibration

## Calibration Model

The system tracks whether prior confidence was justified.

Current calibration signals include:

- average predicted confidence
- average outcome confidence
- average overconfidence
- calibration gap
- sourced vs unsourced outcome delta
- template hit rate
- agent/model overconfidence hotspots
- session-level confidence penalty based on prior reviewed outcomes

## Frontend State

Zustand state is split across:

- discussion runtime state
- live message stream and interjections
- stage and panel UI state
- replay state
- history detail hydration

## Main API Surface

- `POST /api/sessions/:id/start`
- `POST /api/sessions/:id/research`
- `POST /api/sessions/:id/research/verify`
- `POST /api/sessions/:id/follow-up`
- `POST /api/sessions/:id/resume-preview`
- `PATCH /api/sessions/:id`
- `PATCH /api/sessions/:id/action-items/:itemId`
- `GET /api/sessions/:id/artifacts`
- `GET /api/sessions/:id/artifact-file`
- `GET /api/sessions/ops`

## Validation Expectations

When changing this system, the minimum bar is:

1. `npm run gate` passes
2. citation labels remain stable after source rerank, pin, and deselect
3. follow-up does not break evidence or action-item inheritance
4. desktop and mobile UI snapshots show no broken layout
5. exported PDF remains readable and internally consistent with session detail
