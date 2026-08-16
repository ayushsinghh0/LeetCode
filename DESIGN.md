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

One centered content column: `max-w-6xl` (72rem), `px-4 py-5 pb-28` on mobile (bottom-nav clearance), `md:px-6 md:py-6 md:pb-12` and `lg:px-8` on desktop (AppShell.tsx). Spacing is the stock Tailwind 4px scale — no custom steps. Sidebar on desktop, bottom nav on phones (see PRODUCT.md). Density is calm: one plate per concern, hairline `.rule` dividers inside a plate instead of nested cards.

**The scroll contract (V11).** Above `lg` the shell is a fixed `100dvh` row and `<main>` is the application's **single** scroll container (`scrollbar-gutter: stable`, so a short route and a long one paint the column in the same place). Pages flow at their natural height: no `Screen`, `Panel`, rail, or tab body may own a scrollbar. The sidebar's nav is the one sanctioned second scroller and keeps its bar invisible until pointer or focus enters it (`.scrollbar-quiet`); the tab strip may pan sideways below `md` with no bar at all (`.scrollbar-none`) and wraps from `md` up. V10's fixed-height division of the viewport into internally-scrolling panels is retired — it held only above ~720px of effective height and collapsed into clipped scroll boxes on a 150%-scaled 1080p display (~590px). Content scrolls; chrome stays.

**The section rhythm is defined once, in § Composition → The rhythm, and `Page.tsx` is its implementation.** This paragraph used to restate it as `space-y-6` with `gap-6` inside the hero plate; both numbers were stale, and a page built from this paragraph would have disagreed with every page built from the vocabulary. Read the table below, not this line.

## Composition

The tokens above were always being followed. The *composition* was not: the app had become a stack of `.glass` plates, one per fact, so a page read as a pile of components rather than a designed document. Borders were doing work that whitespace, alignment and type hierarchy should have done. The vocabulary in **src/components/layout/Page.tsx** is the fix, and it is mandatory for new surfaces.

### The plate rule

**A plate must earn itself.** The default surface is the page ground. Spend a plate on exactly three things:

1. **`Lead`** — the one thing the page wants you to do. `p-6 md:p-8`. **One per page, ever.** Nothing else may match its padding; that size difference *is* the hierarchy.
2. **`Plate`** — a surface that is genuinely liftable: a row you click, a thing you can act on. `p-5`, or `p-3.5` for list rows.
3. Dialogs and overlays, which must detach from the ground to be legible.

Everything else is **`Section`** — a heading, an optional support line, and its content, separated from its neighbours by space. No border, no background, no padding. A section does **not** get an outline because it contains information.

Corollaries, each of which was a real defect:
- A page title never sits in a box. Use `PageHeader`.
- A list does not become plates. Use `RuledList`/`RuledItem`, or hairline-divided rows — 68 bordered rectangles on a timeline fight the rail that is already grouping them.
- A chart, a filter row, and a progress bar already have their own visual boundary. Wrapping them adds a second one.
- Never nest a plate inside a plate. Interior structure is `.rule` hairlines (this was already the rule at *Layout*; it is now enforceable).

### Figures, not stat cards

Four stat cards in a grid is four bordered rectangles each holding one word and one number — the single loudest source of the box problem. Counted facts go in **`Ledger`**: one open row of label-over-figure pairs, hairline-separated, no per-item border or icon. The serif stat voice (1.75rem, 600) is unchanged. `Ledger` is now the **only** figure primitive — `StatCard` was deleted once its last call site went, because a dead plate primitive is a re-entry point for the box problem: the next surface wanting a quick figure finds it and uses four.

### Related facts look like one fact

Pattern · difficulty · estimate · relevance describe *one object*, so they render as one line — **`Meta`**, interpunct-separated — not as four chips in four plates.

A chip that sits *inside* a `Meta` line must be **borderless**, or the line contradicts itself: two of its four items arrive as their own tinted rectangles and it says "four things" again. `DifficultyBadge` and `PatternChip` therefore take `variant="bare"` — difficulty renders as the word in its difficulty ink, a pattern as a 10px ink dot plus its name. The bordered variant is still correct where the chip stands alone as an object (the question sheet masthead, focus mode), never in a row or a `Meta` line.

