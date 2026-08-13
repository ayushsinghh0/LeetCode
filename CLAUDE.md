# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev              # Vite dev server (default port 5173; .claude/launch.json pins 5180)
npm run build            # tsc -b && vite build → dist/  (type-check + bundle)
npx tsc --noEmit         # type-check only (strict mode, noUnusedLocals/Parameters)
npm test                 # = npx vitest run — full suite (jsdom; must stay green)
npx vitest run src/pages/__tests__/today.test.tsx   # single file
npx vitest run -t "next best action"                # single test by name
npm run test:watch       # watch mode
npm run preview          # serve the built dist/ (port 5181 via .claude/launch.json)
npm run validate:data    # offline dataset validator (structure + external-identity checks)
npm run audit:links      # LIVE LeetCode audit of all 528 mappings (network; ~1 min; never in CI/tests)
node scripts/generate-questions.mjs      # ONLY way to change src/data/questions.json — never hand-edit it
node scripts/fetch-leetcode-catalog.mjs  # refresh scripts/data/leetcode-catalog.json (network)
```

Windows repo: use PowerShell-compatible chaining (`;`), not `&&`. For browser preview, use the `dsa-roadmap-dev` config in `.claude/launch.json` (port 5180, strictPort).

## Architecture

Local-first SPA, no backend: React 18 + TS strict + Redux Toolkit + Tailwind 3.4 + vendored shadcn primitives (`src/components/ui/`) + Vitest. Path alias `@/` → `src/`.

The load-bearing layering, in dependency order:

1. **Pure engine — `src/utils/engine/`** (spacedRepetition, roadmap, streak, xp, stats, achievements, recommendations, predictor, weeklyRevision, aimlCourse, planner, drills, prng, **hints, mastery, timeEstimate, nextAction, insights, companies**). All business math lives here as pure deterministic functions: no React/Redux imports, no clock access — every function takes ISO `yyyy-MM-dd` strings (they compare correctly with `<=`). The single clock read is `todayISO()` in `src/utils/dates.ts`, called only by UI/thunks. Keep it this way; it's what makes the test suite deterministic. The one spaced-repetition ladder lives in spacedRepetition.ts (`ladderEntry`/`ladderAfterReview`/`isLadderDue`); questions and course weeks are both thin wrappers over it, and `predictor.ts` forecasts both tracks through the shared `ladderForecast` primitive.

   **`nextAction.ts` is the single prioritizer.** `rankWork()` returns the whole day's work, most valuable first; the Today hero is `[0]` and the "I have N minutes" plan is `buildSession()` greedily packing the same list. Never add a second ranking heuristic — a hero and a plan that disagree is the failure this design exists to prevent. Ordering principle: retention outranks acquisition (a lapsed review is knowledge being lost; an unsolved question is knowledge not yet gained), and the learner's own tasks rank last because the ranker doesn't know their urgency.
2. **Store — `src/store/`**. Slices (`progress`, `settings`, `gamification`, `course`, `tasks`, `ui`) are dumb reducers that call engine functions. **`src/store/actions.ts` thunks are the only public mutation API** — UI components never dispatch slice actions directly (exception: `ui` slice actions may be dispatched directly). Thunks supply dates via `todayISO()`, orchestrate cross-slice effects (XP, bonuses, achievements, celebrations). Derived stats come from memoized selectors in `selectors.ts` (engine wrappers only); `tasksSlice.ts` keeps its own selectors + `nextTaskId` beside the slice.
3. **Persistence — `src/services/storage/`**. `StorageAdapter` interface (localStorage impl, key `dsa-roadmap:v1`, versioned `PersistedStateV1`) behind a debounced middleware (with pagehide/visibilitychange flush); import/reset flush synchronously. Unreadable-but-present payloads are quarantined to `dsa-roadmap:v1:quarantine` before the first save can clobber them. UI never touches localStorage (sole documented exception: ErrorBoundary's backup download, which must work when the store itself crashed). The Supabase adapter planned for v2 implements this same seam.
4. **UI — `src/pages/` (lazy routes) inside `AppShell`** (sidebar ≥md, bottom nav below), except `/focus` which is routed *outside* AppShell (no chrome; keeps the floating PomodoroWidget from double-mounting).

**Adding a route touches three files, and the third is easy to miss:** the lazy import + `<Route>` in `src/App.tsx`, an entry in `src/components/layout/navItems.ts` (the one nav registry — Sidebar renders all of it, MobileNav splits on `mobile: 'primary' | 'more'`, and there is room for exactly five primary tabs), and nothing else — because `src/__tests__/routes.test.tsx` is driven off `NAV_ITEMS` via `test.each`, so a new nav entry automatically gains mount coverage and a route added without one silently has none. Heavy on-demand components that are not routes (the question sheet) are `lazy()`-ed inside `AppShell` behind a latch, not mirrored off store state — mirroring unmounts them mid-exit-transition.

**Bundle policy (`vite.config.ts` `manualChunks`).** Three pinned chunks: `vendor-react`, `vendor-motion`, and `data-curriculum` (questions/families/subpatterns/companies JSON). The dataset is ~380 kB and immutable between releases, so pinning it keeps app fixes from invalidating it in caches and keeps the app chunk near 300 kB. **Any new large generated JSON under `src/data/` belongs in `data-curriculum`** — left unlisted it silently lands in the app chunk.

### Question dataset & external identity

`src/data/questions.json` is generated — never hand-edit. The generator resolves every title against the committed LeetCode catalog snapshot (`scripts/data/leetcode-catalog.json`) with a **closed-world rule**: a title must exact-match the catalog, appear in the generator's hand-verified `LEETCODE_ALIASES`, or be declared in `NOT_ON_LEETCODE` (11 Educative/Grokking originals) — anything else fails the build. Linked questions carry `url` (built from the catalog's own slug, never guessed), `leetcodeId`, and `premium`. External verification is engineering-time only (`audit:links`); the app never needs the network at runtime.

**Curriculum intelligence** lives in `scripts/data/curriculum.json` (hand-verified problem families + sub-patterns) and is emitted by the same generator under the same closed-world rule (every referenced title must be a SECTIONS title, or the build fails): `families.json`/`subpatterns.json` plus per-question `familyId`/`subpattern`. Families may reach across patterns (deliberate transfer links); sub-patterns are pattern-pure, and each question sits in at most one of each. Typed access goes through `src/data/curriculum.ts`; recognition drills (`/drills`, `engine/drills.ts`) are date-seeded off this data and quiz only same-pattern members so the graded answer always matches the dataset label. Drill results persist via the `drills` slice — the FIRST attempt per calendar date is the recorded signal (reruns are practice); past-day misses weight the next drill toward weak patterns, always excluding today so a recorded attempt can't reshuffle today's own drill.

**Question intelligence** lives in `scripts/data/question-intelligence.json` and is emitted by the same generator under the same closed-world rule — but stricter: the key set must be **exactly** the SECTIONS titles, so a renamed question can never ship without its teaching content and a stale key can never linger. Each entry carries `type` (one of six: foundation/recognition/implementation/optimization/variant/design), `tests` (the one-sentence "what am I actually learning here?", shown *before* the attempt and deliberately short of the solution), `minutes`, and an optional `complexity`. `minutes` replaced the flat per-difficulty constant: the generator band-checks it (easy 8–20 / medium 20–35 / hard 35–60) **and** fails if any difficulty's estimates collapse to fewer than 4 distinct values — a band with one value is the old constant wearing a new name. Display labels live in `src/data/questionTypes.ts`.

**Hints are derived, never authored.** `engine/hints.ts` builds the 3-rung ladder (notice → technique → trap) out of the family's existing `signals`/`idea`/`trap`. There is deliberately no second hint corpus: it cannot drift from the family page or the drills, and there is no surface on which to invent guidance for 539 problems. Questions outside the family map get `[]` and the UI says so.

**Company evidence** lives in `scripts/data/companies.json` → `src/data/companies.json`. Every entry is a first-party page, fetched, quoted verbatim, and dated. **There is no per-problem field and there must never be one** — no company publishes the problems it asks, and the only substantial per-problem dataset (LeetCode's) is premium-gated and described by its own help centre as compiled from user surveys. The load-bearing gate in both the generator and `validate:data`: `patterns` may be non-empty **only** when `evidence === 'topics'`, i.e. only when the company's own page actually enumerates data structures/algorithms. `validate:data` also hard-fails if a per-problem key (`questions`, `questionIds`, `problems`, `leetcodeIds`) ever appears.

**Course recall checks** (`src/data/courseRecall.json` + `courseRecall.ts`, adversarially reviewed content, 130 prompts / 26 core weeks) power the "Check yourself" dialog on `/aiml` — treat the JSON as generated (fix source content and re-merge, don't hand-edit entries).

### Invariants that bite if forgotten

- **`progress.byId` is sparse** — only touched questions exist. Every reader must fall back: `byId[id] ?? initialProgress()`. Same rule for **`course.byWeekId`** (`initialCourseProgress()`) and **`tasks.byId`** (may simply be absent).
- **Product rules are locked spec** (see `PRODUCT.md` and the tests): revision ladder 1/3/7/15/30 days, stage 5 = mastered (`nextRevision: null`), any fail → stage 0 due tomorrow; XP 10/20/30 solve, half for revisions, +25 daily goal, +50 weekly clear; course XP 20 session / +50 week clear / 10 review; weekly revision day = roadmap day % 7 === 0; `daySlice` is static id ranges and `currentDay` derives from solved count. Bonus gates: daily bonus at most once per calendar date (`gamification.dailyGoalBonusDate`), weekly bonus at most once per roadmap day (`gamification.weeklyClearBonusDay`); only solved, unmastered questions are revisable. Don't "fix" these without being asked.
- **Course activity is derived, not logged** — streaks/heatmap/calendar count course work via `courseActivityByDate(course.byWeekId)` (session stamps + review grades), never by writing into `DayLog` arrays, which stay DSA-only ledgers.
- **Time has one attribution model** — `DayLog.focusMinutes` is the canonical total time ledger; `QuestionProgress.timeSpentMin` is a per-question *breakdown* of those same minutes (attributed via `ui.focusQuestionId`, maintained by FocusPage). Never sum the two dimensions.
- **Persisted-schema evolution is optional-with-boundary-default** — new `PersistedStateV1` fields are optional (old payloads keep validating); `validatePersisted` echoes them only when present; `loadInitialState` and each slice's `stateImported` case normalize defaults in. Follow this pattern (see the bonus gates, `settings.dailyCapacityMin`, `tasks`, and `QuestionProgress.hintLevelUsed`/`reflection`).
- **Hint use is a signal, never a penalty.** `hintLevelUsed` is monotonic and costs no XP. `engine/mastery.ts` reports the ladder state and hint use *side by side* rather than folding hints into the state — a learner who took a hint must still be able to reach "mastered", or the support feature becomes something people avoid and the signal disappears with it.
- **Daily plan estimates are explicit constants** in `engine/planner.ts` (course session 60m, review 10m, task default 15m) — the UI writes `~` before every total on purpose. The exception is a question revision: `revisionMinutes(q)` derives it from that question's own authored estimate (35%, clamped 5–20m), because revising Two Sum and revising Burst Balloons are not the same eight minutes.
- **The daily plan must be finishable.** `currentDay` derives from the solved count, so finishing today's slice immediately advances the roadmap and exposes the next day's questions. `selectRankedWork` caps new questions at `perDay - solvedToday`, and withholds the course session once one is done today. Without both caps the plan refills the instant it empties and the day can never be completed — a treadmill with no completion moment. Don't remove them.
- **Personalized numbers need evidence.** `engine/timeEstimate.ts` reports a personal figure only at `MIN_SAMPLES` (5) comparable measurements, computes a median *pace ratio* rather than a per-question average (each question is solved once, so there is never a second sample for the same problem), discards implausible samples, and always tells the UI what the comparison set was. An unmeasured solve contributes nothing rather than counting as zero.
- **Analytics suppress rather than pad.** Every builder in `engine/insights.ts` states its own minimum sample and returns `null` below it; an empty findings list is a correct outcome and the UI says "not enough history yet". Every emitted insight carries headline + evidence + recommendation + an action — never a bare metric.
- **Icons resolve through `src/components/shared/iconMap.ts`** — explicit imports keep lucide-react tree-shakeable. Adding an icon name to patterns/achievements data means adding it to ICON_MAP (a test pins this). Never `import * as LucideIcons` in src/.

## Tests

- Page/store tests pin the clock: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))` in `beforeEach`, real timers in `afterEach`. Any new test that renders date-dependent UI **must** do this — an unpinned suite passes today and fails when the wall-clock date moves.
- Use the shared render helper: `import { renderWithStore } from '@/test/renderWithStore'` (Provider + ThemeProvider + TooltipProvider + MemoryRouter). Don't re-declare it per file. Route-parameterised pages (`/patterns/:id`, `/companies/:id`) need their own `MemoryRouter`+`Routes` — see `src/pages/__tests__/companies.test.tsx`.
- Engine fixtures spread `QF` from `@/test/questionFixture` — `Question` requires the authored `type`/`tests` fields, and a scheduling test has no business restating editorial content. Tests that actually assert on the intelligence layer set those fields explicitly instead.
- `src/__tests__/routes.test.tsx` mounts every entry in `NAV_ITEMS` through the real lazy boundaries. It is the only thing that catches a broken `lazy()` import or a missing provider, since page tests render pages directly — don't delete it when adding routes.
- UI copy is asserted in tests. Changing user-facing strings is a behavior change; update tests deliberately, never weaken assertions to make styling changes pass.
- Tests stay offline — anything needing the network lives behind explicit scripts (`audit:links`, `fetch-leetcode-catalog`), never in the suite.
- Never commit failing tests; run the full suite before every commit.

## Design system

`DESIGN.md` (built system: tokens, type voices, motion vocabulary, component idioms) and `PRODUCT.md` (product truth) are authoritative — read them before UI work. Highlights that aren't guessable from the code:

- The visual world is a warm-editorial "course reader" (direction contract lives as an HTML comment in `index.html` and must survive builds). Single fountain-ink accent; per-theme difficulty inks via `--easy/--medium/--hard`; pattern inks (`src/data/patterns.ts`) go on icons/borders/tints, never on label text.
- **Fossil class names**: `.glass` renders a solid paper plate, `.text-gradient` solid serif text, `.bg-accent-gradient` solid ink fill. Kept to avoid mass renames — never reintroduce actual glass/gradients through them. On accent plates use `text-primary-foreground`, never `text-white`.
- Both themes are first-class: dark "lamplight" is default; light is `.light` on `<html>`, toggled via `ThemeContext` → settings slice. Markdown notes previews get theme-aware prose colors from the typography override in `tailwind.config.js` — never `prose-invert`.
- An impeccable design hook auto-scans UI file edits and reports findings — act on them.
