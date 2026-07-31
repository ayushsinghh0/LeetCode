# AI/ML Course Track — Design

**Date:** 2026-07-31 · **Status:** approved for implementation (user requested end-to-end execution; interactive approval gates resolved autonomously and documented here)

## Goal

Integrate the 100xDevs AI & ML cohort (course 23) into the DSA Roadmap app as a second track, paced at **one week-module per 2 calendar days** ("2-day sprints"): Day 1 watch the lecture, Day 2 work the slides/notebook/resources. The app answers at a glance: what's my AI/ML task today, how far am I, when do I finish.

## Source of truth for course content

Scraped live from the public course outline API (`course-backend.100xdevs.com/courses/23/content?parentId=4148`) on 2026-07-31 and cross-checked against the user's own notes and screenshots:

- 26 teaching weeks: Week 0–26, **Week 19 was cancelled** (absent on the site).
- 5 optional extras: How Modern AI Agents Under the Hood (Parts 1–2, folder 7141 → items 7142/7143), Session on Memory by Samiksha (Memory I/II, folder 7399 → items 7400/7401), Evals/Benchmarks Super 30 class (`v_aada66b3-…`).
- Content ids are strings (`'4149'` … and `v_<uuid>` for the newest items). Lecture URL: `https://100xdevs.com/new-courses/23/video/{id}`; folders use `…/content?parentId={id}`.
- Resource links (slides/colab/excalidraw/articles/etc.) come verbatim from the user's notes; the Week 14 YC URL's literal spaces are percent-encoded.
- Data corrections applied deliberately: Week 4 taught-date `07/02/2026` (site) over the notes' `06/02`; Week 22 taught-date recorded as `2026-06-13` — the site shows `13/12/2026`, an obvious typo (its companion repo is named `13-june-assignment`).

## Architecture (follows the four-layer invariant)