### One eyebrow, one definition

The eyebrow register — `figures text-xs uppercase tracking-[0.14em] text-muted-foreground` — is the **`Eyebrow`** component exported from `Page.tsx`, and `PageHeader`/`Section` use it too. It was previously re-declared inline on eight surfaces, half of them omitting `.figures`, so the identical eyebrow rendered in the mono face on some pages and the body face on others — invisible in any single file, plainly wrong across the product. `Eyebrow` renders a `<p>`; the two places that need phrasing content (inside a `<button>`, or run-in within a paragraph) use the class constant directly and say why.

### The measure

`AppShell` supplies the 72rem ceiling and the gutter; `Page` chooses this page's column inside it, because a reading surface and a data grid do not want the same line length.

- **`reading`** (46rem) — prose-dominant: a question, a family, an insight, a form.
- **`default`** (60rem) — most pages.
- **`wide`** — grids and calendars that genuinely use the full shell.

Prose inside any width stays at `max-w-prose`. A page that alternates between a 65-character paragraph and a 1152px heading has no measure at all.

### The rhythm

Three vertical steps, and no others:

| Step | Value | Where |
|---|---|---|
| Between sections | `gap-8 md:gap-10` | `Page` supplies it — pages do not set their own |
| Heading → content, and inside a group | `gap-4` | `Section` supplies it |
| Between sibling rows | `gap-2`, or `0` with a hairline | lists |

The section step is 32/40px, a clean 4 : 2 : 1 series against the other two rungs. It renders ~138 times across the eighteen pages, which makes it the single highest-leverage number in the app — do not change it to match a stale doc, and do not re-invent a fourth rung (`gap-3`, `gap-5`, `gap-6`) locally. `Lead` owns its interior stack at `gap-4`; every call site that passed its own `gap-6` had invented a fourth section-scale rung on the one surface where vertical space is most expensive.

Plate padding is `p-6 md:p-8` (Lead), `p-5` (Plate), `p-3.5` (row). There is no `p-2`, `p-3`, `p-8` standalone, or `p-10`.

**The progress bar has a three-step scale, not one height.** `h-2` (8px) standalone, `h-1.5` in a rail, `h-1` in a list row. § Progress describes the standalone bar; the two smaller steps exist because 8px × 28 pattern rows is 224px of bar on a contents page. Do not normalise them upward.

### The type ladder

Five registers, in order. If a section's parts are not distinguishable at a glance, it is using the wrong ones — not a missing border.

| Register | Class | Voice |
|---|---|---|
| Eyebrow | `text-xs uppercase tracking-[0.14em] text-muted-foreground` + `.figures` | context: a date, a count, a chapter |
| Page title | `text-3xl md:text-4xl font-semibold` | serif, one per page |
| Section title | `text-xl font-semibold` (h2) / `text-base` (h3) | serif |
| Support | `text-sm text-muted-foreground max-w-prose` | why this section matters |
| Primary content | `text-sm` body, `.figures` for anything counted | the thing itself |

A section title must never be smaller or quieter than the body copy beneath it.

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

**Navigation obeys the same refusal.** The sidebar and bottom-nav active states were solid `bg-primary` blocks — the loudest object on all eighteen screens, out-weighing each page's own primary button and spending the ink budget twice in one viewport. Active nav is now a 2px ink margin mark (`border-l-2 border-primary`), an ink icon, and a weight step to `font-semibold` — never a filled block. The state rests on three independent carriers so it never depends on colour alone: `aria-current="page"`, the presence-vs-absence of the 2px stroke (inactive items carry `border-transparent`, so nothing shifts), and the weight change. The solid ink fill stays reserved for the capacity chips.

### Progress (progress.tsx) — the ruled bar
8px tall, 3px radius, `muted` track, ink indicator translating in over 500ms `ease-swift`. Semester and pattern arcs are this bar, not rings or gauges (ProgressRing exists for the pomodoro/level dial only).

