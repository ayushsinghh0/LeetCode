# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev              # Vite dev server (default port 5173; .claude/launch.json pins 5180)
npm run build            # tsc -b && vite build → dist/  (type-check + bundle)
npx tsc --noEmit         # type-check only (strict mode, noUnusedLocals/Parameters)
npx vitest run           # full suite (jsdom; must stay green)
npx vitest run src/pages/__tests__/today.test.tsx   # single file
npm run test:watch       # watch mode
node scripts/generate-questions.mjs   # ONLY way to change src/data/questions.json — never hand-edit it
```

Windows repo: use PowerShell-compatible chaining (`;`), not `&&`. For browser preview, use the `dsa-roadmap-dev` config in `.claude/launch.json` (port 5180, strictPort).

## Architecture

Local-first SPA, no backend: React 18 + TS strict + Redux Toolkit + Tailwind 3.4 + vendored shadcn primitives (`src/components/ui/`) + Vitest. Path alias `@/` → `src/`.

The load-bearing layering, in dependency order:

1. **Pure engine — `src/utils/engine/`** (spacedRepetition, roadmap, streak, xp, stats, achievements, recommendations, predictor, weeklyRevision, aimlCourse). All business math lives here as pure deterministic functions: no React/Redux imports, no clock access — every function takes ISO `yyyy-MM-dd` strings (they compare correctly with `<=`). The single clock read is `todayISO()` in `src/utils/dates.ts`, called only by UI/thunks. Keep it this way; it's what makes the test suite deterministic. The one spaced-repetition ladder lives in spacedRepetition.ts (`ladderEntry`/`ladderAfterReview`/`isLadderDue`); questions and course weeks are both thin wrappers over it.
2. **Store — `src/store/`**. Slices (`progress`, `settings`, `gamification`, `course`, `ui`) are dumb reducers that call engine functions. **`src/store/actions.ts` thunks are the only public mutation API** — UI components never dispatch slice actions directly (exception: `ui` slice actions may be dispatched directly). Thunks supply dates via `todayISO()`, orchestrate cross-slice effects (XP, bonuses, achievements, celebrations). All derived stats come from memoized selectors in `selectors.ts`.
3. **Persistence — `src/services/storage/`**. `StorageAdapter` interface (localStorage impl, key `dsa-roadmap:v1`, versioned `PersistedStateV1`) behind a debounced middleware; import/reset flush synchronously. UI never touches localStorage. The Supabase adapter planned for v2 implements this same seam.
4. **UI — `src/pages/` (12 lazy routes) inside `AppShell`** (sidebar ≥md, bottom nav below), except `/focus` which is routed *outside* AppShell (no chrome; keeps the floating PomodoroWidget from double-mounting).

Three invariants that bite if forgotten:

- **`progress.byId` is sparse** — only touched questions exist. Every reader must fall back: `byId[id] ?? initialProgress()`. Same rule for **`course.byWeekId`**: fall back to `initialCourseProgress()`.
- **Product rules are locked spec** (see `PRODUCT.md` and the tests): revision ladder 1/3/7/15/30 days, stage 5 = mastered (`nextRevision: null`), any fail → stage 0 due tomorrow; XP 10/20/30 solve, half for revisions, +25 daily goal, +50 weekly clear; course XP 20 session / +50 week clear / 10 review; weekly revision day = roadmap day % 7 === 0; `daySlice` is static id ranges and `currentDay` derives from solved count. Bonus gates: daily bonus at most once per calendar date (`gamification.dailyGoalBonusDate`), weekly bonus at most once per roadmap day (`gamification.weeklyClearBonusDay`); only solved, unmastered questions are revisable. Don't "fix" these without being asked.
- **Course activity is derived, not logged** — streaks/heatmap/calendar count course work via `courseActivityByDate(course.byWeekId)` (session stamps + review grades), never by writing into `DayLog` arrays, which stay DSA-only ledgers.

## Tests

- Page/store tests pin the clock: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))` in `beforeEach`, real timers in `afterEach`. Any new test that renders date-dependent UI **must** do this — an unpinned suite passes today and fails when the wall-clock date moves.
- UI copy is asserted in tests. Changing user-facing strings is a behavior change; update tests deliberately, never weaken assertions to make styling changes pass.
- Never commit failing tests; run the full suite before every commit.

## Design system

`DESIGN.md` (built system: tokens, type voices, motion vocabulary, component idioms) and `PRODUCT.md` (product truth) are authoritative — read them before UI work. Highlights that aren't guessable from the code:

- The visual world is a warm-editorial "course reader" (direction contract lives as an HTML comment in `index.html` and must survive builds). Single fountain-ink accent; per-theme difficulty inks via `--easy/--medium/--hard`; pattern inks (`src/data/patterns.ts`) go on icons/borders/tints, never on label text.
- **Fossil class names**: `.glass` renders a solid paper plate, `.text-gradient` solid serif text, `.bg-accent-gradient` solid ink fill. Kept to avoid mass renames — never reintroduce actual glass/gradients through them.
- Both themes are first-class: dark "lamplight" is default; light is `.light` on `<html>`, toggled via `ThemeContext` → settings slice.
- An impeccable design hook auto-scans UI file edits and reports findings — act on them.
