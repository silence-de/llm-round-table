# Architecture

## End-to-End Flow

1. User starts a session from UI (`topic`, selected agents, moderator, debate rounds).
2. Client calls `POST /api/sessions/:id/start` and consumes SSE stream.
3. Orchestrator runs discussion phases and emits events.
4. Zustand store receives events and updates live UI.
5. Repository persists sessions/messages/minutes in SQLite.

## Core Subsystems

- **Provider Layer** (`src/lib/llm/*`): unified adapter over Anthropic, OpenAI, SiliconFlow.
- **Persona Preset Layer** (`src/lib/agents/persona-presets.ts`): structured persona catalog + deterministic persona resolution (`preset + micro-note + legacy fallback`).
- **Orchestrator** (`src/lib/orchestrator/orchestrator.ts`): phase state machine and debate loop.
- **Moderator** (`src/lib/orchestrator/moderator.ts`): prompts for analysis, convergence, summary.
- **Stream Multiplexer** (`src/lib/orchestrator/stream-multiplexer.ts`): merges multi-agent streams to a single SSE feed.
- **Persistence** (`src/lib/db/*`): Drizzle repository for sessions/messages/minutes/interjections.

## Frontend State Model

Zustand store (`src/stores/discussion-store.ts`) has 4 state groups:

- `discussion`: `phase`, `round`, running state, token usage.
- `live messages`: `agentMessages`, `moderatorMessages`, interjection queue.
- `ui`: `activeSpeakerId`, `stageMode` (`desktop-roundtable | mobile-hybrid`), `autoScroll` (`follow | paused`).
- `replay`: replay status (`idle | playing | paused`) + timeline cursor.

## UI/UX Structure

- **Sidebar**: setup, agent accordion config, sticky action deck (start/stop, interjection, token telemetry).
- **Persona Setup**: preset-first selection model with per-agent recommendations and optional micro-note.
- **Stage**: round-table visualization with moderator center, active-speaker glow, dynamic connection lines.
- **Detail Viewer**: live/historical timeline, replay controls, minutes export.

### Color Token Strategy

- Base palette follows Happy Hues #6 (`primary`, `secondary`, `tertiary`, headline, background).
- Semantic tokens are defined in `globals.css` for shell/panel/surface/text/border/live/error/stage glow.
- Discussion UI surfaces consume semantic tokens rather than provider- or component-specific hardcoded color names.

### Responsive Strategy

- Desktop: full round-table stage with distributed seats.
- Mobile hybrid: compressed stage (moderator + active voice + phase), vertical detail flow below.

## Replay Behavior

- Selecting a history session loads persisted messages.
- `Play Replay` advances timeline cursor at fixed interval.
- Stage and detail viewer both derive from replay-visible message slice.
- `Full Timeline` exits replay and shows full historical transcript.

## Pixel Sprite Avatar Rules

- Sprites are local assets under `public/sprites`.
- Each agent has fixed mapping in agent registry (`sprite`, `accentGlow`).
- UI uses fallback sprite if source is missing.

## Data Schema (SQLite)

- `sessions`: session config, status, usage counters, timestamps.
- `sessions.persona_selections`: structured persona selection map (`presetId`, `customNote`) for replay/history.
- `sessions.personas`: resolved persona text blob for reproducibility and backward compatibility.
- `messages`: role/phase/round scoped discussion messages.
- `minutes`: final summary markdown per session.
- `interjections`: queued user insertions consumed by orchestrator.

## Validation & Regression Checklist

1. Desktop/mobile screenshots show no overlap/truncation.
2. Active speaker glow + moderator link updates while streaming.
3. Interjection can be submitted during live session.
4. Replay controls (play/pause/reset/full) update stage and timeline.
5. Missing API key states degrade gracefully without breaking layout.