### Activity intensity (Heatmap.tsx + CalendarPage.tsx)
Shared 0–4 ink ramp: `bg-muted/40`, `bg-primary/25`, `/45`, `/70`, `bg-primary`. The LEVEL_CLASS map is duplicated in CalendarPage.tsx **by convention** — change both together.

### Charts (src/components/charts/chartPrimitives.tsx)
Series come from CHART_COLORS (`--chart-1`/`--chart-2`); grid `--border`, axes `--muted-foreground`, surfaces `--card`. Pass/fail encodings wear STATUS_COLORS (`--easy`/`--hard`), never the categorical pair. Date axes tick weekly (interval 6). Always use ChartTooltip and renderChartLegend.

### Next-action plate (src/components/today/NextActionCard.tsx) — the lead
The day's one recommendation, and the only plate on Today (`Lead`, `p-6 md:p-8`). Structure is fixed: an xs uppercase eyebrow (`Next · <kind>`) with the estimate right-aligned in `.figures`, then the item title at `text-2xl`, then the reason as `text-sm text-muted-foreground` capped at `max-w-prose`, then a `Meta` line of **bare** chips, then one `default` button. Everything else on the page is `p-5` and quieter — the size difference *is* the hierarchy, so don't promote a sibling plate to match it.

Two details that were previously specified wrongly here, and both were real defects in the code that followed this text. The eyebrow row carries **no** hairline: `Lead` already supplies `gap-4` between its children, so a `border-b` paid twice for one boundary. And the chips are **bare**, on a `Meta` line — § Related facts look like one fact is explicit that the bordered variant is never used in a row, and this line said "then chips" while the plate rendered two tinted rectangles describing the object its own `<h2>` had just named.

### Capacity chips (src/components/today/SessionPlan.tsx) — the commitment row
Small `rounded-sm` bordered toggles in `.figures`; the active chip is a solid ink fill with `text-primary-foreground`. The only place in the app where several ink fills sit adjacent — permitted because exactly one is ever active. Never render them as pills or a segmented control.

Because exactly one is ever active, the row is a **`role="radiogroup"` with `aria-checked`**, not a set of independent `aria-pressed` toggles — six toggle buttons announce six independent on/off controls for what is one choice, and arrow-key selection is the contract the radio role promises. Today and Revision both carry this; they are the same setting, so they are the same control.

### Insight card (src/components/shared/InsightPanel.tsx) — the reading
Three fixed bands: a tone icon plus headline, then evidence on a `border-l-2 border-border` rail in `.figures`, then the recommendation and a single `outline` button. Tone colors ride the difficulty inks (`medium` for attention, `easy` for strength) on the icon only — never on the headline text.

### The marginal note — `border-l-2 border-border pl-3` (or `pl-4`)
The course-reader annotation: a hairline left rule, quiet muted text, no background, no plate. It marks something read back to the learner beside the work — the insight card's evidence band, the return notice on Today, "Last time you noted:" on the Revision preview, the post-grade reveal of a solve reflection or last miss note, and the revealed recall answer. Use it whenever the app quotes the learner (or the record) back to them; boxing these in a plate would give a footnote the same weight as the day's recommendation. The `border-primary/40` variant of the rail is reserved for the hint ladder's escalation rungs.

### Revision session (src/pages/RevisionPage.tsx) — the three states

One surface, three states: **preview** (length chips → shape name, a `Figures` line of activities/planned plus a `Meta` focus line, a "Why these:" line, one `Start session` button) carries the page's one `Lead`; **run** is an open `Section` — shape name as its title, minutes-and-activities progress as its `action`, then the `Progress` bar and the activities as a `RuledList`, never as cards — because a progress bar already draws its own boundary and wrapping it in a `p-6 md:p-8` plate makes a very wide, very short box holding one bar; and **complete** (what was worked through, then held / needs-another-pass) reads **the sitting's own grades**, not the day's — the summary says "Session complete", so counting reviews graded from Today that morning would report five outcomes for a sitting that held two. The length chips reuse the capacity-chip idiom exactly; they write the same `settings.dailyCapacityMin`.

