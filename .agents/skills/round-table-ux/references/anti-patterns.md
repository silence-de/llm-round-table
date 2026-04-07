# Anti-Pattern Detection Reference

This file documents every known anti-pattern in Round Table's UI, with exact grep patterns, explanations of why each is wrong, and the correct replacement.

## Color Violations

### HappyHues Palette Remnants

The project's original color system was based on HappyHues palette #6. These colors must be fully replaced.

| Hex | Name | Why it's wrong | Replacement |
|-----|------|----------------|-------------|
| `#6246ea` | Primary purple | Gaming/playful register, not professional-tool register | `var(--color-accent)` (#d4a853 amber-gold) |
| `#e45858` | Coral red | Consumer-app feel; clashes with error semantics | `var(--color-destructive)` for errors, `var(--color-accent)` for CTAs |
| `#d1d1e9` | Lavender background | Signals "side project"; too saturated for a neutral bg | `var(--color-bg)` (#0a0a0a dark / #fafafa light) |
| `#fffffe` | Off-white | Odd near-white that causes subtle rendering issues | `#ffffff` or `var(--color-card)` |
| `#2b2c34` | Charcoal | Too warm/blue for the new zinc system | `var(--color-text)` (#e5e5e5 dark / #0a0a0a light) |
| `#c8b8fc` | Purple tint | Gradient anchor, purple family | Remove entirely |

**Grep pattern:**
```
#6246ea|#e45858|#d1d1e9|#fffffe|#2b2c34|#c8b8fc|hh6
```

### Derived Color Patterns

These aren't direct hex references but use the old palette indirectly:

| Pattern | Example | Replacement |
|---------|---------|-------------|
| `color-mix(in srgb, var(--rt-live-state)` | Tinted surfaces | `var(--color-accent-subtle)` or `bg-neutral-900` |
| `radial-gradient(ellipse at top, ...)` | Shell background glow | `background-color: var(--color-bg)` |
| `var(--rt-hh6-*)` | Any HappyHues token reference | Corresponding `var(--color-*)` token |
| `var(--rt-stage-glow-*)` | Stage glow colors | Remove entirely |
| `var(--rt-shell-grad-*)` | Shell gradient anchors | Remove entirely |
| `var(--rt-moderator-ring)` / `--rt-moderator-core` | Pink moderator avatar colors | Neutral: `ring-neutral-400` |

## Typography Violations

### Font Family

| Pattern | Why wrong | Replacement |
|---------|-----------|-------------|
| `Avenir Next` | Not Inter; inconsistent with design system | `Inter` |
| `Trebuchet MS` | Not Inter; dated feel | `Inter` |
| `--rt-font-sans` containing Avenir | Root font definition is wrong | `'Inter', system-ui, -apple-system, sans-serif` |

### Size Floor

| Pattern | Why wrong | Fix |
|---------|-----------|-----|
| `text-[10px]` | Below 12px minimum; inaccessible | `text-xs` (12px) |
| `text-[11px]` | Below 12px minimum; inaccessible | `text-xs` (12px) |
| `font-size: 10px` | Below 12px minimum | `font-size: 12px` / `text-xs` |
| `font-size: 11px` | Below 12px minimum | `font-size: 12px` / `text-xs` |

### Case and Tracking

| Pattern | Where acceptable | Everywhere else |
|---------|------------------|-----------------|
| `uppercase` | Badge text (≤4 chars), keyboard shortcuts, phase separator labels | Remove; use sentence case |
| `tracking-widest` | Never in body text | Remove or `tracking-normal` |
| `tracking-wider` | Only with `uppercase` on badges/phase separators | Remove in all other contexts |

### Weight

| Pattern | Where acceptable | Everywhere else |
|---------|------------------|-----------------|
| `font-bold` (700) | `<strong>` in prose content only | Use `font-semibold` (600) |
| `font-extrabold` (800) | Never | `font-semibold` (600) |
| `font-black` (900) | Never | `font-semibold` (600) |

## Motion Violations

### Continuous Animations on Static Elements

```grep
animate-pulse|animation.*pulse|animation.*breathe|animate-ping|animate-bounce
```

**Acceptable:** on loading spinners, active streaming indicators.
**Not acceptable:** on idle cards, static badges, resting phase indicators, background elements.

### transition-all

```grep
transition-all
```

**Why wrong:** Transitions properties that shouldn't animate (width, height, padding), causing layout jank and unexpected visual artifacts. Also prevents browser paint optimization.

**Fix:** Replace with specific properties:
- Color change → `transition-colors`
- Opacity change → `transition-opacity`
- Transform → `transition-transform`
- Multiple → `transition-[color,opacity,transform]`

### Excessive Scale

```grep
scale-\[1\.[1-9]|scale-1[1-9]|hover:scale-1[1-9]
```

**Why wrong:** Scale > 1.05 on hover breaks the spatial stability of the layout. Elements "jumping" out feel aggressive and gamified.

**Fix:** Maximum `hover:scale-105` (1.05), but prefer no scale at all. Use `hover:bg-*` for hover feedback instead.

### Long Durations

```grep
duration-\[5|duration-\[6|duration-\[7|duration-\[8|duration-\[9|duration-1000|duration-700
```

**Why wrong:** Transitions > 400ms on interactive UI make the app feel sluggish.

**Fix:** `duration-150` for standard interactions, `duration-300` maximum for panels/modals.

## Layout Violations

### Excessive Border Radius

```grep
rounded-4xl|rounded-5xl|rounded-\[3[0-9]px\]|rounded-\[4[0-9]px\]
```

**Fix:** Maximum `rounded-3xl` (24px). Use `rounded-2xl` (16px) for most cards/panels.

### Colored Borders

```grep
border-purple|border-blue-[4-9]|border-indigo|border-violet|border-pink|border-coral|border-\[#
```

**Acceptable:** `border-white/8` (dark mode), `border-neutral-200` (light mode), `ring-1 ring-[agentAccent]` on avatars only.

**Not acceptable:** Any colored border used for decoration.

### backdrop-blur on Feed Items

```grep
backdrop-blur
```

**Where acceptable:** Modal overlays, floating popovers.
**Not acceptable:** Message bubbles, feed cards, inline UI elements. It's a performance cost that adds no information.

### border-l-4 Accent Borders

```grep
border-l-4|border-l-\[
```

**Why wrong:** The colored left-border pattern on message cards is a legacy design. It creates visual noise when many messages are stacked and fights with the clean bubble aesthetic.

**Fix:** Remove entirely. Messages use `bg-neutral-900 rounded-2xl p-4` (claude.ai pattern).

## CSS Custom Property Violations

These `--rt-*` tokens from the old system should be replaced:

| Old token pattern | Replacement |
|-------------------|-------------|
| `--rt-hh6-*` | Remove all HappyHues source tokens |
| `--rt-bg-[0-5]` | `var(--color-bg)`, `var(--color-surface)`, `var(--color-card)` |
| `--rt-shell-grad-*` | Remove (no gradients on shell) |
| `--rt-stage-grad-*` | Remove (no gradients on stage) |
| `--rt-stage-glow-*` | Remove (no glows) |
| `--rt-panel-bg` | `var(--color-surface)` |
| `--rt-surface-live` | `var(--color-accent)` |
| `--rt-live-state` | `var(--color-accent)` |
| `--rt-text-strong` | `var(--color-text)` |
| `--rt-text-muted` | `var(--color-text-muted)` |
| `--rt-text-dim` | `var(--color-text-subtle)` |
| `--rt-border-soft` | `var(--color-border)` |
| `--rt-border-strong` | `var(--color-border-strong)` |
| `--rt-moderator-ring` | `ring-neutral-400` |
| `--rt-moderator-core` | `bg-neutral-800` |
| `--rt-font-sans` (Avenir) | `'Inter', system-ui, -apple-system, sans-serif` |

## Full Scan Command

Run this to find all violations in one pass:

```bash
grep -rn \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  -e '#6246ea\|#e45858\|#d1d1e9\|#fffffe\|#2b2c34\|#c8b8fc' \
  -e 'color-mix(' \
  -e 'radial-gradient' \
  -e 'backdrop-blur' \
  -e 'animate-pulse\|animation.*pulse\|animation.*breathe' \
  -e 'transition-all' \
  -e 'text-\[10px\]\|text-\[11px\]' \
  -e 'tracking-widest' \
  -e 'rounded-4xl\|rounded-5xl' \
  -e 'border-l-4' \
  -e 'Avenir\|Trebuchet' \
  -e 'font-bold\b.*label\|font-extrabold\|font-black' \
  src/
```