1. **Data — `src/data/aimlCourse.ts`** (new, hand-maintained; `questions.json`/generator untouched). Types `CourseWeek { id ('w00'…'w26'/'x-…'), week, title, taughtOn (ISO|null), contentId (string|null), contentKind ('video'|'folder'), resources: CourseResource[], optional? }` plus `lectureUrl(week)` and `COURSE_CONTENT_URL` fallback.
2. **Engine — `src/utils/engine/aimlCourse.ts`** (pure, no clock/React/Redux; ISO strings in/out).
   - Extras are **single-session** items (day 1 only); core weeks have sessions 1 and 2.
   - `courseSessions()` → ordered 52 core sessions; `nextCoreSession`, `remainingCoreSessions`, `completedCoreSessionCount`.
   - `courseSchedule(byWeekId, today)` → planned ISO date per remaining core session: **dynamic pacing** — remaining sessions map to consecutive days starting today (mirrors the DSA roadmap's derive-from-progress philosophy; there is no "behind").
   - `courseProjectedFinish(byWeekId, today)` → date of the last remaining session, `null` when complete.
   - `courseStats(byWeekId)` → `{ coreWeeksDone/26, sessionsDone/52, pct, extrasDone/5 }`.
   - XP constants live here (NOT in the locked `xp.ts`): `COURSE_SESSION_XP = 20`, `COURSE_WEEK_CLEAR_BONUS = 50` (matches the app's existing bonus register).
3. **Store** — new `course` slice `{ byWeekId: Record<string, CourseWeekProgress { day1DoneOn, day2DoneOn }> }`, **sparse** with `initialCourseProgress()` fallback (same rule as `progress.byId`). Reducers: `courseSessionCompleted` (idempotent), plus `stateImported`/`progressReset` extraReducers. Public mutation API stays thunks-only: `completeCourseSession(weekId, day)` awards session XP via `xpAdded` **and** `bonusXpLogged` (keeps the Σ dayLogs.xpEarned == gamification.xp ledger invariant; safe for streaks because `hasActivity()` only counts solve/revision arrays), fires the week-clear bonus + confetti when a core week completes. **One-way** like `solveQuestion` — no undo anywhere in this app. No achievement changes (locked list).
4. **Persistence** — `PersistedStateV1` gains **optional** `course?: { byWeekId }`. `validatePersisted`: absent → fine (old backups load), present-but-malformed → reject wholesale (file's existing philosophy). Serialize/load/import/reset all round-trip it.

## UI

- **New lazy route `/aiml`** in AppShell; sidebar item "AI/ML" (GraduationCap) after Roadmap; mobile "More" sheet gains the same (primary bottom row is full at 5).
- **AimlCoursePage** (course-reader idiom, both themes):
  - Hero plate: mono kicker `100xDevs cohort · 2-day sprints`, serif `AI & ML`, session progress bar, figures (`X / 52 sessions · Y / 26 weeks`), projected finish date.
  - "Up next" plate: week title, `Day 1 · Lecture` / `Day 2 · Practice & notes` chip, primary **Mark session done**, outline **Open lecture** (external), that week's resource chips.
  - Syllabus: one plate, 26 `.rule`-divided rows — serif week numeral, title + taught date (figures), resource chips (icon + label, hairline, external), two session cells showing done-date or planned-date with a mark-done control.
  - Extras plate: optional single-session rows, unscheduled ("watch anytime").
- **TodayPage**: compact course card (next session + Mark done + link to `/aiml`) between daily progress and New Questions. Hidden only when core course + extras are all done.
- Dashboard intentionally untouched (scope control; Today is the "what do I do now" surface).

## Testing

Pinned-clock convention (`2026-07-30T12:00:00`) for anything date-dependent. New suites: engine math (ordering, schedule, projection, stats, extras semantics), thunk behavior (XP, ledger sync, idempotency, week-clear bonus + celebration, import/reset), persistence round-trip + validation (old-backup compatibility), page render + interactions, Today card. `shell.test.tsx` label list updated 10 → 11 deliberately.

## Scope absorbed from the follow-up "Engineering OS" brief (2026-07-31)

Aligned and shipped in this pass: per-week **markdown notes** (`CourseWeekProgress.notes` + autosaving editor dialog, mirroring the question NotesEditor), a **Dashboard course plate** (progress + next session + projected finish beside the DSA world), richer Day 1/Day 2 task descriptors, and the extensible string-id data model the brief asked for.

Shipped in follow-up passes the same day: **11 course achievements** (Course group, unlock toasts, `AchievementCtx.course` via optional param) and **week spaced repetition** — cleared core weeks enter the same 1/3/7/15/30 ladder as questions (reusing `REVISION_INTERVALS`/`MASTERED_STAGE`; stage 5 = retained, fail restarts, +10 XP per review through both registers). A review = re-derive the week from slides + notes and self-grade — no fabricated quiz content. `CourseWeekProgress` gained the revision fields; pre-ladder persisted entries are normalized at the load/import boundaries. Reviews surface on /aiml ("Review due" plate), the syllabus row meta, the Today card count, and the Dashboard plate.

Deliberately deferred (extension seams designed, not fabricated): flashcards/quizzes/interview banks (would require inventing lecture content), knowledge-graph page, global-search course results (SearchDialog is question-shaped; course lives on one scannable page), and heatmap/streak inclusion — course XP flows into the day ledger, but `hasActivity()` stays a DSA-practice metric so the locked streak spec is untouched. No artificial week-locking: the syllabus de-emphasizes done weeks and highlights the current one instead (no glow — design system).

## Alternatives considered

- **Fixed calendar schedule** (assign dates once from a start date) — rejected: falls "behind" the moment a day is missed; the app's DSA roadmap deliberately derives day-from-progress, course does the same.
- **Course weeks as pseudo-questions in the DSA dataset** — rejected: `questions.json` is generated and its 539/28 invariants are locked; a separate slice is the honest seam and matches the planned Supabase v2 adapter.
- **Extras excluded entirely** — rejected: they're on the site; tracked as optional single sessions outside the 52-session plan.