An item already graded today renders "Reviewed today · next review …" instead of grade buttons. The `reviseQuestion` thunk refuses a second grade on the same date, so offering the control anyway meant a button that recorded a grade in the UI while the ladder, the XP and the day log all ignored it.

The register is factual throughout. An activity states its depth, its cost, its instruction, and why it was chosen — in that order, at descending weight. Deferred work is one quiet sentence at the foot of the page, never a badge and never a headline.

### Hint ladder (src/components/questions/HintLadder.tsx) — the escalation rail
Each revealed rung is a `border-l-2 border-primary/40 pl-3` block with an xs uppercase label. Revealed rungs stack; exactly one button offers the next. The ink rail is the one accent — no badges, no counters, no cost indicator of any kind.

### Marginalia (src/components/shared/Ornament.tsx) — the engraved ornaments
Three tiny line engravings in the mid-century-textbook tradition — `sprig` (growth), `fleuron` (the printer's leaf), `star` (the printer's asterisk) — drawn as `currentColor` hairline strokes, no fill, always `aria-hidden`. They mark the product's few *reflective* moments the way a well-set book closes a chapter with a small device: the Dashboard epigraph (fleuron), "Done for today" and "Session complete" (sprig), the earned achievements shelf (star). The discipline: one per surface at most, only on reflective moments, never beside data or controls, and always in a quiet text token (`text-muted-foreground/60`) — an ornament never introduces a hue and never carries meaning. A motif on every plate is wallpaper; four placements is the budget, and a fifth must displace one.

### Motion
- **150ms `ease-swift`** (`cubic-bezier(0.23,1,0.32,1)`, = `--ease-out`): every interactive state — buttons, tabs, hover lifts (−2px cards, −4px pattern tiles), page transitions.
- **300ms ceiling** for all other UI (toasts 0.3s, pomodoro ring 300ms).
- **500–600ms reserved for data fills**: Progress 500ms, ProgressRing 0.6s, same curve.
- `ease-travel` (`cubic-bezier(0.77,0,0.175,1)`, = `--ease-in-out`) exists for large travel; use sparingly.
- `MotionConfig reducedMotion="user"` wraps the app (App.tsx) and index.css zeroes all animation under `prefers-reduced-motion` — never bypass either.
- Tailwind `hoverOnlyWhenSupported` is on: hover styles never stick on touch.
- **Celebrations wear the app's inks.** canvas-confetti bursts use the palette in useCelebration.ts (fountain blue, its lighter stroke, ochre/sage/clay, ivory) with `disableForReducedMotion: true` — the library must check the media query itself, since the global reduced-motion CSS cannot reach a canvas. Never revert to the stock rainbow.
- **A completion tick settles in; un-completing snaps.** The task toggle's check pops through a small spring inside `AnimatePresence initial={false}` — already-done rows never animate on mount, and reopening has no exit animation, because un-completing is not a moment.

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

1. Wrap the page in `Page` and open it with `PageHeader`. `Page` supplies the measure and the section rhythm — never set your own top-level gap or max-width.
2. Default to `Section`. Reach for `Lead` once, for `Plate` only when the thing is genuinely liftable, and never nest one inside another; interior dividers are `.rule`.
3. Titles are h1–h3 (serif comes free); numbers get `.figures`; UI text runs `text-sm`.
4. Spend the ink budget once: primary action, active state, data fill, focus — nothing else.
5. Difficulty → `easy/medium/hard` tokens; pattern identity → PatternChip or icon-only ink.
6. Charts build on chartPrimitives (CHART_COLORS, ChartTooltip, renderChartLegend).
7. Motion: 150ms `ease-swift` states, 500–600ms data fills, nothing longer; reduced motion is already handled — don't opt out.
8. Verify in both themes and at mobile width (bottom-nav clearance is the shell's `pb-28`).
