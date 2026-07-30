---
name: DSA Roadmap
description: A 68-day interview curriculum rendered as a beautifully kept course reader.
colors:
  # Dark "lamplight study" theme (default). The `.light` "reading room" values are in ## Colors.
  background: "hsl(24 18% 6%)"
  foreground: "hsl(38 26% 90%)"
  card: "hsl(26 16% 9%)"
  primary: "hsl(214 42% 56%)"
  primary-foreground: "hsl(222 30% 10%)"
  muted: "hsl(27 12% 14%)"
  muted-foreground: "hsl(33 9% 63%)"
  accent: "hsl(214 46% 64%)"
  border: "hsl(28 11% 17%)"
  destructive: "hsl(6 55% 48%)"
  easy: "hsl(96 27% 46%)"
  medium: "hsl(38 60% 46%)"
  hard: "hsl(9 52% 60%)"
  chart-1: "hsl(214 45% 58%)"
  chart-2: "hsl(38 48% 55%)"
typography:
  display:
    fontFamily: '"Besley Variable", Georgia, serif'
    fontWeight: 600
    fontSize: "2.25rem (md: 3rem) for page heroes; 1.75rem for stat values"
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Source Sans 3 Variable", system-ui, sans-serif'
    fontSize: "1rem base; most UI runs at 0.875rem (text-sm)"
    fontFeature: "'ss01'"
  label:
    fontFamily: '"Spline Sans Mono Variable", ui-monospace, monospace'
    letterSpacing: "-0.01em"
    fontVariation: "tabular-nums"
rounded:
  sm: "2px"
  base: "4px"
  md: "6px"
  xl: "10px"
  "2xl": "12px"
spacing:
  base: "4px"
  plate-pad: "16px (dense) / 24px (hero)"
  grid-gap: "16px"
  section-gap: "24px"
  page-max: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "hsl(214 42% 56% / 0.9)"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  plate:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
---

# Design System: DSA Roadmap

## Overview

**Creative North Star: "The Course Reader"**

The direction contract (index.html comment, candidate 5 of 7, seed f55ed760, user-pinned) commits this app to a university course reader / annotated syllabus: the study ritual itself, not a neon dashboard. Warm editorial materials — lamplight near-black or oatmeal-paper grounds, a single fountain-ink blue accent, slab-serif titles and chapter numerals, hairline rules, calm plates, paper grain. It explicitly refuses the glowing-gradient stat-tile arrangement. Product truth (audience, routes, locked gamification spec) lives in PRODUCT.md; this file records only the visual system as built.

**Key Characteristics:**
- Two first-class themes: dark "lamplight study" is default (`:root` vars, `<html class="dark">`); light "reading room" via `.light` on `<html>`. Every token is re-inked per theme in src/index.css.
- One accent ink. Identity elsewhere comes from the serif voice, hairline rules, and tabular figures — never paint.
- Depth from hairline borders and soft warm shadows; no gradients, no glow, no blur.

## Colors

Canonical source is src/index.css: raw HSL triplets consumed as `hsl(var(--token))`. Frontmatter carries the dark defaults; the `.light` block re-inks the same tokens for print contrast — ground hsl(40 30% 94%), plate hsl(43 42% 97%), text hsl(24 22% 14%), ink darkened to hsl(214 52% 40%), difficulty inks darkened (easy hsl(95 30% 32%), medium hsl(39 73% 31%), hard hsl(11 63% 38%)), charts hsl(214 52% 44%) / hsl(35 58% 42%).

### Primary
- **Fountain ink** (`--primary`): the only accent. It marks primary actions, active tab underlines, data fills, focus rings, selection (28% alpha), and the 0–4 activity-intensity ramp. `--accent` is a lighter pen stroke of the same blue for small highlights; `--ring` equals primary.

### Neutral
- **Grounds and plates** (`--background`, `--card`): warm near-black pages under a fixed paper-grain layer; plates one step lighter.
- **Text** (`--foreground` ivory / `--muted-foreground`): all reading text. `--muted`/`--secondary` are the tonal fill for tracks, hovers, and quiet chips; `--border`/`--input` the hairline.

