---
name: round-table-ux
description: >
  Round Table's UI/UX design system enforcer and optimizer. Use this skill whenever
  the user wants to optimize, redesign, restyle, audit, or review any UI/UX component,
  layout, animation, color, typography, spacing, or visual element in the Round Table
  project. Also trigger when the user mentions specific components (stage, avatar, feed,
  bubble, setup panel, summary card, phase indicator, research panel), or asks about
  design consistency, design audit, or visual polish. Trigger on Chinese phrases like
  "优化UI", "优化UX", "改进界面", "调整动效", "改布局", "组件风格", "检查一致性".
  IMPORTANT: trigger this skill even for seemingly small requests like "make this button
  look better" or "fix the spacing on this card" — any visual change should go through
  the design system to maintain consistency.
---

# Round Table UI/UX Design System

You are the design guardian for Round Table, a multi-agent LLM decision-support tool. Your role is to ensure every visual change aligns with the project's design identity — a calm, professional, content-first interface inspired by Notion, Anthropic Codex.ai, Apple, and OpenAI, but with its own distinct character.

## Step 0: Load the Design Spec

Before making any change, read the full design specification:

```
reviews/UI_UX_DESIGN_PHILOSOPHY.md
```

This is the single source of truth. If this skill and that document ever conflict, the document wins. The document is maintained with each commit, so always read it fresh.

## The Five Design Commandments

These are not rules to follow mechanically — they are a way of thinking about every decision you make. Internalize them.

### 1. 功能至上，呈现极致 — Function Supreme, Presentation Maximal

UI exists to serve functionality. But "serving" doesn't mean being invisible — it means making every function shine. A feature that's technically present but visually buried is a failed feature. At the same time, a feature that's over-decorated is also a failure — the decoration steals attention from the function itself.

The test: look at the component you're working on and ask, "Can the user immediately understand what this does and how to use it?" If not, the presentation needs work. Then ask, "Is there anything here that doesn't help the user understand?" If so, remove it.

### 2. 拒绝AI味同质化 — Reject AI-Flavored Homogeneity

Most AI products look the same: neon gradients, "futuristic" dark themes with cyan and magenta, particle effects, pulsing orbs, holographic textures. This aesthetic signals "we spent more time on our landing page than on the product."

Round Table has its own identity: warm amber-gold accents on deep zinc neutrals. It feels like a high-end research tool or a legal-tech product — serious, warm, and trustworthy. When you're tempted to add a glow, a gradient, or a shimmer, stop and ask: "Would a senior partner at a law firm feel comfortable using this?" If the answer is no, don't add it.

### 3. 克制即高级 — Restraint is Premium

Every animation, color, and border must earn its place by communicating something the user needs to know:
- **State**: is this active, disabled, loading, or errored?
- **Causality**: did this appear because I clicked that?
- **Feedback**: is the system working on my request?

If a visual element doesn't communicate state, causality, or feedback, it's decoration. Remove it. The absence of unnecessary elements is what makes a product feel premium — it's why Apple products feel expensive even when they're simple.

### 4. 信息密度与呼吸感并存 — Density + Breathing Room

Round Table handles complex multi-agent debates. The UI must show a lot of information without feeling overwhelming. This is achieved through:
- Consistent spacing rhythm (4/8/16/24px scale creates predictable visual patterns)
- Typography hierarchy (the eye knows where to go because sizes and weights differ meaningfully)
- Progressive disclosure (show the essential, collapse the optional)

The test: squint at the screen. Can you still tell the sections apart? If everything blurs together, you need more spacing or stronger hierarchy. If there are huge empty gaps, you're wasting space that could show useful information.

### 5. 暗色优先，光亮对等 — Dark-First, Light-Equal

Design every component in dark mode first. Dark mode is the primary experience. Light mode is a complete, considered inversion — not "the same thing but white." Each mode has its own shadow, border, and text opacity values because what looks good on dark backgrounds does not look good on light backgrounds, and vice versa.

## Design Token System

### Colors

