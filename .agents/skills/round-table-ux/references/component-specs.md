# Component Target Specs

Detailed Tailwind-class-level specifications for each core component's target state. When optimizing a component, compare its current state against this spec.

## Table of Contents
1. [RoundTableStage](#roundtablestage)
2. [AgentAvatar](#agentavatar)
3. [DiscussionFeed](#discussionfeed)
4. [SetupPanel](#setuppanel)
5. [DecisionSummaryCard](#decisionsummarycard)
6. [PhaseIndicator](#phaseindicator)
7. [ResearchPanel](#researchpanel)
8. [Button Variants](#button-variants)
9. [Input Fields](#input-fields)
10. [Cards](#cards)

---

## RoundTableStage

**File:** `src/components/discussion/round-table-stage.tsx`

**Target:** Compress from circular SVG to a 48px horizontal status bar.

```tsx
<div className="h-12 flex items-center justify-between px-4 rounded-xl bg-neutral-900/50 border border-white/8">
  {/* Left: phase + round */}
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-neutral-100">{phaseName}</span>
    <span className="text-xs text-neutral-500">·</span>
    <span className="text-xs text-neutral-400">Round {currentRound} of {totalRounds}</span>
  </div>

  {/* Right: agent activity dots */}
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

**Remove:** SVG `<circle>`, `<line>`, spoke elements, orbit animations, `drop-shadow` filters, `radial-gradient`, Framer Motion color animations, `.rt-stage` glow classes.

---

## AgentAvatar

**File:** `src/components/discussion/pixel-agent-avatar.tsx`

**Target:** Circular avatar with provider initial + accent ring.

```tsx
const AGENT_ACCENT: Record<string, string> = {
  claude: '#D97706',   // amber-600
  gpt:    '#10B981',   // emerald-500
  deepseek: '#3B82F6', // blue-500
  kimi:   '#8B5CF6',   // violet-500
  qwen:   '#6366F1',   // indigo-500
  glm:    '#6366F1',   // indigo-500
  minimax: '#EC4899',  // pink-500
};

// Size variants
const SIZE = {
  24: { container: 'w-6 h-6', text: 'text-[10px]', ring: 'ring-1' },
  28: { container: 'w-7 h-7', text: 'text-[11px]', ring: 'ring-1' },
  32: { container: 'w-8 h-8', text: 'text-xs', ring: 'ring-1' },
  40: { container: 'w-10 h-10', text: 'text-sm', ring: 'ring-2' },
};

// Render
<div
  className={cn(
    SIZE[size].container,
    "rounded-full bg-neutral-800 flex items-center justify-center font-semibold shrink-0",
    SIZE[size].text, SIZE[size].ring
  )}
  style={{ '--tw-ring-color': AGENT_ACCENT[agentId] ?? '#737373' } as React.CSSProperties}
  title={agentName}
>
  {agentName.charAt(0).toUpperCase()}
</div>
```

**Alternative:** If SVG icons exist at `/public/icons/agent-{id}.svg`, use `<img>` with monogram fallback on error.

**Remove:** Canvas pixel rendering, `image-rendering: pixelated`, square frames, colored box-shadow glows.

---

## DiscussionFeed

**File:** `src/components/discussion/discussion-feed.tsx`

Three distinct message types:

### Moderator Message (no background card)
```tsx
<div className="flex flex-col gap-1">
  <div className="flex items-center gap-2">
    <AgentAvatar agent={moderator} size={24} />
    <span className="text-xs font-medium text-neutral-400">Moderator</span>
    <span className="text-xs text-neutral-600">{timestamp}</span>
  </div>
  <div className="text-sm text-neutral-300 leading-relaxed pl-8">
    {content}
  </div>
</div>
```

### Agent Argument Bubble
```tsx
<div className="flex flex-col gap-2">
  <div className="flex items-center gap-2">
    <AgentAvatar agent={agent} size={28} />
    <span className="text-xs font-medium text-neutral-200">{agent.name}</span>
    <span className="text-xs text-neutral-600">{timestamp}</span>
    {isStreaming && <StreamingCursor />}
  </div>
  <div className="bg-neutral-900 rounded-2xl p-4 ml-9">
    <div className="text-sm text-neutral-100 leading-relaxed">
      {content}
    </div>
  </div>
</div>
```

### Phase Separator
```tsx
<div className="flex items-center gap-4 py-2">
  <hr className="flex-1 border-white/8" />
  <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
    {phaseName}
  </span>
  <hr className="flex-1 border-white/8" />
</div>
```

**Feed container:** `<div className="flex flex-col gap-6 py-4">`

**Remove:** `border-l-4`, `backdrop-blur`, `color-mix()` backgrounds, per-agent colored backgrounds.

---

## SetupPanel

**Files:** `src/components/workspace/setup-panel.tsx`, brief form in `src/app/page.tsx`

### Label
```tsx
<label className="text-sm font-medium text-neutral-200 mb-1.5 block">
  Debate topic
</label>
```

### Input
```tsx
<input className="w-full bg-neutral-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-shadow" />
```

### Advanced Options (collapsible, closed by default)
```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors py-2">
    <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
    Advanced options
  </CollapsibleTrigger>
  <CollapsibleContent className="flex flex-col gap-4 pt-4">
    {/* max rounds, temperature, system prompts... */}
  </CollapsibleContent>
</Collapsible>
```

### Primary CTA
```tsx
<button className="w-full bg-white text-black font-medium text-sm rounded-xl py-3 hover:bg-neutral-100 active:bg-neutral-200 transition-colors">
  Start session
</button>
```

### Secondary Button
```tsx
<button className="w-full bg-transparent text-neutral-400 font-medium text-sm rounded-xl py-3 border border-white/8 hover:bg-neutral-900 hover:text-neutral-200 transition-colors">
  Cancel
</button>
```

---

## DecisionSummaryCard

**File:** `src/components/discussion/decision-summary-card.tsx`

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
  {/* More sections: Evidence, Risks, Verdict... */}
</Accordion>
```

### Chip Row (max 2 visible)
```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  {chips.slice(0, 2).map((chip) => (
    <span key={chip.id} className="text-xs bg-neutral-800 text-neutral-300 rounded-lg px-2 py-0.5 border border-white/8">
      {chip.label}
    </span>
  ))}
  {chips.length > 2 && (
    <button className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
      +{chips.length - 2} more
    </button>
  )}
</div>
```

---

## PhaseIndicator

**File:** `src/components/discussion/phase-indicator.tsx`

```tsx
const PHASE_TOKENS = {
  idle:     { bg: 'bg-[var(--phase-idle-bg)]',     fg: 'text-[var(--phase-idle-fg)]' },
  thinking: { bg: 'bg-[var(--phase-thinking-bg)]',  fg: 'text-[var(--phase-thinking-fg)]' },
  speaking: { bg: 'bg-[var(--phase-speaking-bg)]',  fg: 'text-[var(--phase-speaking-fg)]' },
  decided:  { bg: 'bg-[var(--phase-decided-bg)]',   fg: 'text-[var(--phase-decided-fg)]' },
};

<div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", tokens.bg, tokens.fg)}>
  <span className={cn("w-1.5 h-1.5 rounded-full", tokens.fg.replace('text-', 'bg-'))} />
  {phaseLabel}
</div>
```

**Remove:** `animate-pulse`, `animate-ping`, `box-shadow` glow ring, `emerald-400` hardcoded ping dot.

---

## ResearchPanel

**File:** `src/components/discussion/research-panel.tsx`

### Section Label
```tsx
<h3 className="text-xs font-medium text-neutral-500 mb-3">Sources</h3>
```

### Source Chip
```tsx
<span className="text-xs bg-neutral-800 text-neutral-300 rounded-lg px-2 py-0.5 border border-white/8 font-mono">
  {citationLabel}
</span>
```

### Source URL
```tsx
<a className="text-xs text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline transition-colors truncate" href={url}>
  {domain}
</a>
```

---

## Button Variants

| Variant | Classes |
|---------|---------|
| Primary (CTA) | `bg-white text-black font-medium rounded-xl hover:bg-neutral-100` |
| Secondary | `bg-neutral-900 text-neutral-200 font-medium rounded-xl border border-white/8 hover:bg-neutral-800` |
| Ghost | `bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900` |
| Destructive | `bg-red-600 text-white font-medium rounded-xl hover:bg-red-700` |

All buttons: `focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none transition-colors`

---

## Input Fields

```tsx
// Base input
className="w-full bg-neutral-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-shadow"

// Textarea (add)
className="... resize-none min-h-[100px]"

// Select trigger (same as input, add chevron)
className="... flex items-center justify-between"
```

---

## Cards

```tsx
// Standard card
className="bg-[var(--color-card)] border border-white/8 rounded-2xl p-4"

// Hover card
className="... hover:bg-[var(--color-card-elevated)] transition-colors"

// No box-shadow in dark mode. Light mode:
className="... shadow-sm"
```
