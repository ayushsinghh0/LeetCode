# Unified Activity System — course as a first-class citizen

Date: 2026-08-01 · Iteration 1 of the Learning-OS unification (PROJECT TITAN brief)

## Problem

The AI/ML course track was added beside the DSA track instead of into it. Audit findings
(file:line refs verified 2026-08-01):

- **Streak/heatmap blindness.** `hasActivity` (engine/streak.ts) and the heatmap count
  (store/selectors.ts `selectHeatmapData`) read only `solvedIds`/`revisionsPassed`/
  `revisionsFailed`. A day spent entirely on a course session earns XP (visible on the
  calendar via `bonusXpLogged`) yet renders a blank cell and breaks the streak.
- **Migration hole (data bug).** Weeks cleared before the review ladder shipped are
  normalized to `revisionStage: 0, nextRevision: null`; `dueCourseReviewWeekIds` requires
  `nextRevision !== null`, so those weeks can never become due.
- **`reviseCourseWeek` never calls `evaluateAndUnlockAchievements`** — the only mutation
  thunk that skips it.
- **Ladder duplication.** engine/aimlCourse.ts re-implements applyRevision/isMastered/
  isDue/dueIds from engine/spacedRepetition.ts over a different progress type (~50 dup lines).
- **Revision surface split.** `/revision` (Due/Upcoming/Mastered) is questions-only; due
  course reviews exist only on `/aiml`. Dashboard's "Revisions Due" stat excludes course
  reviews even though the page already subscribes to them.
- **Shell gaps.** No 404 route; nav lists hand-synced across Sidebar.tsx, MobileNav.tsx;
  `/aiml` buried in the mobile "More" sheet although it's one of two tracks; docs
  (PRODUCT.md, CLAUDE.md) don't mention the course track.

## Non-goals (later iterations)

Command palette / unified search (iter 2). Dashboard/Today layout dedup & redesign
(iter 3). Analytics course parity, focus-mode course sessions, course bookmarks/
confidence (iter 4+). Locked product spec (ladder intervals 1/3/7/15/30, XP values,
weekly-day rule, daySlice) is untouched — the course already shares those constants.

## Design

### 1. Shared ladder primitive (engine)

`spacedRepetition.ts` exports one generic transition used by both tracks:

```ts
export interface LadderReview { revisionStage: number; nextRevision: string | null }
export function applyLadderReview(stage: number, passed: boolean, date: ISODate): LadderReview
export function isLadderDue(nextRevision: string | null, today: ISODate): boolean
```

`applyRevision` (questions) and `applyCourseReview`/`applyCourseWeekClear`/
`dueCourseReviewWeekIds` (course) become thin wrappers. Behavior is identical to today;
existing tests must pass unchanged.

### 2. Course activity derivation (no schema change)

No new persisted fields. A selector derives activity dates from `course.byWeekId`:
`day1DoneOn`, `day2DoneOn`, and `revisionHistory[].date` each contribute 1 activity unit
to their date. Pure function `courseActivityByDate(byWeekId): Map<ISODate, number>` lives
in engine/aimlCourse.ts. Deriving (rather than logging) retroactively credits every past
course day and needs no migration.

Consumers:
- `selectStreaks` — streak engine gains an optional `extraActivityDates: Set<ISODate>`
  parameter (pure, defaulted empty; existing call sites unchanged in behavior).
- `selectHeatmapData` — cell count = DSA count + course count for the date.
- `CalendarPage` day count — same merge (LEVEL_CLASS/dayLogCount convention duplication:
  update both sides together, per DESIGN.md).
- Calendar day dialog line gains "· N course sessions" when non-zero.

### 3. Bug fixes

- `normalizeCourseWeekProgress`: if the week is done, `revisionStage < 5`, and
  `nextRevision === null`, seed `nextRevision = day2DoneOn + 1 day` (ladder entry the
  clear would have written). Overdue-in-the-past is correct and surfaces immediately.
- `reviseCourseWeek` calls `evaluateAndUnlockAchievements` after XP, like every other thunk.
- `selectAchievementCtx` (currently test-only/dead) becomes the single ctx source used by
  `evaluateAndUnlockAchievements` in actions.ts.

### 4. Unified revision surface

- `/revision` gains course weeks in all three tabs: **Due** (Pass/Fail actions), **Upcoming**
  (sorted by `nextRevision`), **Mastered** (retained weeks). Stat cards count both tracks.
- A shared `CourseReviewCard` component (extracted from AimlCoursePage's review section)
  renders a due week with Pass/Fail; used by both `/aiml` and `/revision`.
- Dashboard "Revisions Due" stat = question queue + due course reviews.
- TodayPage keeps `CourseTodayCard` (already shows due-review count + link).

### 5. Shell & docs

- Single nav registry `src/components/layout/navItems.ts` consumed by Sidebar and
  MobileNav; `/aiml` promoted into the 5 primary mobile tabs (replacing Analytics, which
  is a desktop review surface; Analytics moves to the More sheet).
- 404 catch-all route inside AppShell (EmptyState-based, link back to Dashboard).
- PRODUCT.md gains the course track (what it is, pacing, review ladder, route); CLAUDE.md
  engine/slice lists gain `aimlCourse`/`course`.

## Testing

Every behavior change lands with tests (fake-timer pinned): ladder wrapper equivalence,
normalize backfill, streak/heatmap merge, revision-page course sections (copy asserted
deliberately), dashboard stat count, nav registry, 404. Full suite + `tsc` + build green
before each commit.

## Sequencing

engine → store/selectors → UI → shell → docs; commit per coherent step.
