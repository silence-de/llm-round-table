# Round Table

Round Table is a trusted personal decision assistant for high-stakes individual decisions. It runs a structured multi-agent discussion, ties conclusions to evidence, produces a decision dossier, and keeps the follow-up and retrospective loop attached to the original choice.

## Product Position

This project is not trying to be a generic multi-agent framework or a social AI simulation.

It is optimized for:

- personal and small-team strategic decisions
- evidence-backed recommendations instead of free-form debate transcripts
- explicit red lines, revisit triggers, and next actions
- follow-up sessions that compare prior prediction vs actual outcome
- calibration over time so confidence is not just model self-report

## Current Capabilities

- 5-phase moderated discussion flow
- brief-driven decision setup with personal guardrails:
  - `timeHorizon`
  - `nonNegotiables`
  - `acceptableDownside`
  - `reviewAt`
- research runs with source selection, citation labels, and quality evaluation
- browser verification as a read-only evidence capture flow
- decision card and decision dossier generation
- action-item carry-forward into follow-up sessions
- retrospective review fields:
  - decision status
  - outcome summary
  - actual outcome
  - retrospective note
  - outcome confidence
- ops and calibration view:
  - degraded sessions
  - unresolved evidence
  - resume success
  - predicted vs outcome gaps
  - sourced vs unsourced outcome delta
  - agent/model overconfidence hotspots
- export:
  - transcript markdown
  - decision card markdown
  - dossier markdown
  - checklist markdown
  - polished PDF dossier

## Stack

- Next.js 16 App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Zustand
- SQLite + Drizzle ORM
- SSE streaming
- Anthropic / OpenAI / SiliconFlow providers

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required keys depend on the agents you intend to run.

Common:

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

- `GLM_MODEL_ID` should remain `Pro/zai-org/GLM-5`.
- `KIMI_MODEL_ID` must use Moonshot-native IDs such as `kimi-k2.5`.

Optional runtime tuning:

- `DEFAULT_MODERATOR`
- `MAX_DEBATE_ROUNDS`
- `DEFAULT_TEMPERATURE`
- `MAX_CONCURRENT_AGENTS`
- `SILICONFLOW_MAX_CONCURRENCY`
- `SILICONFLOW_TIMEOUT_MS`
- `SILICONFLOW_QWEN_TIMEOUT_MS`

## Core Flows

1. Start from a decision brief instead of a loose topic.
2. Let the moderator force arguments into supported claims, inference, or verify-later gaps.
3. Use research plus browser verification to attach evidence to recommendation claims.
4. Export a PDF dossier that can be shared with family, co-founders, or mentors.
5. Reopen the decision later as a follow-up session and compare prediction vs reality.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run gate
```

## UI Validation

Use desktop and mobile snapshots after UI changes:

```bash
npx -y playwright screenshot "http://127.0.0.1:3000" output/playwright/rt-ui-latest.png --device="Desktop Chrome"
npx -y playwright screenshot --viewport-size=390,844 "http://127.0.0.1:3000" output/playwright/rt-ui-mobile.png
```

## Project Layout

- `src/app/page.tsx`: primary decision workspace
- `src/components/discussion/*`: decision card, research panel, ops watch, stage UI
- `src/lib/orchestrator/*`: moderated discussion state machine
- `src/lib/search/*`: research, browser verification, source quality utilities
- `src/lib/session-artifacts.ts`: markdown exports
- `src/lib/session-artifact-files.ts`: PDF dossier export
- `src/lib/db/*`: schema, repository, calibration, follow-up persistence
- `test/*`: route, repository, orchestrator, artifact, and regression tests

See [ARCHITECTURE.md](/Users/chengxi-mba/Projects/round-table/ARCHITECTURE.md) for subsystem details.
