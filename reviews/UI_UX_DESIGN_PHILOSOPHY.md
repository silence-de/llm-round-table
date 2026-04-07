# Round Table — UI/UX Design Philosophy

> **Document purpose:** This is the authoritative design specification for Round Table's frontend. It defines vision, token system, component patterns, and migration rules. All design and engineering decisions must be checked against this document.
>
> **Maintainance rule:** Update this document with every design-relevant git commit.

---

## Table of Contents

1. [Vision & Design DNA](#1-vision--design-dna)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Motion & Animation](#4-motion--animation)
5. [Spacing & Border Radius System](#5-spacing--border-radius-system)
6. [Layout System](#6-layout-system)
7. [Component Specs](#7-component-specs)
   - 7.1 [RoundTableStage](#71-roundtablestage)
   - 7.2 [PixelAgentAvatar → AgentAvatar](#72-pixelagentavatar--agentavatar)
   - 7.3 [DiscussionFeed Bubbles](#73-discussionfeed-bubbles)
   - 7.4 [SetupPanel Form Inputs](#74-setuppanel-form-inputs)
   - 7.5 [DecisionSummaryCard](#75-decisionsummarycard)
8. [Avatar SVG System](#8-avatar-svg-system)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [File-by-File Change Map](#10-file-by-file-change-map)
11. [globals.css New Token Spec](#11-globalscss-new-token-spec)
12. [Breaking Changes & Migration Notes](#12-breaking-changes--migration-notes)
13. [Quality Checklists](#13-quality-checklists)

---

## 1. Vision & Design DNA

### 1.1 The Core Premise

Round Table is a professional decision-support tool. Its job is to surface structured reasoning from multiple AI perspectives so that a human can make a better-informed choice. The UI must never compete with that content — it must serve it.

The interaction model is closer to a research notebook or a legal brief than to a chat app or a game. Users arrive with a real question, a real deadline, and a real need for clarity. Every design choice must respect that context.

### 1.2 Reference Points

| Reference | What We Take From It | What We Do Not Take |
|-----------|----------------------|---------------------|
| **Notion** | Content-first layout, neutral backgrounds, soft typographic hierarchy, collapsible sections | Database clutter, infinite nesting metaphors |
| **Anthropic claude.ai** | Calm dark neutrals, readable prose, restrained color, white CTA on dark bg | None — this is our closest peer |
| **Apple (macOS/iOS)** | Spatial clarity, earned micro-interactions, trustworthy typography | Skeuomorphic texture, heavy chrome |
| **Linear** | Functional density, keyboard-first, no decorative flair | Neon accents, gamer palette |

### 1.3 Anti-Patterns (Explicitly Forbidden)

The following patterns have been identified in prior reviews and must be removed or never introduced:

- **HappyHues lavender palette** — The `#6246ea` purple + `#d1d1e9` lavender system signals "fun side project," not a professional tool. Remove all instances.
- **Radial-gradient glows on the shell** — Ambient background glows on the main layout add no information and degrade perceived quality. Remove from `.rt-shell` and `.rt-stage`.
- **Coral/orange as primary accent** — `#e45858` coral for primary actions reads as "consumer app." Remove entirely; replace with amber-gold neutral accent or zinc-900/white system.
- **Continuous pulse animations** — Any `animation: pulse` or opacity oscillation running indefinitely on non-loading elements must be removed.
- **Uppercase labels on body-level UI** — `ANALYSIS`, `SOURCES`, `DECISION` in all-caps on card headers is visually aggressive. Sentence case everywhere except badges.
- **Sub-12px text** — 10px and 11px text is inaccessible and signals carelessness. Hard floor: **12px minimum**.

### 1.4 The One Design Test

Before shipping any UI element, ask: **"Would this feel at home in claude.ai or Notion?"** If yes, ship it. If it feels more at home in a gaming dashboard or a marketing landing page, remove it.

### 1.5 Design Principles (Priority Order)

1. **Prose first, chrome last.** Content (agent arguments, summaries, decisions) dominates. UI scaffolding recedes.
2. **Dark-first, light-ready.** Components designed in dark mode; light mode is a complete, equal inversion.
3. **No decorative complexity.** Glow effects, animated SVGs, and colored borders are reserved for genuine signal moments. Idle states are flat.
4. **Consistent rhythm.** Fixed spacing scale and radius vocabulary — every component speaks the same visual language.
5. **Progressive disclosure.** Advanced controls hidden until needed. Default view is the simplest possible view.

---

## 2. Color System

### 2.1 Design Principle

Round Table uses a **single-accent, neutral-ground** color system. Background and surface layers are desaturated near-blacks (dark) or near-whites (light). The accent color is used exclusively for:

- Active/focused state of interactive elements
- Streaming/progress indicators
- The primary CTA button

Everything else — cards, borders, muted text, icons — uses the neutral ramp. **Color is information, not decoration.**

### 2.2 Dark Mode Palette

```css
/* ── Base Surfaces ──────────────────────────────────────────────── */
--color-bg:           #0a0a0a;   /* zinc-950 — app shell background */
--color-surface:      #171717;   /* zinc-900 — panels, sidebars */
--color-card:         #1e1e1e;   /* zinc-800 — cards, containers */
--color-card-elevated:#262626;   /* zinc-750 — hovered cards */
--color-muted-bg:     #27272a;   /* zinc-800 — subtle fills */

/* ── Borders ────────────────────────────────────────────────────── */
--color-border:       #2e2e2e;   /* default separator */
--color-border-subtle:#242424;   /* internal card dividers */
--color-border-input: #3a3a3a;   /* input outlines at rest */
--color-border-focus: var(--color-accent);

/* ── Text Hierarchy ─────────────────────────────────────────────── */
--color-text:         #e5e5e5;   /* primary — headings, labels */
--color-text-muted:   #a3a3a3;   /* secondary — body copy */
--color-text-subtle:  #737373;   /* muted — timestamps, placeholders */
--color-text-inverse: #0a0a0a;   /* inverse — text on accent bg */

/* ── Accent (warm amber-gold) ───────────────────────────────────── */
--color-accent:        #d4a853;
--color-accent-hover:  #e0b96a;
--color-accent-pressed:#c49540;
--color-accent-subtle: rgba(212, 168, 83, 0.10);
--color-accent-border: rgba(212, 168, 83, 0.35);

/* ── Semantic Status ────────────────────────────────────────────── */
--color-destructive:   #ef4444;
--color-destructive-subtle: rgba(239, 68, 68, 0.10);
--color-warning:       #f59e0b;
--color-warning-subtle: rgba(245, 158, 11, 0.10);
--color-success:       #22c55e;
--color-success-subtle: rgba(34, 197, 94, 0.10);
--color-info:          #3b82f6;
--color-info-subtle:   rgba(59, 130, 246, 0.10);
```

> **Why amber-gold?** It sits in the warm-neutral range between orange (consumer) and yellow (warning). Legible against dark backgrounds at 4.5:1 contrast for large text, without triggering the "gaming" or "alert" register. Used by premium editorial and legal-tech products.

### 2.3 Light Mode Palette

```css
[data-theme="light"] {
  --color-bg:           #fafafa;  /* zinc-50 */
  --color-surface:      #f4f4f5;  /* zinc-100 */
  --color-card:         #ffffff;
  --color-card-elevated:#ffffff;  /* + shadow for elevation */
  --color-muted-bg:     #f4f4f5;

  --color-border:       #e4e4e7;  /* zinc-200 */
  --color-border-subtle:#f0f0f1;
  --color-border-input: #d4d4d8;  /* zinc-300 */

  --color-text:         #0a0a0a;
  --color-text-muted:   #52525b;  /* zinc-600 */
  --color-text-subtle:  #a1a1aa;  /* zinc-400 */
  --color-text-inverse: #fafafa;

  --color-accent:        #b8892e; /* amber-gold adjusted for light bg */
  --color-accent-hover:  #a37a28;
  --color-accent-pressed:#cc9a38;
  --color-accent-subtle: rgba(184, 137, 46, 0.08);
  --color-accent-border: rgba(184, 137, 46, 0.30);
}
```

### 2.4 Semantic Token Reference

| Use Case | Token | Dark | Light |
|----------|-------|------|-------|
| App background | `--color-bg` | `#0a0a0a` | `#fafafa` |
| Sidebar / panel | `--color-surface` | `#171717` | `#f4f4f5` |
| Card | `--color-card` | `#1e1e1e` | `#ffffff` |
| Hovered card | `--color-card-elevated` | `#262626` | `#fff` + shadow |
| Panel separator | `--color-border` | `#2e2e2e` | `#e4e4e7` |
| Internal divider | `--color-border-subtle` | `#242424` | `#f0f0f1` |
| Input border | `--color-border-input` | `#3a3a3a` | `#d4d4d8` |
| Primary text | `--color-text` | `#e5e5e5` | `#0a0a0a` |
| Secondary text | `--color-text-muted` | `#a3a3a3` | `#52525b` |
| Placeholder | `--color-text-subtle` | `#737373` | `#a1a1aa` |
| Primary CTA | `--color-accent` | `#d4a853` | `#b8892e` |
| Active nav bg | `--color-accent-subtle` | 10% amber | 8% amber |
| Error | `--color-destructive` | `#ef4444` | `#ef4444` |
| Warning | `--color-warning` | `#f59e0b` | `#f59e0b` |
| Success | `--color-success` | `#22c55e` | `#22c55e` |

### 2.5 Phase Indicator Color Tokens

```css
/* Dark mode */
--phase-idle-bg:      #27272a;  --phase-idle-fg:      #a1a1aa;
--phase-thinking-bg:  #292524;  --phase-thinking-fg:  #fbbf24;
--phase-speaking-bg:  #1e3a5f;  --phase-speaking-fg:  #93c5fd;
--phase-decided-bg:   #14532d;  --phase-decided-fg:   #86efac;

/* Light mode */
--phase-idle-bg:      #f4f4f5;  --phase-idle-fg:      #71717a;
--phase-thinking-bg:  #fffbeb;  --phase-thinking-fg:  #b45309;
--phase-speaking-bg:  #eff6ff;  --phase-speaking-fg:  #1d4ed8;
--phase-decided-bg:   #f0fdf4;  --phase-decided-fg:   #15803d;
```

### 2.6 What to Remove

| Element | Current (Bad) | Replacement |
|---------|--------------|-------------|
| Shell background | `radial-gradient(...)` purple/coral glows | `background-color: var(--color-bg)` |
| Primary button | `background: #6246ea` (purple) or `#e45858` (coral) | `background: var(--color-accent)` |
| Nav active state | `rgba(139, 92, 246, 0.2)` (lavender) | `var(--color-accent-subtle)` |
| Card accent border | `border-color: #8b5cf6` (purple) | `var(--color-border)` |
| Focus ring | `box-shadow: 0 0 0 2px #8b5cf6` | `box-shadow: 0 0 0 3px var(--color-accent-subtle)` |

---

## 3. Typography

### 3.1 Primary Typeface

**Inter** is the sole typeface for all UI text.

```css
--font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, 'Courier New', monospace;
```

Tailwind config update:
```js
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
}
```

### 3.2 Type Scale

Five sizes cover every UI context. **Hard floor: 12px — no text below this size.**

```css
--text-xs:   0.75rem;  /* 12px — timestamps, badges, meta */
--text-sm:   0.875rem; /* 14px — labels, inputs, secondary body */
--text-base: 1rem;     /* 16px — primary body, chat messages */
--text-lg:   1.25rem;  /* 20px — section headings, dialog titles */
--text-xl:   1.5rem;   /* 24px — page headings (used sparingly) */
```

### 3.3 Weight Scale

```css
--font-normal:   400;  /* body copy, descriptions */
--font-medium:   500;  /* labels, controls, secondary headings */
--font-semibold: 600;  /* primary headings, button text */
```

Weight 700+ reserved for semantic `<strong>` inside prose only. Never for UI chrome.

### 3.4 Usage Table

| Element | Size | Weight | Case |
|---------|------|--------|------|
| Page heading | 24px / `text-xl` | 600 | Sentence |
| Section heading | 20px / `text-lg` | 600 | Sentence |
| Card title | 16px / `text-base` | 600 | Sentence |
| Body / agent text | 16px / `text-base` | 400 | Sentence |
| Input label | 14px / `text-sm` | 500 | Sentence |
| Secondary descriptor | 14px / `text-sm` | 400 | Sentence |
| Button text | 14px / `text-sm` | 500 | Sentence |
| Badge text | 12px / `text-xs` | 500 | UPPER (badge only) |
| Timestamp / meta | 12px / `text-xs` | 400 | Sentence |
| Phase separator | 12px / `text-xs` | 500 | UPPER (only exception) |

### 3.5 Case Rules

**Sentence case everywhere.** This is non-negotiable.

- ✅ `Add new topic`, `Session history`, `Confidence score`
- ❌ `ADD NEW TOPIC`, `SESSION HISTORY`, `CONFIDENCE SCORE`

**Permitted uppercase:** badge status codes (≤4 chars inside pill), keyboard shortcuts (`⌘K`, `ESC`), phase separator labels in the feed.

**Letter spacing:** `tracking-normal` (0em) for all body and UI text. `tracking-wide` (0.05em) only for badge and keyboard shortcut text.

---

## 4. Motion & Animation

### 4.1 Philosophy

Motion communicates one of three things:
1. **State transition** — element appeared, disappeared, or changed state
2. **Causal relationship** — this element came from that origin
3. **Process feedback** — work is happening, not yet complete

If an animation does not communicate one of these three things, **remove it.**

### 4.2 Duration Scale

```css
--duration-instant:  0ms;    /* immediate toggle */
--duration-fast:    150ms;   /* standard UI transition (default) */
--duration-moderate:250ms;   /* modal entry, panel slide */
--duration-slow:    400ms;   /* page-level transitions */
```

Default for all interactive transitions: **150ms**. Anything slower for a hover state makes the UI feel sluggish.

### 4.3 Easing

```css
--ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1.0);   /* elements entering */
--ease-in:     cubic-bezier(0.4, 0.0, 1.0, 1.0);   /* elements leaving */
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1.0);   /* elements staying */
```

Default: `ease-out` for all enter transitions. No spring/overshoot except in deliberate micro-interactions.

### 4.4 Permitted Animations

**Streaming cursor (one at a time):**
```css
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.streaming-cursor {
  display: inline-block;
  width: 2px; height: 1em;
  background-color: var(--color-accent);
  border-radius: 1px;
  animation: cursor-blink 1s ease-in-out infinite;
  vertical-align: text-bottom;
}
```
Only one cursor blinks at a time. Others show static cursor (opacity: 1, no animation).

**Element enter transitions:**
```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.enter-transition {
  animation: fade-in-up 150ms var(--ease-out) both;
}
```
Max translate distance: **6px**. Larger values feel theatrical.

**Progress bar (active fetch):**
```css
@keyframes progress-indeterminate {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
.progress-bar {
  height: 2px; background-color: var(--color-accent);
  animation: progress-indeterminate 1.4s linear infinite;
}
```

### 4.5 Forbidden Animations

| Pattern | Why |
|---------|-----|
| `animation: pulse` on non-loading elements | Signals urgency; makes UI feel anxious |
| `animation: breathe` / opacity oscillation on static cards | Decorative noise; visual fatigue |
| `radial-gradient` background-position animation | Performance footgun |
| Transitions > 400ms on UI chrome | App feels slow |
| Staggered entrance for > 3 items (outside onboarding) | Theatrical |
| `transform: scale > 1.05` on hover | Breaks spatial stability |
| Multiple simultaneous blinking cursors | Visually chaotic |
| `transition-all` | Too broad, causes layout jank |
| Framer-motion color keyframe animations (`#6246ea` → `#e45858`) | Use class-toggle instead |

### 4.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .streaming-cursor {
    animation: none;
    opacity: 1; /* static visible cursor */
  }
  .animate-ping { animation: none !important; opacity: 0 !important; }
}
```

---

## 5. Spacing & Border Radius System

### 5.1 Spacing Scale (4-point)

| Token | Value | Tailwind | Use |
|-------|-------|----------|-----|
| `space-1` | 4px | `p-1` / `gap-1` | Icon nudges, tight inline gaps |
| `space-2` | 8px | `p-2` / `gap-2` | Between avatar and label, chip padding |
| `space-4` | 16px | `p-4` / `gap-4` | Card internal padding, list item spacing |
| `space-6` | 24px | `p-6` / `gap-6` | Section breaks, between major blocks |
| `space-8` | 32px | `p-8` / `gap-8` | Page-level margins only |

Do not use `space-3`, `space-5`, `space-7`, or anything above `space-8` in component interiors.

### 5.2 Border Radius Vocabulary

| Token | Value | Tailwind | Use |
|-------|-------|----------|-----|
| `radius-sm` | 8px | `rounded-lg` | Chips, tags, small badges |
| `radius-md` | 12px | `rounded-xl` | Buttons, inputs, form cards |
| `radius-lg` | 16px | `rounded-2xl` | Message bubbles, panel cards |
| `radius-xl` | 24px | `rounded-3xl` | Modal sheets, floating overlays |

**Remove:** `rounded-4xl` and any value above `rounded-3xl`.

### 5.3 Border Color Rules

Exactly two permitted border colors:
- **Dark surfaces:** `border border-white/8`
- **Light surfaces:** `border border-neutral-200`

**Banned:** colored borders (`border-blue-500`, `border-purple-400`), any border used purely as decoration. The only exception is `ring-1 ring-[accentColor]` on agent avatars (identity, not decoration).

### 5.4 Box Shadow

```css
/* Dark mode: no shadow on cards — border does the job */
/* Light mode only: */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
```

No colored `box-shadow` glow effects. No `drop-shadow` filters in the SVG stage.

---

## 6. Layout System

### 6.1 Three Application States

The layout adapts to three distinct states. Each state owns its full viewport — no persistent wrapper shell.

```
┌──────────────────────────────────────────────────────────────┐
│                     APPLICATION STATES                        │
├─────────────────┬──────────────────┬─────────────────────────┤
│   ONBOARDING    │   EMPTY / IDLE   │    ACTIVE SESSION       │
│                 │                  │                         │
│  Full-bleed.    │  Centered single │  2-column split         │
│  No sidebar.    │  card (Notion-   │  + 48px status bar      │
│  Max-w-md.      │  style).         │  at top                 │
└─────────────────┴──────────────────┴─────────────────────────┘
```

### 6.2 Empty / Idle State (Default)

Single centered card. No 3-column layout, no empty sidebars.

```
┌──────────────────────────────────────┐
│                                      │
│      ┌────────────────────────┐      │
│      │   Round Table          │      │
│      │                        │      │
│      │   [Topic input]        │      │
│      │   [Goal input]         │      │
│      │   [Agent selector]     │      │
│      │                        │      │
│      │   [ Start Session ]    │      │
│      └────────────────────────┘      │
│                                      │
│   Recent sessions:  ┌─┐ ┌─┐ ┌─┐    │
│                     └─┘ └─┘ └─┘    │
└──────────────────────────────────────┘
```

```tsx
<div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
  <div className="w-full max-w-xl">
    <SetupPanel />
  </div>
</div>
```

### 6.3 Active Session State

2-column layout after session starts. Stage compresses to 48px status bar at top.

```
┌──────────────────────────────────────────────────────┐
│  [48px status bar — phase · round · agent dots]      │
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│   MAIN FEED (60%)        │   CONTEXT SIDEBAR (40%)   │
│                          │                           │
│   DiscussionFeed         │   DecisionSummaryCard     │
│   scrollable             │   ResearchPanel           │
│                          │   ActionItems             │
│                          │                           │
└──────────────────────────┴───────────────────────────┘
```

```tsx
<div className="min-h-screen flex flex-col bg-neutral-950">
  <RoundTableStage className="shrink-0" />
  <div className="flex flex-1 overflow-hidden gap-4 px-4 py-4">
    <main className="flex-[3] overflow-y-auto">
      <DiscussionFeed />
    </main>
    <aside className="flex-[2] overflow-y-auto sticky top-0 h-screen">
      <ContextPanel />
    </aside>
  </div>
</div>
```

Column ratio: `flex-[3]` / `flex-[2]` (60/40). On mobile (`< md`): single column, aside below main.

---

## 7. Component Specs

### 7.1 RoundTableStage

**Before:** Large circular SVG (~200-300px) with animated orbit rings, spoke lines, glow effects. Visually dominates above the fold.

**After:** 48px status bar at the top of the active session layout.

```
┌─────────────────────────────────────────────────────────────┐
│  Deliberation  ·  Round 2 of 4            ● ● ○ ●          │
└─────────────────────────────────────────────────────────────┘
  Phase label + round (left)                Agent dots (right)
                                            ● = active (white)
                                            ○ = idle (neutral-600)
```

```tsx
<div className="h-12 flex items-center justify-between px-4 rounded-xl bg-neutral-900/50 border border-white/8">
  {/* Left: phase + round */}
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-neutral-100">{phaseName}</span>
    <span className="text-xs text-neutral-500">·</span>
    <span className="text-xs text-neutral-400">
      Round {currentRound} of {totalRounds}
    </span>
  </div>
  {/* Right: agent dots */}
  <div className="flex items-center gap-1.5">
    {agents.map((agent) => (
      <span
        key={agent.id}
        className={cn(
          "w-2 h-2 rounded-full transition-colors duration-300",
          agent.isActive ? "bg-white" : "bg-neutral-600"
        )}
        title={agent.name}
      />
    ))}
  </div>
</div>
```

**Remove:**
- All circular SVG rendering and `preserveAspectRatio` canvas math
- All `drop-shadow`, `box-shadow` glow on the stage
- All spoke line SVG elements
- All Framer Motion color animations on stage elements
- Grid texture overlay (`.rt-stage-grid`)

**Permitted on phase label:** if phase is "Verdict" or "Completed", the phase label may use `text-amber-400`. All other phases use `text-neutral-100`.

---

### 7.2 PixelAgentAvatar → AgentAvatar

**Before:** Pixelated sprite in a square frame with colored border, retro box-shadow, `image-rendering: pixelated`.

**After:** Two acceptable implementations — choose one, apply consistently.

**Option A (recommended): Initial + accent ring**
```tsx
<div
  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold ring-1 shrink-0"
  style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
  title={agentName}
>
  {name.charAt(0).toUpperCase()}
</div>
```

**Option B: Provider SVG logomark**
```tsx
<div
  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center ring-1 shrink-0"
  style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
>
  <img
    src={`/icons/agent-${agentId}.svg`}
    alt={agentName}
    className="w-4 h-4 text-neutral-300"
    onError={() => setHasError(true)}
  />
</div>
```

**Provider accent colors (muted, ring-1 only):**

| Provider | Accent | Tailwind approx |
|----------|--------|-----------------|
| Claude (Anthropic) | `#D97706` | `amber-600` |
| GPT (OpenAI) | `#10B981` | `emerald-500` |
| DeepSeek | `#3B82F6` | `blue-500` |
| Kimi (Moonshot) | `#8B5CF6` | `violet-500` |
| Qwen / GLM (SiliconFlow) | `#6366F1` | `indigo-500` |
| MiniMax | `#EC4899` | `pink-500` |

These colors appear **only** as `ring-1`. Never as card backgrounds, borders, or text.

**Size variants:**

| Context | Size | Ring |
|---------|------|------|
| Status bar agent dot | `w-2 h-2` (dot only, no text) | none |
| Message bubble header | `w-8 h-8` | `ring-1` |
| Context panel list | `w-6 h-6 text-[10px]` | `ring-1` |
| Verdict / summary | `w-10 h-10 text-sm` | `ring-2` |

**Remove:** all pixelated sprite rendering, `image-rendering: pixelated`, square frame, colored card borders tied to agent identity, box-shadow glow.

---

### 7.3 DiscussionFeed Bubbles

**Before:** `border-l-4` accent color, `backdrop-blur-sm`, `color-mix()` tinted backgrounds, heavy visual weight.

**After:** Three distinct message types with clean visual hierarchy.

**Type 1 — Moderator messages (no background card):**
```tsx
<div className="flex flex-col gap-1">
  <div className="flex items-center gap-2">
    <AgentAvatar agent={moderator} size={24} />
    <span className="text-xs font-medium text-neutral-400">Moderator</span>
    <span className="text-xs text-neutral-600">{timestamp}</span>
  </div>
  <p className="text-sm text-neutral-300 leading-relaxed pl-8">
    {content}
  </p>
</div>
```

**Type 2 — Agent argument bubbles:**
```tsx
<div className="flex flex-col gap-2">
  <div className="flex items-center gap-2">
    <AgentAvatar agent={agent} size={28} />
    <span className="text-xs font-medium text-neutral-200">{agent.name}</span>
    <span className="text-xs text-neutral-600">{timestamp}</span>
    {isStreaming && <StreamingCursor />}
  </div>
  <div className="bg-neutral-900 rounded-2xl p-4 ml-9">
    <MarkdownContent content={content} className="text-sm text-neutral-100 leading-relaxed" />
  </div>
</div>
```

**Type 3 — Phase separator:**
```tsx
<div className="flex items-center gap-4 py-2">
  <hr className="flex-1 border-white/8" />
  <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
    {phaseName}
  </span>
  <hr className="flex-1 border-white/8" />
</div>
```

**Feed container:**
```tsx
<div className="flex flex-col gap-6 py-4">
  {messages.map((msg) => {
    if (msg.type === 'phase-separator') return <PhaseSeparator key={msg.id} {...msg} />;
    if (msg.role === 'moderator') return <ModeratorMessage key={msg.id} {...msg} />;
    return <AgentBubble key={msg.id} {...msg} />;
  })}
</div>
```

Gap between message blocks: `gap-6` (24px). Never `gap-2` or `gap-3`.

**Remove:** `border-l-4`, `backdrop-blur`, `color-mix()` tinted backgrounds, per-agent background color variations, Framer Motion color animations on bubbles.

---

### 7.4 SetupPanel Form Inputs

**Before:** Dense stacked fields, uppercase labels, small inputs, gradient primary button.

**After:**

**Label:**
```tsx
<label className="text-sm font-medium text-neutral-200 mb-1.5 block">
  Debate topic
</label>
```
Sentence case. No uppercase. No `tracking-wider`.

**Input:**
```tsx
<input className="w-full bg-neutral-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-shadow" />
```

**Textarea:** Same as input + `resize-none min-h-[100px]`.

**Advanced options collapsible:**
```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors py-2">
    <ChevronRight className="w-4 h-4 transition-transform ui-open:rotate-90" />
    Advanced options
  </CollapsibleTrigger>
  <CollapsibleContent className="flex flex-col gap-4 pt-4">
    {/* max rounds, temperature, custom prompts... */}
  </CollapsibleContent>
</Collapsible>
```
Closed by default. First-time users see only: Topic, Goal, Agent selection, Start button.

**Primary CTA button (claude.ai pattern):**
```tsx
<button className="w-full bg-white text-black font-medium text-sm rounded-xl py-3 hover:bg-neutral-100 active:bg-neutral-200 transition-colors">
  Start session
</button>
```

**Secondary / ghost button:**
```tsx
<button className="w-full bg-transparent text-neutral-400 font-medium text-sm rounded-xl py-3 border border-white/8 hover:bg-neutral-900 hover:text-neutral-200 transition-colors">
  Cancel
</button>
```

**Visual layout:**
```
┌─────────────────────────────────┐
│  Debate topic                   │
│  [──────────────────────────]   │
│                                 │
│  Goal                           │
│  [──────────────────────────]   │
│                                 │
│  Agents                         │
│  [C·] [G·] [D·]  [+ Add]       │
│                                 │
│  ▶ Advanced options             │
│                                 │
│  [      Start session      ]    │
└─────────────────────────────────┘
```

---

### 7.5 DecisionSummaryCard

**Before:** Uppercase headers with heavy tracking, 8–12 chips per section, all sections visible simultaneously, wall-of-content feel.

**After:** Accordion-style sections, prose-first, max 2 chips per row.

```tsx
<Accordion type="multiple" defaultValue={["summary", "verdict"]}>
  <AccordionItem value="summary" className="border-b border-white/8">
    <AccordionTrigger className="text-sm font-medium text-neutral-200 py-3 hover:no-underline">
      Summary
    </AccordionTrigger>
    <AccordionContent className="text-sm text-neutral-400 leading-relaxed pb-4">
      {summaryText}
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="evidence" className="border-b border-white/8">
    <AccordionTrigger className="text-sm font-medium text-neutral-200 py-3 hover:no-underline">
      Evidence
    </AccordionTrigger>
    <AccordionContent className="flex flex-col gap-3 pb-4">
      {evidence.map((e) => <EvidenceRow key={e.claim} evidence={e} />)}
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="verdict">
    <AccordionTrigger className="text-sm font-medium text-neutral-200 py-3 hover:no-underline">
      Verdict
    </AccordionTrigger>
    <AccordionContent className="pb-4">
      <VerdictBlock verdict={verdict} />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Chip constraint rule (max 2 visible):**
```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  {chips.slice(0, 2).map((chip) => (
    <span key={chip.id} className="text-xs bg-neutral-800 text-neutral-300 rounded-lg px-2 py-0.5 border border-white/8">
      {chip.label}
    </span>
  ))}
  {chips.length > 2 && (
    <button className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors" onClick={toggleExpand}>
      +{chips.length - 2} more
    </button>
  )}
</div>
```

**Remove:** all uppercase section headers, dense chip grids (> 2 chips per visual row), colored chip backgrounds tied to agent/confidence level.

---

## 8. Avatar SVG System

### 8.1 File Naming Convention

All agent SVG icons live under `/public/icons/`. Filename matches agent identifier (kebab-case, lowercase, no version dots).

| Agent | File path |
|-------|-----------|
| Claude | `/public/icons/agent-claude.svg` |
| GPT | `/public/icons/agent-gpt.svg` |
| DeepSeek | `/public/icons/agent-deepseek.svg` |
| Kimi (Moonshot) | `/public/icons/agent-kimi.svg` |
| GLM (SiliconFlow) | `/public/icons/agent-glm.svg` |
| Qwen (SiliconFlow) | `/public/icons/agent-qwen.svg` |
| MiniMax (SiliconFlow) | `/public/icons/agent-minimax.svg` |
| Moderator | `/public/icons/agent-moderator.svg` |
| Fallback | `/public/icons/agent-default.svg` |

Pattern: `agent-{agentId}.svg` where `agentId` matches `AgentDefinition.id` from the agent catalog.

### 8.2 SVG Dimensions & Style Guide

- **Canvas:** `viewBox="0 0 32 32"`, rendered at 32px default (24px and 40px via `size` prop)
- **Safe zone:** meaningful visual content within a 24×24 inner box (4px padding all sides)

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 32 32"
  width="32" height="32"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <!-- paths centered in 24x24 safe zone, offset at (4,4) -->
</svg>
```

**SVG style rules:**
- `stroke: currentColor` — inherits text color from parent
- `fill: none` — monochrome outlines only
- `stroke-width: 1.5` — consistent weight across all icons
- `stroke-linecap: round` + `stroke-linejoin: round`

This means all icons are automatically themed by their container's `text-color` class.

---

## 9. Implementation Roadmap

| Priority | Item | File(s) | Effort | Impact |
|----------|------|---------|--------|--------|
| **P0** | Replace HappyHues tokens with neutral palette | `globals.css` | S | 🔴 High |
| **P0** | Remove radial-gradient glow from shell | `globals.css`, `workspace-shell.tsx` | S | 🔴 High |
| **P0** | Neutralize primary button (purple → white/black) | `button.tsx` | S | 🔴 High |
| **P0** | Remove gaming aesthetic from stage | `round-table-stage.tsx` | M | 🔴 High |
| **P1** | Replace pixel avatar with SVG icon system | `pixel-agent-avatar.tsx`, `/public/icons/` | M | 🔴 High |
| **P1** | Restyle discussion bubbles (remove border-l/blur) | `discussion-feed.tsx` | M | 🔴 High |
| **P1** | Switch to Inter font + fix all 10-11px text | `globals.css`, all components | M | 🟡 Med |
| **P1** | Empty state: centered single-card layout | `page.tsx`, `workspace-shell.tsx` | M | 🟡 Med |
| **P1** | Phase indicator: remove pulse animation | `phase-indicator.tsx` | S | 🟡 Med |
| **P1** | Neutralize decision summary card | `decision-summary-card.tsx` | S | 🟡 Med |
| **P2** | Setup panel: sentence-case labels + collapsible | `page.tsx` (brief form) | S | 🟡 Med |
| **P2** | Research panel: typography + source chip polish | `research-panel.tsx` | S | 🟢 Low |
| **P2** | Fix light mode (currently broken) | `globals.css`, ThemeProvider | M | 🟡 Med |
| **P2** | Workspace shell grid spacing | `workspace-shell.tsx` | S | 🟢 Low |

**Sequencing rule:** Complete all P0 items before starting P1. The `globals.css` token rewrite must land first — every downstream component change references new tokens, not hardcoded hex values.

*Effort key: S = <2h, M = 2–6h, L = 6+h*

---

## 10. File-by-File Change Map

### `src/app/globals.css`
- **Remove** all HappyHues tokens (`--rt-hh6-*`, `--rt-bg-*`, `--rt-shell-grad-*`, etc.)
- **Remove** `.rt-shell` radial-gradient background
- **Remove** `.rt-stage` drop-shadow with accent colors
- **Add** full neutral token set (see §11)
- **Add** Inter to `--rt-font-sans`

### `src/components/workspace/workspace-shell.tsx`
- **Remove** `rt-shell` class (or rewrite to just `bg-[var(--color-bg)]`)
- **Add** `antialiased font-sans` on root wrapper
- **Change** empty state: wrap in centered single-card layout instead of 3-column grid

### `src/components/workspace/setup-panel.tsx`
- **Remove** tab active state using `border-[var(--rt-hh6-primary)]`
- **Add** underline-only tab indicator (`border-b-2 border-neutral-100`)
- **Add** `bg-[var(--color-surface)] border-r border-[var(--color-border)]`

### `src/components/discussion/round-table-stage.tsx`
- **Remove** entire SVG circular stage, orbit rings, spoke lines, grid texture
- **Remove** all Framer Motion color animations
- **Replace** with 48px status bar (see §7.1)

### `src/components/discussion/pixel-agent-avatar.tsx`
- **Remove** canvas/pixel sprite rendering, `image-rendering: pixelated`
- **Replace** with circular avatar (Option A or B, see §7.2)

### `src/components/discussion/discussion-feed.tsx`
- **Remove** `border-l-4`, `backdrop-blur`, `color-mix()` backgrounds from `FeedBubble`
- **Replace** with three clean message type components (see §7.3)
- **Add** `gap-6` between message blocks

### `src/components/discussion/decision-summary-card.tsx`
- **Remove** all uppercase `tracking-[0.18em]` section headers
- **Remove** dense chip grids
- **Replace** with shadcn `<Accordion>` sections (see §7.5)

### `src/components/discussion/phase-indicator.tsx`
- **Remove** continuous pulse animation, accent-colored badge fill
- **Replace** with phase token map (`--phase-*-bg/fg` tokens, see §2.5)
- **Remove** `emerald-400` hardcoded ping dot — use `var(--color-success)`

### `src/components/discussion/research-panel.tsx`
- **Remove** colored source chips (`border-[color-mix(in_srgb,var(--rt-live-state)_35%,transparent)]`)
- **Replace** with `bg-neutral-800 text-neutral-300 border-white/8` chips
- **Add** `text-xs font-semibold text-neutral-500` section labels (remove uppercase tracking)

### `src/components/ui/button.tsx`
- **Change** default variant: `bg-zinc-900 hover:bg-zinc-700 text-white` (dark) or `bg-white text-black` (primary CTA)
- **Change** destructive variant: `bg-red-600` (not HappyHues coral `#e45858`)
- **Add** `focus-visible:ring-2 focus-visible:ring-white/20` on all variants

### `src/components/ui/input.tsx`
- **Change** base: `border border-white/8 bg-neutral-900 rounded-xl px-4 py-3`
- **Change** focus: `focus:border-neutral-600 focus:ring-1 focus:ring-white/20`
- **Add** `placeholder:text-neutral-600`

---

## 11. globals.css New Token Spec

Full rewrite of `:root` and `.dark`:

```css
/* ================================================================
   Round Table — Design Tokens v2
   Palette: Zinc (neutral) + Amber-gold (accent) + semantic colors
   ================================================================ */

@layer base {
  :root {
    /* ── Base Surfaces ──────────────────────────────────── */
    --color-bg:           #fafafa;
    --color-surface:      #ffffff;
    --color-muted-bg:     #f4f4f5;
    --color-overlay:      #e4e4e7;

    /* ── Borders ────────────────────────────────────────── */
    --color-border:       #e4e4e7;
    --color-border-strong:#a1a1aa;
    --color-border-input: #d4d4d8;
    --color-border-focus: var(--color-accent);

    /* ── Text ───────────────────────────────────────────── */
    --color-text:         #18181b;
    --color-text-muted:   #71717a;
    --color-text-subtle:  #a1a1aa;
    --color-text-inverse: #fafafa;

    /* ── Accent (amber-gold) ────────────────────────────── */
    --color-accent:        #b8892e;
    --color-accent-hover:  #a37a28;
    --color-accent-pressed:#cc9a38;
    --color-accent-subtle: rgba(184, 137, 46, 0.08);
    --color-accent-border: rgba(184, 137, 46, 0.30);

    /* ── Primary action (CTA) ───────────────────────────── */
    --color-primary:      #18181b;
    --color-primary-fg:   #ffffff;

    /* ── Semantic ───────────────────────────────────────── */
    --color-destructive:  #dc2626;
    --color-success:      #16a34a;
    --color-warning:      #d97706;
    --color-info:         #2563eb;

    /* ── Phase indicator (light mode) ───────────────────── */
    --phase-idle-bg:      #f4f4f5; --phase-idle-fg:      #71717a;
    --phase-thinking-bg:  #fffbeb; --phase-thinking-fg:  #b45309;
    --phase-speaking-bg:  #eff6ff; --phase-speaking-fg:  #1d4ed8;
    --phase-decided-bg:   #f0fdf4; --phase-decided-fg:   #15803d;

    /* ── Typography ─────────────────────────────────────── */
    --rt-font-sans:  'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    --rt-font-mono:  'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

    /* ── Radius ─────────────────────────────────────────── */
    --radius-sm:   6px;
    --radius-md:  10px;
    --radius-lg:  16px;
    --radius-full: 9999px;

    /* ── Shadows ────────────────────────────────────────── */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);

    /* ── Motion ─────────────────────────────────────────── */
    --duration-fast:   150ms;
    --duration-base:   250ms;
    --duration-slow:   400ms;
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

    /* ── shadcn/ui compatibility tokens ─────────────────── */
    --background:         #fafafa;
    --foreground:         #18181b;
    --card:               #ffffff;
    --card-foreground:    #18181b;
    --popover:            #ffffff;
    --popover-foreground: #18181b;
    --primary:            #18181b;
    --primary-foreground: #ffffff;
    --secondary:          #f4f4f5;
    --secondary-foreground: #18181b;
    --muted:              #f4f4f5;
    --muted-foreground:   #71717a;
    --accent:             #f4f4f5;
    --accent-foreground:  #18181b;
    --destructive:        #dc2626;
    --border:             #e4e4e7;
    --input:              #e4e4e7;
    --ring:               #a1a1aa;
    --radius:             0.625rem;
  }

  .dark {
    /* ── Base Surfaces ──────────────────────────────────── */
    --color-bg:           #09090b;
    --color-surface:      #18181b;
    --color-muted-bg:     #27272a;
    --color-overlay:      #3f3f46;

    /* ── Borders ────────────────────────────────────────── */
    --color-border:       #27272a;
    --color-border-strong:#52525b;
    --color-border-input: #3a3a3a;

    /* ── Text ───────────────────────────────────────────── */
    --color-text:         #e5e5e5;
    --color-text-muted:   #a3a3a3;
    --color-text-subtle:  #737373;
    --color-text-inverse: #09090b;

    /* ── Accent (amber-gold, dark mode) ─────────────────── */
    --color-accent:        #d4a853;
    --color-accent-hover:  #e0b96a;
    --color-accent-pressed:#c49540;
    --color-accent-subtle: rgba(212, 168, 83, 0.10);
    --color-accent-border: rgba(212, 168, 83, 0.35);

    /* ── Primary action ─────────────────────────────────── */
    --color-primary:      #fafafa;
    --color-primary-fg:   #09090b;

    /* ── Phase indicator (dark mode) ────────────────────── */
    --phase-idle-bg:      #27272a; --phase-idle-fg:      #a1a1aa;
    --phase-thinking-bg:  #292524; --phase-thinking-fg:  #fbbf24;
    --phase-speaking-bg:  #1e3a5f; --phase-speaking-fg:  #93c5fd;
    --phase-decided-bg:   #14532d; --phase-decided-fg:   #86efac;

    /* ── Shadows (stronger on dark) ─────────────────────── */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.30);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.40), 0 2px 4px -2px rgb(0 0 0 / 0.30);

    /* ── shadcn/ui compatibility tokens ─────────────────── */
    --background:         #09090b;
    --foreground:         #e5e5e5;
    --card:               #18181b;
    --card-foreground:    #e5e5e5;
    --popover:            #18181b;
    --popover-foreground: #e5e5e5;
    --primary:            #fafafa;
    --primary-foreground: #09090b;
    --secondary:          #27272a;
    --secondary-foreground: #e5e5e5;
    --muted:              #27272a;
    --muted-foreground:   #a3a3a3;
    --accent:             #27272a;
    --accent-foreground:  #e5e5e5;
    --destructive:        #ef4444;
    --border:             #27272a;
    --input:              #27272a;
    --ring:               #52525b;
  }
}
```

---

## 12. Breaking Changes & Migration Notes

### Custom CSS Class Inventory (`rt-*`)

| Class | Current behavior | Required change |
|-------|-----------------|----------------|
| `.rt-shell` | `radial-gradient` + accent glows | Replace: `background-color: var(--color-bg)` |
| `.rt-stage` | SVG container with `drop-shadow(... #6246ea)` | Remove color filter; use neutral shadow or remove |
| `.rt-panel` | Panel bg using HappyHues surface | Repoint to `var(--color-surface)` and `var(--color-border)` |
| `.rt-surface`, `.rt-surface-*` | Multiple `color-mix()` tinted surfaces | Simplify to `var(--color-card)` and `var(--color-muted-bg)` |
| `.rt-live-state` | `#6246ea` purple | Replace with `var(--color-accent)` |
| `.rt-hh6-primary` | `#6246ea` | Delete; use `var(--color-accent)` |
| `.rt-chip-live` | Purple-tinted chip | Replace with phase token or accent-subtle |
| `.rt-moderator-core` | `radial-gradient` pink/purple | Replace with flat `bg-[var(--color-card)]` |

### Framer Motion Color Animations

Any `animate` props passing hex color strings as keyframes must be replaced:
- Remove color-keyed animations entirely
- Use `opacity` and `scale` animations for "active agent" states
- Express color changes through className toggling, not animated style values

### Tailwind Config Sync

If `tailwind.config.ts` extends the theme with HappyHues values under `colors.primary` or `colors.accent`, update those entries to reference the new zinc/amber palette. Any `bg-primary`, `text-accent`, or `border-accent` Tailwind utility classes in components will break silently if the config is not updated in sync with `globals.css`.

### Verification Command

After migration, run this to confirm no HappyHues values remain:
```bash
grep -r "#6246ea\|#e45858\|#d1d1e9\|#fffffe\|#2b2c34\|color-mix" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

---

## 13. Quality Checklists

Use these as PR review gates before each component is merged.

### Token Rewrite (`globals.css`)
- [ ] All 6 HappyHues hex values removed from `:root` (`#6246ea`, `#d1d1e9`, `#fffffe`, `#e45858`, `#2b2c34`, `#c8b8fc`)
- [ ] `:root` and `.dark` define the same complete token set
- [ ] No hardcoded hex in component files (run grep check above)
- [ ] shadcn/ui `--background`, `--primary`, `--border` etc. updated to match

### RoundTableStage
- [ ] Circular SVG removed entirely
- [ ] Rendered as `h-12` status bar
- [ ] Phase label + round number on left, agent dots on right
- [ ] No glow, no drop-shadow filter
- [ ] Agent dots use `transition-colors` only

### AgentAvatar
- [ ] Pixelated sprite code fully removed
- [ ] Circular `w-8 h-8 rounded-full`
- [ ] `ring-1` in muted provider accent color only
- [ ] No colored card borders anywhere agent color was used
- [ ] Fallback monogram renders when SVG missing
- [ ] All 4 size variants render correctly

### DiscussionFeed
- [ ] `border-l-4` removed from all message types
- [ ] `backdrop-blur` removed
- [ ] Moderator: no background card
- [ ] Agent: `bg-neutral-900 rounded-2xl p-4`
- [ ] Phase separator: `hr + centered label`
- [ ] `gap-6` between message blocks

### SetupPanel
- [ ] All labels sentence-case, no `uppercase` or `tracking-wider`
- [ ] Inputs: `rounded-xl py-3 border-white/8`
- [ ] Focus: `ring-1 ring-white/20`
- [ ] Advanced fields in collapsible (closed by default)
- [ ] CTA: `bg-white text-black rounded-xl`

### DecisionSummaryCard
- [ ] All sections in shadcn `<Accordion>`
- [ ] Max 2 chips visible per row, with "+ N more" overflow
- [ ] Uppercase headers removed
- [ ] `Summary` + `Verdict` open by default

### PhaseIndicator
- [ ] Continuous pulse removed
- [ ] Each of the 4 phases uses correct `--phase-*-bg/fg` token pair
- [ ] Dot indicator precedes label text
- [ ] Component is visually calm at rest (idle should not draw attention)

### Button
- [ ] Default variant: `zinc-900` background (not purple)
- [ ] Destructive variant: `red-600` (not HappyHues coral)
- [ ] Focus ring: `ring-white/20` on all variants
- [ ] Hover: single lightness step, no jarring color jump

### Global Regression
- [ ] No purple, lavender, or neon coral in light mode
- [ ] Dark mode: all surfaces in zinc-900/950 range — no colored backgrounds
- [ ] All text/bg combinations pass WCAG AA (4.5:1 normal, 3:1 large)
- [ ] All Framer Motion animations respect `prefers-reduced-motion: reduce`
- [ ] No console errors from missing SVG icon files
- [ ] No `text-[10px]` or `text-[11px]` anywhere in components
- [ ] No `transition-all` in any component