### Difficulty and data inks
- **Sage / ochre / clay** (`--easy` / `--medium` / `--hard`): per-theme difficulty inks; also the good/critical status pair in charts (STATUS_COLORS in chartPrimitives.tsx). `--destructive` is a separate brick red for dangerous actions.
- **Chart series** (`--chart-1` ink, `--chart-2` ochre counterpoint): tuned per theme to sit in the dataviz-skill lightness bands.
- **28 pattern inks** (src/data/patterns.ts): fixed hex values on one continuous warm-biased wheel (ink blue → moss → ochre → clay → plum → back to blue), saturation ~35–45%, midtone lightness so every chip and mark reads on both grounds.

**The One Ink Rule.** Fountain ink is the only accent hue, and it never colors body text at midtone — running text wears `foreground`/`muted-foreground`; ink is reserved for action, state, data, and focus.

**The Ink-on-Icon Rule.** A pattern's ink may color its icon (full strength), border (~35% alpha, hex `59`), and tint (~12% alpha, hex `1f`) — never its label text (PatternChip.tsx). Labels wear `foreground`.

**The Dot-Carries-Color Rule.** In charts, series color lives on marks and on legend/tooltip dots; the adjacent text stays in text tokens. The custom ChartTooltip and renderChartLegend exist to override Recharts' colored-text defaults and are mandatory.

## Typography

**Display Font:** Besley Variable (Georgia fallback) — **Body Font:** Source Sans 3 Variable (system-ui) — **Label/Mono Font:** Spline Sans Mono Variable.

**Character:** a slab-serif textbook voice over a plain, legible sans; mono appears only as tabular figures, like a ledger column.

### Hierarchy
- **Display** (serif 600, 2.25rem → 3rem at md, tracking-tight): page heroes with day-of-course numerals (DashboardPage, FocusPage).
- **Headline** (h1–h3 are serif automatically via index.css, −0.015em, `text-wrap: balance`): section and plate titles.
- **Stat value** (serif 600, 1.75rem, leading-none): the big numeral in ledger stat cards.
- **Body** (sans, 1rem; UI density 0.875rem `text-sm`, labels 0.75rem `text-xs`): everything readable.
- **Figures** (`.figures`: mono, tabular-nums, −0.01em): anything counted, timed, or dated.

**The Three Voices Rule.** Serif speaks titles and big numerals; sans speaks all reading and UI text; mono speaks figures. Never serif body copy; never mono prose.

## Layout

One centered content column: `max-w-6xl` (72rem), `px-4 py-6 pb-28` on mobile (bottom-nav clearance) and `md:px-8 md:py-10` on desktop (AppShell.tsx). Pages stack sections at `space-y-6` (24px); plates sit in `gap-4` (16px) grids, `gap-6` inside the hero plate. Spacing is the stock Tailwind 4px scale — no custom steps. Sidebar on desktop, bottom nav on phones (see PRODUCT.md). Density is calm: one plate per concern, hairline `.rule` dividers inside a plate instead of nested cards.

## Elevation & Depth

Hybrid, and quiet: every plate is a hairline border plus a warm two-part offset shadow; interior depth comes from tonal `muted` fills and `.rule` hairlines, never blur or glow. Overlays (popover, tooltip, dialog) add only `shadow-md`. The single backdrop layer is the paper grain — `body::before`, a fixed SVG fractal-noise tile at opacity 0.045 (dark) / 0.06 (light) — which replaced the old gradient backdrop entirely.

### Shadow Vocabulary
- **Plate, dark** (`0 1px 2px hsl(20 40% 2% / 0.5), 0 10px 28px -14px hsl(20 40% 2% / 0.45)`): every `.glass` surface.
- **Plate, light** (`0 1px 2px hsl(30 30% 20% / 0.07), 0 12px 32px -18px hsl(30 30% 20% / 0.16)`): same role on paper.

## Shapes

Small, bookish radii: plates 10px (`rounded-xl`, tightened in tailwind.config.js), dialogs 12px, buttons/inputs 6px, chips 4px, progress bars 3px, heatmap cells 2px. Borders are always 1px hairlines. No pills except the 8–10px legend/tooltip identity dots. Horizontal `.rule` (border-t) hairlines divide document sections the way a syllabus rules off its weeks.

## Components

### Buttons (src/components/ui/button.tsx)
Quiet and pressable. 6px radius; sizes h-10 default, h-9 `sm` (text-xs), h-11 `lg`, 40px square `icon`. All state changes 150ms `ease-swift`; press is `active:scale-[0.98]`; focus is `ring-1`. Variants: `default` ink on ink-foreground; `outline` hairline on card, hover `border-primary/40`; `secondary` tonal; `ghost` hover `bg-muted`; `destructive`; `link` ink underline.

