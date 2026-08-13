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
npm run validate:data    # offline dataset validator (structure + external-identity checks)
npm run audit:links      # LIVE LeetCode audit of all 528 mappings (network; ~1 min; never in CI/tests)
node scripts/generate-questions.mjs      # ONLY way to change src/data/questions.json — never hand-edit it
node scripts/fetch-leetcode-catalog.mjs  # refresh scripts/data/leetcode-catalog.json (network)
```

Windows repo: use PowerShell-compatible chaining (`;`), not `&&`. For browser preview, use the `dsa-roadmap-dev` config in `.claude/launch.json` (port 5180, strictPort).

## Architecture

Local-first SPA, no backend: React 18 + TS strict + Redux Toolkit + Tailwind 3.4 + vendored shadcn primitives (`src/components/ui/`) + Vitest. Path alias `@/` → `src/`.

The load-bearing layering, in dependency order:

1. **Pure engine — `src/utils/engine/`** (spacedRepetition, roadmap, streak, xp, stats, achievements, recommendations, predictor, weeklyRevision, aimlCourse, planner, drills, prng). All business math lives here as pure deterministic functions: no React/Redux imports, no clock access — every function takes ISO `yyyy-MM-dd` strings (they compare correctly with `<=`). The single clock read is `todayISO()` in `src/utils/dates.ts`, called only by UI/thunks. Keep it this way; it's what makes the test suite deterministic. The one spaced-repetition ladder lives in spacedRepetition.ts (`ladderEntry`/`ladderAfterReview`/`isLadderDue`); questions and course weeks are both thin wrappers over it, and `predictor.ts` forecasts both tracks through the shared `ladderForecast` primitive.
2. **Store — `src/store/`**. Slices (`progress`, `settings`, `gamification`, `course`, `tasks`, `ui`) are dumb reducers that call engine functions. **`src/store/actions.ts` thunks are the only public mutation API** — UI components never dispatch slice actions directly (exception: `ui` slice actions may be dispatched directly). Thunks supply dates via `todayISO()`, orchestrate cross-slice effects (XP, bonuses, achievements, celebrations). Derived stats come from memoized selectors in `selectors.ts` (engine wrappers only); `tasksSlice.ts` keeps its own selectors + `nextTaskId` beside the slice.
3. **Persistence — `src/services/storage/`**. `StorageAdapter` interface (localStorage impl, key `dsa-roadmap:v1`, versioned `PersistedStateV1`) behind a debounced middleware (with pagehide/visibilitychange flush); import/reset flush synchronously. Unreadable-but-present payloads are quarantined to `dsa-roadmap:v1:quarantine` before the first save can clobber them. UI never touches localStorage (sole documented exception: ErrorBoundary's backup download, which must work when the store itself crashed). The Supabase adapter planned for v2 implements this same seam.
4. **UI — `src/pages/` (lazy routes) inside `AppShell`** (sidebar ≥md, bottom nav below), except `/focus` which is routed *outside* AppShell (no chrome; keeps the floating PomodoroWidget from double-mounting).

### Question dataset & external identity

`src/data/questions.json` is generated — never hand-edit. The generator resolves every title against the committed LeetCode catalog snapshot (`scripts/data/leetcode-catalog.json`) with a **closed-world rule**: a title must exact-match the catalog, appear in the generator's hand-verified `LEETCODE_ALIASES`, or be declared in `NOT_ON_LEETCODE` (11 Educative/Grokking originals) — anything else fails the build. Linked questions carry `url` (built from the catalog's own slug, never guessed), `leetcodeId`, and `premium`. External verification is engineering-time only (`audit:links`); the app never needs the network at runtime.

**Curriculum intelligence** lives in `scripts/data/curriculum.json` (hand-verified problem families + sub-patterns) and is emitted by the same generator under the same closed-world rule (every referenced title must be a SECTIONS title, or the build fails): `families.json`/`subpatterns.json` plus per-question `familyId`/`subpattern`. Families may reach across patterns (deliberate transfer links); sub-patterns are pattern-pure, and each question sits in at most one of each. Typed access goes through `src/data/curriculum.ts`; recognition drills (`/drills`, `engine/drills.ts`) are date-seeded off this data and quiz only same-pattern members so the graded answer always matches the dataset label. Drill results persist via the `drills` slice — the FIRST attempt per calendar date is the recorded signal (reruns are practice); past-day misses weight the next drill toward weak patterns, always excluding today so a recorded attempt can't reshuffle today's own drill.

**Course recall checks** (`src/data/courseRecall.json` + `courseRecall.ts`, adversarially reviewed content, 130 prompts / 26 core weeks) power the "Check yourself" dialog on `/aiml` — treat the JSON as generated (fix source content and re-merge, don't hand-edit entries).

### Invariants that bite if forgotten

- **`progress.byId` is sparse** — only touched questions exist. Every reader must fall back: `byId[id] ?? initialProgress()`. Same rule for **`course.byWeekId`** (`initialCourseProgress()`) and **`tasks.byId`** (may simply be absent).
- **Product rules are locked spec** (see `PRODUCT.md` and the tests): revision ladder 1/3/7/15/30 days, stage 5 = mastered (`nextRevision: null`), any fail → stage 0 due tomorrow; XP 10/20/30 solve, half for revisions, +25 daily goal, +50 weekly clear; course XP 20 session / +50 week clear / 10 review; weekly revision day = roadmap day % 7 === 0; `daySlice` is static id ranges and `currentDay` derives from solved count. Bonus gates: daily bonus at most once per calendar date (`gamification.dailyGoalBonusDate`), weekly bonus at most once per roadmap day (`gamification.weeklyClearBonusDay`); only solved, unmastered questions are revisable. Don't "fix" these without being asked.
- **Course activity is derived, not logged** — streaks/heatmap/calendar count course work via `courseActivityByDate(course.byWeekId)` (session stamps + review grades), never by writing into `DayLog` arrays, which stay DSA-only ledgers.
- **Time has one attribution model** — `DayLog.focusMinutes` is the canonical total time ledger; `QuestionProgress.timeSpentMin` is a per-question *breakdown* of those same minutes (attributed via `ui.focusQuestionId`, maintained by FocusPage). Never sum the two dimensions.
- **Persisted-schema evolution is optional-with-boundary-default** — new `PersistedStateV1` fields are optional (old payloads keep validating); `validatePersisted` echoes them only when present; `loadInitialState` and each slice's `stateImported` case normalize defaults in. Follow this pattern (see the bonus gates, `settings.dailyCapacityMin`, `tasks`).
- **Daily plan estimates are explicit constants** in `engine/planner.ts` (revision 8m, course session 60m, review 10m, task default 15m) — the UI writes `~` before every total on purpose.
- **Icons resolve through `src/components/shared/iconMap.ts`** — explicit imports keep lucide-react tree-shakeable. Adding an icon name to patterns/achievements data means adding it to ICON_MAP (a test pins this). Never `import * as LucideIcons` in src/.

## Tests

- Page/store tests pin the clock: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))` in `beforeEach`, real timers in `afterEach`. Any new test that renders date-dependent UI **must** do this — an unpinned suite passes today and fails when the wall-clock date moves.
- Use the shared render helper: `import { renderWithStore } from '@/test/renderWithStore'` (Provider + ThemeProvider + TooltipProvider + MemoryRouter). Don't re-declare it per file.
- UI copy is asserted in tests. Changing user-facing strings is a behavior change; update tests deliberately, never weaken assertions to make styling changes pass.
- Tests stay offline — anything needing the network lives behind explicit scripts (`audit:links`, `fetch-leetcode-catalog`), never in the suite.
- Never commit failing tests; run the full suite before every commit.

## Design system

`DESIGN.md` (built system: tokens, type voices, motion vocabulary, component idioms) and `PRODUCT.md` (product truth) are authoritative — read them before UI work. Highlights that aren't guessable from the code:

- The visual world is a warm-editorial "course reader" (direction contract lives as an HTML comment in `index.html` and must survive builds). Single fountain-ink accent; per-theme difficulty inks via `--easy/--medium/--hard`; pattern inks (`src/data/patterns.ts`) go on icons/borders/tints, never on label text.
- **Fossil class names**: `.glass` renders a solid paper plate, `.text-gradient` solid serif text, `.bg-accent-gradient` solid ink fill. Kept to avoid mass renames — never reintroduce actual glass/gradients through them. On accent plates use `text-primary-foreground`, never `text-white`.
- Both themes are first-class: dark "lamplight" is default; light is `.light` on `<html>`, toggled via `ThemeContext` → settings slice. Markdown notes previews get theme-aware prose colors from the typography override in `tailwind.config.js` — never `prose-invert`.
- An impeccable design hook auto-scans UI file edits and reports findings — act on them.