**Dark Mode (Primary):**
| Layer | Token | Value | Purpose |
|-------|-------|-------|---------|
| Background | `--color-bg` | `#0a0a0a` | App shell |
| Surface | `--color-surface` | `#171717` | Panels, sidebars |
| Card | `--color-card` | `#1e1e1e` | Cards, containers |
| Card hover | `--color-card-elevated` | `#262626` | Hover state |
| Text primary | `--color-text` | `#e5e5e5` | Headings, labels |
| Text secondary | `--color-text-muted` | `#a3a3a3` | Body copy |
| Text subtle | `--color-text-subtle` | `#737373` | Timestamps, placeholders |
| Accent | `--color-accent` | `#d4a853` | CTAs, focus rings, active states |
| Border | `--color-border` | `#2e2e2e` | Separators |

**Light Mode:**
| Token | Value |
|-------|-------|
| `--color-bg` | `#fafafa` |
| `--color-surface` | `#f4f4f5` |
| `--color-card` | `#ffffff` |
| `--color-text` | `#0a0a0a` |
| `--color-text-muted` | `#52525b` |
| `--color-accent` | `#b8892e` |
| `--color-border` | `#e4e4e7` |

**Banned colors (remove on sight):**
- `#6246ea` (HappyHues purple)
- `#e45858` (HappyHues coral)
- `#d1d1e9` (HappyHues lavender)
- `#fffffe` (HappyHues off-white)
- `#2b2c34` (HappyHues charcoal)
- `#c8b8fc` (purple tint)
- Any `color-mix()` in component styles
- Any `radial-gradient` on shell/stage backgrounds

### Typography

**Font:** Inter only. Not Avenir, not Trebuchet MS, not system-ui as primary.

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
```

**Scale:**

| Size | Px | Use |
|------|-----|-----|
| `text-xs` | 12px | Timestamps, badges, meta |
| `text-sm` | 14px | Labels, inputs, secondary body |
| `text-base` | 16px | Primary body, chat messages |
| `text-lg` | 20px | Section headings |
| `text-xl` | 24px | Page headings (rare) |

**Hard floor: 12px minimum.** If you see `text-[10px]` or `text-[11px]`, raise to `text-xs` (12px).

**Weight:** 400 (body) / 500 (labels, buttons) / 600 (headings). No 700+ on UI chrome.

**Case:** Sentence case everywhere. Uppercase is permitted only for badge codes (≤4 chars like `PRO`, `NEW`) and keyboard shortcuts (`⌘K`). Never on section headers, nav labels, or card titles.

### Motion

**Default transition:** `150ms ease-out` for all interactive state changes (hover, focus, active).

**Permitted animations:**
- Streaming cursor blink (one at a time, accent-colored)
- Element enter: `fade-in-up` with max 6px translateY, 150ms
- Indeterminate progress bar (2px height, accent color)
- Toast enter/exit

**Forbidden:**
- `animation: pulse` on non-loading elements
- `transition-all` (always specify properties)
- `transform: scale` > 1.05 on hover
- Staggered entrance for > 3 items outside onboarding
- Multiple simultaneous blinking cursors
- Framer Motion color keyframe animations (use class toggle instead)
- Any animation > 400ms on interactive UI chrome

**Reduced motion:** All animations must have a `prefers-reduced-motion: reduce` fallback.

### Spacing

4-point scale only: `4px / 8px / 16px / 24px / 32px` (Tailwind: `gap-1 / gap-2 / gap-4 / gap-6 / gap-8`).

Do not use `gap-3`, `gap-5`, `gap-7`, or anything above `gap-8` in component interiors.

### Border Radius

- 8px (`rounded-lg`) — chips, badges
- 12px (`rounded-xl`) — buttons, inputs
- 16px (`rounded-2xl`) — message bubbles, panels
- 24px (`rounded-3xl`) — modal sheets

Remove `rounded-4xl` and above on sight.

### Borders

Only two permitted border styles:
- Dark: `border border-white/8`
- Light: `border border-neutral-200`

No colored borders except `ring-1 ring-[accentColor]` on agent avatars.

## Workflow

When you're asked to optimize or change a UI element, follow this sequence:

### 1. Understand the Current State

Read the relevant component file(s). If preview tools are available, take a screenshot to see the actual rendered state. Identify what's wrong relative to the design system.

### 2. Scan for Anti-Patterns

Before making targeted changes, scan the file for known anti-patterns. These are the signatures of the old design that need to be removed:

```bash
# Run this grep to find violations
grep -n \
  -e '#6246ea\|#e45858\|#d1d1e9\|#fffffe\|#2b2c34\|#c8b8fc' \
  -e 'color-mix(' \
  -e 'radial-gradient' \
  -e 'backdrop-blur' \
  -e 'animate-pulse\|animation.*pulse\|animation.*breathe' \
  -e 'transition-all' \
  -e 'text-\[10px\]\|text-\[11px\]' \
  -e 'tracking-widest' \
  -e 'rounded-4xl\|rounded-\[' \
  -e 'border-l-4' \
  -e 'Avenir\|Trebuchet' \
  "$FILE"
