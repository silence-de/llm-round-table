# Round Table Command Deck

A multi-agent council web app where LLM agents discuss a topic in parallel and a moderator drives convergence and minutes.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Zustand
- SQLite + Drizzle ORM (`better-sqlite3`)
- SSE streaming
- Providers: Anthropic / OpenAI / SiliconFlow

## Features

- 5-phase discussion flow (`opening -> initial_responses -> analysis -> debate -> summary`)
- Moderator-guided debate rounds with structured minutes
- User interjection queue during live discussions
- Persona preset system (preset + micro-note), with per-agent recommendations
- Session persistence (`sessions`, `messages`, `minutes`)
- Replay-capable history viewer
- Round-table stage UI with pixel sprites per agent
- Tokenized HH6 visual system for shell, stage, panel, controls, and state feedback

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `SILICONFLOW_API_KEY`

Optional model overrides:

- `CLAUDE_MODEL_ID`
- `GPT_MODEL_ID`
- `DEEPSEEK_MODEL_ID`
- `MINIMAX_MODEL_ID`
- `KIMI_MODEL_ID`
- `GLM_MODEL_ID`
- `QWEN_MODEL_ID`

Notes:

- `KIMI_MODEL_ID` must use Moonshot native model IDs such as `kimi-k2.5`.
- Do not use SiliconFlow-style IDs like `Pro/moonshotai/Kimi-K2.5` with the Moonshot provider.

Optional runtime tuning:

- `DEFAULT_MODERATOR`
- `MAX_DEBATE_ROUNDS`
- `DEFAULT_TEMPERATURE`
- `MAX_CONCURRENT_AGENTS`
- `SILICONFLOW_MAX_CONCURRENCY`
- `SILICONFLOW_TIMEOUT_MS`
- `SILICONFLOW_QWEN_TIMEOUT_MS`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## UI Validation Workflow

Use desktop + mobile snapshots after UI changes:

```bash
npx -y playwright install chromium
npx -y playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3000 output/playwright/rt-ui-desktop.png
npx -y playwright screenshot --viewport-size=390,844 http://127.0.0.1:3000 output/playwright/rt-ui-mobile.png
```

## Project Layout

- `src/app/page.tsx`: main command deck UI
- `src/components/discussion/*`: round-table stage, cards, phase indicator, moderator panel
- `src/hooks/use-discussion-stream.ts`: SSE consumption and store updates
- `src/stores/discussion-store.ts`: live/replay UI and discussion state
- `src/lib/orchestrator/*`: discussion state machine, moderator, stream multiplexer
- `src/lib/agents/persona-presets.ts`: persona preset catalog and persona resolution
- `src/lib/db/*`: Drizzle schema and repository
- `public/sprites/*`: local pixel avatars

For deeper system details, see `ARCHITECTURE.md`.
