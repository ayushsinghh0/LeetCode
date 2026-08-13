# DSA Roadmap — Project Context (paste this into any AI chat to onboard it)

Repo: `D:\ayuu\Leetcode` (git repo, branch `master`-style single line of commits). Deployed as a static Vite site (Vercel-ready, `vercel.json` SPA rewrite included).

## What it is

A **local-first, single-user SPA** for daily LeetCode-style interview prep. Fixed dataset of **539 questions across 28 patterns** (Two Pointers, Sliding Window, DP, Graphs, …), paced at 8 new questions/day (configurable 4–16, ~68 days total), with **spaced-repetition revision on a 1/3/7/15/30-day ladder**. A second track — the **AI/ML course** (100xDevs cohort, 26 core week-modules as 2-day sprints + 5 optional extras) — shares the same activity system. No backend, no accounts, no network calls after load; all progress lives in `localStorage` and is exportable/importable as JSON.

## Tech stack

- Vite 6 + React 18 + TypeScript **strict** (noUnusedLocals/Parameters) + Redux Toolkit + React Router 6
- Tailwind CSS 3.4 + vendored shadcn/Radix primitives in `src/components/ui/` (badge, button, card, dialog, input, label, progress, select, switch, tabs, textarea, tooltip)
- Framer Motion (motion), Recharts (charts), react-markdown + remark-gfm (notes), canvas-confetti, date-fns, lucide-react
- Fonts: Besley (serif display), Source Sans 3 (body), Spline Sans Mono — via @fontsource-variable
- Vitest 3 + Testing Library (jsdom). Path alias `@/` → `src/`.

## Commands (Windows repo — PowerShell chaining `;`, not `&&`)

```
npm run dev          # Vite dev server (5173; .claude/launch.json pins 5180)
npm run build        # tsc -b && vite build → dist/
npx tsc --noEmit     # type-check only
npx vitest run       # full test suite — must stay green
node scripts/generate-questions.mjs   # the ONLY way to change src/data/questions.json — never hand-edit
```

## Architecture (load-bearing layering, dependency order)

1. **Pure engine — `src/utils/engine/`**: spacedRepetition, roadmap, streak, xp, stats, achievements, recommendations, predictor, weeklyRevision, aimlCourse. All business math is pure deterministic functions: **no React/Redux imports, no clock access** — every function takes ISO `yyyy-MM-dd` strings (string compare with `<=` works). The single clock read is `todayISO()` in `src/utils/dates.ts`, called only by UI/thunks. This is what makes the test suite deterministic — keep it. The one spaced-repetition ladder lives in `spacedRepetition.ts` (`ladderEntry` / `ladderAfterReview` / `isLadderDue`); questions and course weeks are both thin wrappers over it.
2. **Store — `src/store/`**: slices `progress`, `settings`, `gamification`, `course`, `ui` are dumb reducers calling engine functions. **`src/store/actions.ts` thunks are the only public mutation API** — UI never dispatches slice actions directly (exception: `ui` slice). Thunks supply dates via `todayISO()` and orchestrate cross-slice effects (XP, bonuses, achievements, celebrations). Derived stats come from memoized selectors in `selectors.ts`.
3. **Persistence — `src/services/storage/`**: `StorageAdapter` interface (`load()`/`save()`), localStorage impl, key `dsa-roadmap:v1`, versioned `PersistedStateV1` (`src/types/index.ts`). Debounced 500ms middleware; import/reset flush synchronously. UI never touches localStorage. Invalid/foreign JSON is rejected wholesale (treated as no saved state). The planned Supabase adapter (v2) implements this same seam.
4. **UI — `src/pages/`** (12 lazy routes) inside `AppShell` (sidebar ≥md, bottom tab nav below), **except `/focus` which is routed outside AppShell** (no chrome; prevents the floating PomodoroWidget double-mounting).

Routes: Dashboard `/`, Today, Roadmap, AI/ML course `/aiml`, Patterns (+ `/patterns/:slug` detail), Revision, Calendar, Analytics, Achievements, Bookmarks, Settings, 404 catch-all, Focus `/focus`. Global search = Ctrl/Cmd+K command palette.

## Invariants that bite