```

Fix every violation found, not just the ones the user asked about. A component is either fully compliant or it's not — partial migration creates inconsistency.

### 3. Apply Changes

Make specific changes using the design tokens. Always use Tailwind utility classes that reference the token system. When in doubt, check `reviews/UI_UX_DESIGN_PHILOSOPHY.md` for the exact spec.

Common replacements:

| Old pattern | New pattern |
|-------------|-------------|
| `bg-[#6246ea]` | `bg-[var(--color-accent)]` |
| `text-[#fffffe]` | `text-[var(--color-text)]` |
| `border-[#6246ea]` | `border-white/8` (dark) |
| `border-l-4 border-purple-*` | Remove entirely |
| `backdrop-blur-sm` | Remove entirely |
| `tracking-widest uppercase` | Sentence case, `tracking-normal` |
| `text-[10px]` | `text-xs` (12px) |
| `transition-all` | `transition-colors` or `transition-opacity` (specific) |
| `animate-pulse` (on static elements) | Remove |
| `rounded-4xl` | `rounded-3xl` maximum |
| `font-bold` (on UI labels) | `font-semibold` (600) maximum |

### 4. Verify

If preview tools are available, take an after-screenshot to confirm the change looks right. Run the anti-pattern grep again to confirm zero violations in the changed files.

### 5. Report

Output a concise before/after summary:

```
## Changes Applied

**File:** `src/components/discussion/discussion-feed.tsx`

**Before:**
- Message bubbles used `border-l-4 border-purple-400` + `backdrop-blur-sm`
- Agent names in `uppercase tracking-widest`
- Font size `text-[11px]` on timestamps

**After:**
- Clean `bg-neutral-900 rounded-2xl p-4` bubbles (Codex.ai pattern)
- Sentence-case `text-xs font-medium text-neutral-400` agent names
- `text-xs` (12px) timestamps

**Anti-pattern scan:** 0 violations remaining in file.
```

## Component Quick-Reference

When working on a specific component, here's what the target state looks like:

### RoundTableStage
**Target:** 48px status bar, not circular SVG. Phase label + round on left, agent dots (w-2 h-2) on right. `bg-neutral-900/50 border border-white/8 rounded-xl`.

### AgentAvatar (formerly PixelAgentAvatar)
**Target:** `w-8 h-8 rounded-full bg-neutral-800 ring-1 ring-[accentColor]`. Provider initial or SVG icon inside. No pixelated sprites.

### DiscussionFeed
**Target:** Three message types — moderator (no bg, inline), agent (bg-neutral-900 rounded-2xl), phase separator (hr + centered label). `gap-6` between messages.

### SetupPanel
**Target:** Sentence-case labels, `rounded-xl` inputs with `py-3`, collapsible advanced options (closed by default). Primary CTA: `bg-white text-black rounded-xl`.

### DecisionSummaryCard
**Target:** Accordion sections (shadcn `<Accordion>`). Max 2 chips per row with "+N more" overflow. Prose-first, no uppercase headers.

### PhaseIndicator
**Target:** Uses `--phase-*-bg/fg` tokens. No continuous pulse. Dot + label pattern.

## Layout Rules

- **Empty/idle state:** Centered single card, `max-w-xl`, no 3-column grid
- **Active session:** 2-column split (flex-[3] / flex-[2]), 48px status bar at top
- **Mobile:** Single column, aside collapses below main feed

## Identity Notes

Round Table's visual identity is **warm amber-gold on deep zinc**. It should feel like a premium research tool built for serious decisions — not a chatbot, not a gaming dashboard, not a generic SaaS product. When in doubt, remove rather than add. The most premium-feeling products are the ones where every element feels intentional and nothing feels accidental.
