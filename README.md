# DSA Roadmap

A local-first, single-page React app for structured, spaced-repetition practice of a 539-question data-structures-and-algorithms roadmap across 28 patterns. It plans your daily practice (8 new questions/day by default, configurable 4–16 — about 68 days to cover everything at the default pace), automatically re-queues every solved question for review on a 1 → 3 → 7 → 15 → 30-day ladder, and tracks the whole thing — streaks, XP, levels, 48 achievements, and analytics — entirely in your browser.

There is no backend, no account, and no network calls after the initial page load. Progress lives in `localStorage` and is fully exportable/importable as JSON, so it's yours to keep.

Built with React 18, TypeScript (strict), Redux Toolkit, React Router 6, Tailwind CSS, Framer Motion, Recharts, and Vitest. Responsive from a 375px phone (bottom tab nav) up through desktop (full sidebar) — see the [responsive audit](#responsive) below.

## Features

### Roadmap & practice

- 539 questions across 28 classic patterns (Two Pointers, Sliding Window, Dynamic Programming, Graphs, and so on), split into fixed daily slices.
- Question cards show difficulty, pattern, and estimated time. A detail modal adds a markdown notes editor, a 1–5 confidence rating, a bookmark toggle, and Solved / Need Revision / Skip actions.
- A roadmap timeline page lists every day's slice and its completion state; a patterns grid and per-pattern detail page let you filter and drill into a single topic.

### Spaced repetition

- Every solved question re-enters a 1 → 3 → 7 → 15 → 30-day revision ladder (see [How Revision Scheduling Works](#how-revision-scheduling-works)).
- The Today page surfaces due/overdue revisions alongside today's new questions. The Revision Center shows a forecast of upcoming due dates and the list of already-mastered questions.
- Weekly Revision Day (every 7th roadmap day) tops up the revision queue toward 15–20 questions, pulling from solved-but-not-yet-due questions ranked weakest-first (lowest confidence, most past fails, longest since last reviewed) whenever the naturally-due count falls short.

### Dashboard & analytics

- Dashboard: day counter, streak flame, level ring, XP badge, completion ring, a GitHub-style activity heatmap, a weakest-pattern callout, smart recommendations (due revisions, weakest pattern, today's new questions), and a seeded "Random question" picker.
- Analytics page: solved-per-day, revision pass rate, difficulty breakdown, pattern completion, and finish-date forecast charts (Recharts).
- Calendar page: a full activity heatmap with a per-day detail dialog.

### Gamification

- XP for solves (10/20/30 by difficulty) and revisions (half that), a +25 daily-goal bonus, and a +50 bonus for fully clearing a Weekly Revision Day; a level-up ring where reaching level *n+1* costs `100 × n` XP.
- Streaks (current + longest; revision-only days keep the streak alive), confetti when today's solve count crosses the daily goal, and fireworks when a pattern reaches 100%.
- 48 achievements — 20 milestone achievements plus one mastery achievement per pattern — with unlock toasts and a gallery page.

### Search, bookmarks, focus

- Global search (`Ctrl/Cmd+K`, or the mobile "More" sheet) filtering by title, difficulty, status, pattern, and bookmark state.
- A dedicated Bookmarks page for flagged questions.
- A distraction-free Focus mode (`/focus`, no sidebar chrome) with an integrated Pomodoro timer — also available as a floating widget everywhere else in the app.

### Settings & data portability

- Adjustable daily question count, a spaced-revision on/off toggle, dark/light theme, and a notifications toggle (currently a stub — see [Roadmap](#roadmap-v2)).
- Export progress to a timestamped JSON backup at any time. Import restores from a backup after structural validation, with a confirmation dialog previewing what will change. Reset wipes all progress, gated behind typing a confirmation phrase.

## Getting Started

Requires Node 18 or newer.

```bash
npm install            # install dependencies
npm run dev            # start the Vite dev server (http://localhost:5173)
npm run build           # type-check (tsc -b) and build a production bundle to dist/
npm run preview          # serve the production build locally
npm test                # run the full Vitest suite once
npm run test:watch       # run Vitest in watch mode
```

Everything is stored in the browser's `localStorage` — nothing is sent anywhere.

## Deploying to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In Vercel, choose **Add New Project** and import the repo. Vercel auto-detects the Vite framework preset; the defaults are correct:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. The `vercel.json` at the repo root already provides the SPA rewrite this app needs, so client-side routes (e.g. `/analytics`, `/patterns/two-pointers`) don't 404 on a hard refresh or direct link:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Deploy. No environment variables or backend services are required — this is a fully static, local-first app.

Or from the CLI: `npm i -g vercel`, then `vercel` (preview) or `vercel --prod` from the repo root.

## Data Model

Everything the app persists lives in one versioned object, `PersistedStateV1` (`src/types/index.ts`), written to `localStorage` under the key `dsa-roadmap:v1` by `LocalStorageAdapter` (`src/services/storage/`):

```ts
{
  version: 1,
  progress: {
    byId: Record<number, QuestionProgress>,  // sparse — only touched questions, see below
    dayLogs: Record<string, DayLog>,         // keyed by yyyy-MM-dd
    startDate: string | null,
  },
  settings: { questionsPerDay, revisionEnabled, theme, notifications },
  gamification: { xp: number, unlocked: Record<string, string> }, // achievementId -> unlock date
}
```

- **`QuestionProgress`** (one entry per *touched* question): `status` (`unsolved` / `in_progress` / `solved` / `skipped`), `revisionStage` (0–5), `nextRevision`, `lastReviewed`, `revisionHistory` (a pass/fail log), `notes` (markdown), `bookmarked`, `completedAt`, `confidence` (1–5 or `null`), `timeSpentMin`. Untouched questions are never written to `byId` — every reader falls back to a clean `initialProgress()` record for missing ids, so the map only grows as you actually interact with questions.
- **`DayLog`** (one entry per calendar day with any activity): `solvedIds`, `revisionsPassed`, `revisionsFailed`, `xpEarned`, `focusMinutes`. Streaks, the activity heatmap, and the pace/finish-date forecast are all derived from these logs.
- All storage access goes through the `StorageAdapter` interface (`load(): PersistedStateV1 | null`, `save(state): void`) — the UI and Redux store never touch `localStorage` directly. Saves are debounced (500ms) except after an import or a reset, which flush synchronously so a refresh immediately afterward can't lose the change. Anything that fails structural validation (wrong types, missing fields, foreign JSON) is rejected wholesale and treated as "no saved state" rather than crashing the app or partially loading corrupt data.

## How Revision Scheduling Works

Every question that gets marked solved starts a spaced-repetition ladder. Passing a revision advances one stage and schedules the next revision further out; failing at any stage sends it straight back to the start.

| Stage transition | Interval scheduled on pass | Notes |
|---|---|---|
| Solved → stage 0 | 1 day | First revision is always scheduled for the day after solving. |
| Stage 0 → 1 | 3 days | |
| Stage 1 → 2 | 7 days | |
| Stage 2 → 3 | 15 days | |
| Stage 3 → 4 | 30 days | |
| Stage 4 → **5 (Mastered)** | — | `nextRevision` becomes `null`; the question exits the revision queue for good. |

Failing a revision — at any stage — resets `revisionStage` to `0` and reschedules `nextRevision` to the very next day, exactly like a fresh solve's first revision. There's no partial credit for how far up the ladder a question had climbed before the fail.

## Roadmap (v2)

- **Supabase adapter** — implement the existing `StorageAdapter` interface (`load` / `save`) against Supabase instead of `localStorage`, enabling account-based multi-device sync without changing the Redux store, selectors, or any UI code — the seam this app is already built around.
- **Real AI recommender** — replace `HeuristicRecommender` with an LLM-backed implementation of the `Recommender` interface (`recommend({ all, byId, due, todaysNew, weakest }): Recommendation[]`) for genuinely personalized next-question suggestions and weak-area coaching, in place of today's fixed heuristic (due revisions, then weakest pattern, then today's new questions).
- Wire up the `notifications` setting — already toggleable in Settings, currently a no-op — to real due-today reminders.

## Responsive

Audited at 375×812 (mobile), 768×1024 (tablet), and 1280×800 (desktop): no page ever scrolls horizontally, the bottom tab bar replaces the sidebar below the `md` breakpoint, all dialogs fit within the viewport at every width, and the activity heatmap scrolls horizontally inside its own container without affecting the page.