- **`progress.byId` is sparse** — only touched questions exist. Every reader must fall back: `byId[id] ?? initialProgress()`. Same for `course.byWeekId` → `initialCourseProgress()`.
- **Course activity is derived, not logged** — streaks/heatmap/calendar count course work via `courseActivityByDate(course.byWeekId)` (session stamps + review grades), never by writing into `DayLog` arrays, which stay DSA-only ledgers.
- **Product rules are LOCKED SPEC** — don't "fix" without being asked:
  - Revision ladder 1/3/7/15/30 days; stage 5 = mastered (`nextRevision: null`); **any fail → stage 0, due tomorrow** (no partial credit). A pass advances the ladder whether it came from the due queue or a weekly top-up (deliberate, accepted deviation from an early design note).
  - XP: 10/20/30 per solve by difficulty, **half for revisions**, +25 daily-goal bonus, +50 weekly-clear bonus. Course XP: 20/session, +50/cleared week, 10/review. Level n+1 costs `100 × n` XP.
  - Weekly Revision Day = roadmap day % 7 === 0; tops the due queue up to 15–20 pulling solved-not-yet-due questions weakest-first (lowest confidence, most fails, longest since review).
  - `daySlice` is static id ranges; `currentDay` derives from solved count.
  - A day counts as active (streak/heatmap/calendar) when either track saw work.
  - 48 achievements = 20 milestone + 1 mastery per pattern (28).

## Data model (persisted, `PersistedStateV1`)

```ts
{ version: 1,
  progress: { byId: Record<number, QuestionProgress>,   // sparse
              dayLogs: Record<string, DayLog>,          // keyed yyyy-MM-dd
              startDate: string | null },
  settings: { questionsPerDay, revisionEnabled, theme, notifications },
  gamification: { xp: number, unlocked: Record<string, string> } }  // + course state
```

`QuestionProgress`: status (`unsolved`/`in_progress`/`solved`/`skipped`), revisionStage 0–5, nextRevision, lastReviewed, revisionHistory (pass/fail log), notes (markdown), bookmarked, completedAt, confidence (1–5|null), timeSpentMin.
`DayLog`: solvedIds, revisionsPassed, revisionsFailed, xpEarned, focusMinutes — streaks/heatmap/forecast all derive from these.

## Testing rules

- Page/store tests **pin the clock**: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))` in `beforeEach`, real timers in `afterEach`. Any new date-dependent test must do this or it fails when the wall-clock date moves.
- **UI copy is asserted in tests** — changing user-facing strings is a behavior change; update tests deliberately, never weaken assertions.
- Full suite green before every commit. Tests live in `__tests__/` beside their subjects (engine, store, pages, components, hooks, data, storage).

## Design system (from DESIGN.md — authoritative, read before UI work)

- **Warm-editorial "course reader"** world (user-pinned redesign 2026-07-31, replacing an older violet/cyan gradient-glass identity): paper-inspired, serif display voice (Besley), generous whitespace, calm and human. Avoid the generic cream+serif+terracotta cliché. Direction contract lives as an HTML comment in `index.html` and must survive builds.
- Single fountain-ink accent; per-theme difficulty inks `--easy/--medium/--hard`; pattern inks (`src/data/patterns.ts`) go on icons/borders/tints, **never on label text**.
- **Fossil class names** (kept to avoid mass renames — never reintroduce the literal effect): `.glass` = solid paper plate, `.text-gradient` = solid serif text, `.bg-accent-gradient` = solid ink fill.
- Both themes first-class: dark "lamplight" is default; light = `.light` on `<html>`, toggled via `ThemeContext` → settings slice.
- No hype language; existing plain copy stays.
- Responsive: audited at 375×812 / 768×1024 / 1280×800; no horizontal page scroll ever; heatmap scrolls inside its own container.

## Key file map

```
src/data/          questions.json (539 q, generated only), patterns.ts (28), aimlCourse.ts, quotes.ts
src/utils/engine/  all business math (pure) + tests
src/utils/         dates.ts (todayISO), filterQuestions, overdueLabel, cn
src/store/         store, actions.ts (thunks = mutation API), selectors.ts, sharedActions, slices/
src/services/storage/  StorageAdapter, LocalStorageAdapter, persistence (middleware), serialize
src/pages/         12 route pages + tests
src/components/    layout/ (AppShell, Sidebar, MobileNav, navItems registry), questions/, course/,
                   charts/, gamification/, shared/ (Heatmap, SearchDialog, EmptyState…), pomodoro/, ui/ (shadcn)
src/contexts/      ThemeContext
src/hooks/         useToday, usePomodoro, useCelebration
docs/superpowers/  original plan + design specs (DSA app, AI/ML course, unified activity system)
```

## Current state & v2 roadmap

- Recent work (top of git log): unified activity system (course = first-class citizen), spaced repetition for course weeks, Ctrl+K command palette, unified revision surface + nav registry + 404, analytics course parity, daily-progress plate refactor.
- v2 plans: **Supabase adapter** behind the existing `StorageAdapter` seam (multi-device sync, no UI/store changes); **LLM-backed `Recommender`** replacing `HeuristicRecommender` (interface: `recommend({ all, byId, due, todaysNew, weakest }): Recommendation[]`); wire up the currently no-op `notifications` setting to real due-today reminders.