### Tabs (tabs.tsx) — the underline idiom
TabsList is a hairline baseline (`border-b border-border`); triggers carry a transparent 2px bottom border and muted text, and the active tab inks the border (`border-primary`) and lifts to `foreground`. Never pill or segmented fills.

### Progress (progress.tsx) — the ruled bar
8px tall, 3px radius, `muted` track, ink indicator translating in over 500ms `ease-swift`. Semester and pattern arcs are this bar, not rings or gauges (ProgressRing exists for the pomodoro/level dial only).

### StatCard (src/components/shared/StatCard.tsx) — the ledger entry
On a plate: an xs muted label ruled underneath (`border-b border-border/70 pb-2`), a serif 1.75rem value below, a 16px icon pinned top-right at `muted-foreground/50` (ink when `accent`, which also inks the plate border at 50%).

### Activity intensity (Heatmap.tsx + CalendarPage.tsx)
Shared 0–4 ink ramp: `bg-muted/40`, `bg-primary/25`, `/45`, `/70`, `bg-primary`. The LEVEL_CLASS map is duplicated in CalendarPage.tsx **by convention** — change both together.

### Charts (src/components/charts/chartPrimitives.tsx)
Series come from CHART_COLORS (`--chart-1`/`--chart-2`); grid `--border`, axes `--muted-foreground`, surfaces `--card`. Pass/fail encodings wear STATUS_COLORS (`--easy`/`--hard`), never the categorical pair. Date axes tick weekly (interval 6). Always use ChartTooltip and renderChartLegend.

### Motion
- **150ms `ease-swift`** (`cubic-bezier(0.23,1,0.32,1)`, = `--ease-out`): every interactive state — buttons, tabs, hover lifts (−2px cards, −4px pattern tiles), page transitions.
- **300ms ceiling** for all other UI (toasts 0.3s, pomodoro ring 300ms).
- **500–600ms reserved for data fills**: Progress 500ms, ProgressRing 0.6s, same curve.
- `ease-travel` (`cubic-bezier(0.77,0,0.175,1)`, = `--ease-in-out`) exists for large travel; use sparingly.
- `MotionConfig reducedMotion="user"` wraps the app (App.tsx) and index.css zeroes all animation under `prefers-reduced-motion` — never bypass either.
- Tailwind `hoverOnlyWhenSupported` is on: hover styles never stick on touch.

### Fossil classes (naming ≠ rendering)
Three class names survive from the previous violet/cyan glass identity but render editorially now: `.glass` is a **solid paper plate** (card bg, hairline, warm shadow — no blur), `.text-gradient` is **solid serif foreground**, `.bg-accent-gradient` is a **solid ink fill**. They are kept to avoid mass renames. New code should read them as "plate", "display text", "ink fill" — and must never reintroduce actual glass or gradients through them.

## Do's and Don'ts

### Do:
- **Do** build every card surface on `.glass` and every number on `.figures`; divide plate interiors with `.rule`.
- **Do** use the per-theme `easy`/`medium`/`hard` tokens for difficulty and pass/fail semantics — never hardcoded greens/reds.
- **Do** check both themes; light "reading room" is first-class, not an afterthought.

### Don't:
- **Don't** add gradients, glow, backdrop-blur, or a second accent hue anywhere.
- **Don't** put ink on body text or pattern ink on label text (One Ink / Ink-on-Icon rules).
- **Don't** use Recharts' default tooltip or legend, or animate anything beyond 300ms except data fills.

## Adding a New Surface

1. Page content goes in the AppShell column; stack sections `space-y-6`, grid plates `gap-4`.
2. Each card = `.glass` + `p-4` (or `p-6` for a hero); interior dividers are `.rule`.
3. Titles are h1–h3 (serif comes free); numbers get `.figures`; UI text runs `text-sm`.
4. Spend the ink budget once: primary action, active state, data fill, focus — nothing else.
5. Difficulty → `easy/medium/hard` tokens; pattern identity → PatternChip or icon-only ink.
6. Charts build on chartPrimitives (CHART_COLORS, ChartTooltip, renderChartLegend).
7. Motion: 150ms `ease-swift` states, 500–600ms data fills, nothing longer; reduced motion is already handled — don't opt out.
8. Verify in both themes and at mobile width (bottom-nav clearance is the shell's `pb-28`).
