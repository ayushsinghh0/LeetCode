# DSA Roadmap App — Design Spec

**Date:** 2026-07-30
**Status:** Approved by user (sections 1–3 approved in brainstorming session)
**Goal:** A local-first, premium-feeling web app that makes daily DSA practice near-impossible to miss: 8 new questions/day over a 539-question roadmap, with spaced-repetition revision, analytics, and gamification.

---

## 1. Decisions Made (with user)

| Decision | Choice |
|---|---|
| Dataset | All **539** questions from the user's pasted list (not 520). Roadmap is dynamic: `ceil(539 / questionsPerDay)` = **68 days** at the default 8/day. Changing questions/day in Settings recalculates the plan. |
| Day advancement | **Progress-based.** Day N advances only when its 8 questions are solved. No backlog mechanics. Revision due dates follow the real calendar. |
| V1 scope | **Everything**, including all bonus features (Pomodoro, focus mode, revision predictor, smart recommendation, productivity score). |
| State management | **Redux Toolkit** + react-redux. |
| "AI" features | Heuristic engines (no LLM calls in v1). A clean interface seam allows a real AI API later. |

## 2. Question Dataset

- Static file `src/data/questions.json`; 539 entries in the exact order pasted by the user (pattern by pattern), which **is** the roadmap order.
- Per question: `id` (1–539), `title`, `pattern` (one of 28 pattern ids), `difficulty` (`easy | medium | hard`), `estimatedTime` (minutes: easy 15, medium 25, hard 40).
- Static data is **separate from progress** so dataset fixes never clobber user progress and the persisted payload stays small.

Pattern counts (sum 539): Two Pointers 34 · Fast & Slow Pointers 10 · Sliding Window 23 · Intervals 11 · Linked List In-Place 14 · Two Heaps 12 · K-way Merge 7 · Top K Elements 18 · Modified Binary Search 24 · Subsets 8 · Greedy 24 · Backtracking 20 · Dynamic Programming 41 · Cyclic Sort 6 · Topological Sort 12 · Sort and Search 19 · Matrices 20 · Stacks 20 · Graphs 18 · Tree DFS 22 · Tree BFS 14 · Trie 15 · Hash Maps 32 · Knowing What to Track 24 · Union Find 14 · Custom Data Structures 16 · Bitwise Manipulation 18 · Math & Geometry 43.

## 3. Data Model (TypeScript)

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionStatus = 'unsolved' | 'in_progress' | 'solved' | 'skipped';

interface Question {            // static (questions.json)
  id: number;                   // 1..539, global roadmap order
  title: string;
  pattern: PatternId;           // 28 pattern ids
  difficulty: Difficulty;
  estimatedTime: number;        // minutes
}

interface QuestionProgress {    // dynamic, persisted, keyed by id
  status: QuestionStatus;
  revisionStage: 0 | 1 | 2 | 3 | 4 | 5;  // 0 = awaiting first revision; 5 = mastered
  nextRevision: string | null;  // ISO date; null when mastered or unsolved
  revisionHistory: { date: string; passed: boolean }[];
  notes: string;                // markdown
  bookmarked: boolean;
  completedAt: string | null;
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  timeSpentMin: number;
}

interface DayLog {              // per calendar date, persisted
  date: string;                 // yyyy-MM-dd
  solvedIds: number[];
  revisionsPassed: number[];
  revisionsFailed: number[];
  xpEarned: number;
  focusMinutes: number;         // from Pomodoro
}
```

## 4. Core Engine (pure functions in `utils/engine/`)

### Roadmap
- Not stored; computed. Day N = slice `[(N-1)*perDay, N*perDay)` of the ordered dataset.
- `currentDay = floor(solvedNewCount / perDay) + 1` (capped at total days).
- Estimated finish date: rolling 14-day average solve pace projected over remaining questions; falls back to `perDay` pace when history < 3 active days.

### Spaced repetition
- Intervals: `[1, 3, 7, 15, 30]` days for stages 1–5.
- On solve: `revisionStage = 0`, `nextRevision = completedAt + 1 day`.
- On pass: stage advances; `nextRevision = today + interval[newStage]`. Passing the 30-day review → **Mastered** (stage 5, `nextRevision = null`, leaves the cycle).
- On fail: restart — stage back to 0, `nextRevision = today + 1 day`.
- Due = `nextRevision <= today`. Overdue items accumulate, sorted oldest-first.

### Weekly Revision Day
- Every 7th **roadmap** day (7, 14, 21, …): due revisions topped up to 15–20 items sampled from all solved questions, prioritized by low confidence → past failures → longest since last review. Top-up items that pass do **not** advance their stage early unless they were actually due (they refresh `lastReviewed` only); failed top-ups restart their schedule like any fail.

### Streak
- Any calendar day with ≥1 activity (solve or revision) keeps the streak alive.
- "Perfect day" = daily goal (8 new) completed; tracked separately for achievements/productivity.

### XP & Levels
- Solve: easy 10 / medium 20 / hard 30 XP. Revision pass: half of solve value. Daily-goal bonus +25. Weekly-revision-day full clear +50.
- Quadratic level curve: total XP required for level *n* = `50 · n · (n+1)` (fast early levels, slow later).

### Achievements (~20)
First Solve · 10/50/100/250/500/539 Solved · 3/7/14/30/50/68-day Streaks · per-pattern 100% badges (incl. "100% Two Pointers", "Completed DP", "Completed Graphs", "Completed Trees") · All Easy / All Medium / All Hard · Perfect Revision Week (7 consecutive days with all due revisions passed) · Comeback (activity after a 3+ day gap) · First Mastered Question · 100 Mastered.

### Recommendations & scores (heuristics)
- **Weakest pattern:** lowest composite of accuracy, avg confidence, revision failure rate (patterns with <3 attempts excluded).
- **Smart recommendation:** today's optimal mix = overdue revisions first, then weak-pattern due items, then the day's new slice. Exposed behind a `Recommender` interface so an LLM-backed implementation can slot in later.
- **Revision predictor:** projects revision load per day for the next 30 days from current `nextRevision` dates + expected new solves.
- **Productivity score (0–100):** weighted mix of 14-day consistency (days active), goal completion rate, and revision pass rate.

## 5. Architecture

**Stack:** Vite · React 18 · TypeScript strict · TailwindCSS · shadcn/ui · Framer Motion · React Router · React Hook Form · Lucide · **Redux Toolkit + react-redux** · Recharts · react-markdown · canvas-confetti · date-fns · Vitest + Testing Library.

```
src/
  components/   ui/ (shadcn) · layout/ (AppShell, Sidebar) · dashboard/ · questions/ ·
                charts/ · gamification/ · calendar/ · shared/
  pages/        Dashboard · Today · Roadmap · Patterns · PatternDetail · Revision ·
                Calendar · Analytics · Achievements · Bookmarks · Settings   (lazy-loaded)
  store/        store.ts · slices/ (progress, settings, gamification, ui) · selectors/
  services/     storage/ (StorageAdapter, LocalStorageAdapter, persistence middleware)
  hooks/        useToday, useStreak, usePomodoro, useConfetti, ...
  utils/        engine/ (roadmap, spacedRepetition, stats, xp, achievements,
                recommendations, predictor) · misc utils
  types/  data/  contexts/ (ThemeContext only)  assets/
```

**Persistence seam:** UI never touches storage. A Redux listener middleware debounce-saves persisted slices via the `StorageAdapter` interface (`load / save / export / import`). Supabase/Firebase later = one new adapter, zero UI change.

**Slices:** `progress` (QuestionProgress map + DayLogs) · `settings` (questionsPerDay, revision toggle, theme, notifications) · `gamification` (XP, unlocked achievements, streak state) · `ui` (focus mode, pomodoro, modals — not persisted). All derived stats (completion %, pattern %, weak patterns, finish date, productivity) are **memoized selectors** — never stored, never stale.

**Routing:** sidebar shell (collapsible rail on tablet, bottom bar on mobile) with the 10 nav destinations. Question detail = modal over any page (notes editor with markdown preview, confidence, revision timeline).

## 6. UI / UX

- **Theme:** dark-first. Deep navy/indigo gradient background; glassmorphism cards (translucent, backdrop-blur, subtle border glow); rounded-2xl; one accent gradient (violet→cyan) for progress fills, active states, level badge. Light theme included.
- **Motion:** page transitions, staggered card entrances, animated progress rings/bars, hover lift, streak-flame pulse. Confetti on daily-goal completion; fireworks on pattern 100% and final-day completion.
- **Dashboard:** hero row (Day X/68, streak flame, XP/level ring) · stat grid (solved, remaining, completion %, revisions due, estimated finish) · today's progress · contribution heatmap (GitHub-style) · weakest-pattern recommendation · daily quote.
- **Today:** 8 new-question cards + revision queue with Pass/Fail; per-card actions: Start, Solved, Need Revision, Bookmark, Skip, Notes, Confidence. Card shows title, difficulty, pattern, revision stage, status, estimated time, notes indicator.
- **Roadmap:** 68-day vertical timeline — green done, blue current, gray future.
- **Patterns:** 28 animated progress cards (solved / revised / remaining / %), drill-down page per pattern.
- **Analytics:** solved-per-day chart, pattern completion, difficulty completion + accuracy, revision success rate, strong/weak patterns, consistency, longest + current streak, calendar heatmap, revision-load forecast (predictor).
- **Calendar:** clickable month grid → day detail (solved, revisions, focus time, notes).
- **Settings:** questions/day (default 8), revision toggle, theme, notifications toggle, reset progress (confirm dialog), export/import progress as JSON.
- **Bonus surfaces:** floating Pomodoro widget (logs focus minutes to DayLog) · Focus mode (hides chrome, one question at a time) · daily quote (local list, deterministic by date) · random interview question picker · smart-recommendation panel.
- **Responsive:** desktop / tablet / mobile layouts; bottom nav on mobile.

## 7. Testing

- **TDD on the engine:** Vitest unit tests for spaced repetition (pass/fail/mastered transitions, due calculation), roadmap math, weekly top-up sampling, streak logic, XP/levels, achievements, stats selectors, predictor.
- UI: smoke/render tests for key pages; engine correctness is the priority.

## 8. Deployment

- Vercel: static SPA build (`vite build`), `vercel.json` rewrite all routes → `index.html`. No server.

## 9. Explicitly Deferred

- Real LLM-backed recommendations (interface seam exists).
- Supabase/Firebase sync + auth (StorageAdapter seam exists).
- Push/browser notifications beyond a settings toggle stub.
