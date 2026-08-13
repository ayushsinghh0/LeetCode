// Every selector here is a thin, memoized wrapper around the pure engine layer — no engine
// logic is reimplemented. Selectors never read the system clock: any that need "today" take it
// as an explicit second argument, `(state, today)`, so results stay deterministic and
// memoizable. Call sites (UI, thunks) supply `todayISO()` themselves.
import { createSelector } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { DayLog, PatternId, Question, QuestionProgress } from '@/types';
import type { RootState } from '@/store/store';
import { PATTERNS } from '@/data/patterns';
import { addDays, diffDays } from '@/utils/dates';
import { dueIds, REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';
import { estimateFor, paceSamples, plannedMinutes } from '@/utils/engine/timeEstimate';
import { DRILL_MIN_SOLVED, rankWork, type WorkItem } from '@/utils/engine/nextAction';
import { DRILL_MINUTES } from '@/utils/engine/drills';
import { selectMostMissedPatterns } from '@/store/slices/drillsSlice';
import {
  COURSE_REVIEW_MINUTES,
  COURSE_SESSION_MINUTES,
  DEFAULT_TASK_MINUTES,
  REVISION_MINUTES,
  revisionMinutes,
} from '@/utils/engine/planner';
import { buildInsights } from '@/utils/engine/insights';
import { courseWeekById } from '@/data/aimlCourse';
import { currentDay, daySlice, isWeeklyRevisionDay, totalDays, estimatedFinishDate } from '@/utils/engine/roadmap';
import { computeStreaks, hasActivity } from '@/utils/engine/streak';
import { levelProgress } from '@/utils/engine/xp';
import { difficultyStats, patternStats, productivityScore } from '@/utils/engine/stats';
import { buildAchievementCtx } from '@/utils/engine/achievements';
import { weakestPatterns } from '@/utils/engine/recommendations';
import { combinedRevisionLoadForecast } from '@/utils/engine/predictor';
import { weeklyTopUp } from '@/utils/engine/weeklyRevision';
import { COURSE_WEEKS } from '@/data/aimlCourse';
import {
  courseActivityByDate,
  courseSchedule,
  courseStats,
  dueCourseReviewWeekIds,
  nextSession,
  projectedFinish,
} from '@/utils/engine/aimlCourse';
import type { CourseWeekProgress } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// --- Static dataset helpers (no store dependency — identity of the static import) -----------

export const selectQuestions = (): Question[] => questions;

export const selectQuestionById = (id: number): Question | undefined => questionById.get(id);

// --- Base (non-memoized) field accessors, reused as createSelector inputs -------------------

const selectProgressById = (state: RootState): Record<number, QuestionProgress> => state.progress.byId;
const selectDayLogs = (state: RootState): Record<string, DayLog> => state.progress.dayLogs;
const selectRevisionEnabled = (state: RootState): boolean => state.settings.revisionEnabled;
const selectXp = (state: RootState): number => state.gamification.xp;
const selectTodayArg = (_state: RootState, today: string): string => today;
const selectCourseByWeekId = (state: RootState): Record<string, CourseWeekProgress> =>
  state.course.byWeekId;

// Course work per date (sessions + graded reviews), derived from byWeekId. Every activity
// surface (streaks, heatmap, calendar) merges this in so a course-only day counts like a
// solving day.
export const selectCourseActivityByDate = createSelector([selectCourseByWeekId], (byWeekId) =>
  courseActivityByDate(byWeekId),
);

export const selectCourseActiveDates = createSelector(
  [selectCourseActivityByDate],
  (activity): ReadonlySet<string> => new Set(activity.keys()),
);

export const selectPerDay = (state: RootState): number => state.settings.questionsPerDay;

// --- Roadmap progression ----------------------------------------------------------------

export const selectSolvedNewCount = createSelector([selectProgressById], (byId): number =>
  Object.values(byId).filter((p) => p.status === 'solved').length,
);

export const selectTotalDays = createSelector([selectPerDay], (perDay) =>
  totalDays(questions.length, perDay),
);

export const selectCurrentDay = createSelector(
  [selectSolvedNewCount, selectPerDay],
  (solvedNewCount, perDay) => currentDay(solvedNewCount, perDay, questions.length),
);

// Full day-slice (8 questions) for the current day, including ones already solved today — the
// UI is responsible for rendering those as completed cards.
export const selectTodaysNewQuestions = createSelector(
  [selectCurrentDay, selectPerDay],
  (day, perDay) => daySlice(questions, day, perDay),
);

export const selectIsWeeklyDay = createSelector([selectCurrentDay], (day) =>
  isWeeklyRevisionDay(day),
);

// --- Revision queue ----------------------------------------------------------------------

export const selectDueRevisionIds = createSelector(
  [selectProgressById, selectTodayArg],
  (byId, today) => dueIds(byId, today),
);

// Gated on the weekly day here (not just at the queue-assembly step below) so the 539-question
// pool scan never runs on the six days out of seven whose result would be discarded anyway.
export const selectWeeklyTopUpIds = createSelector(
  [selectIsWeeklyDay, selectProgressById, selectDueRevisionIds, selectTodayArg],
  (isWeekly, byId, due, today): number[] => (isWeekly ? weeklyTopUp(questions, byId, due, today) : []),
);

// Due items every day; on weekly-revision days, due + weekly top-up extras. [] whenever
// revision is disabled in settings.
export const selectRevisionQueueIds = createSelector(
  [selectRevisionEnabled, selectIsWeeklyDay, selectDueRevisionIds, selectWeeklyTopUpIds],
  (enabled, isWeekly, due, topUp): number[] => {
    if (!enabled) return [];
    return isWeekly ? [...due, ...topUp] : due;
  },
);

// --- Stats / gamification -----------------------------------------------------------------

export const selectPatternStats = createSelector([selectProgressById], (byId) =>
  patternStats(questions, byId),
);

export const selectDifficultyStats = createSelector([selectProgressById], (byId) =>
  difficultyStats(questions, byId),
);

export const selectStreaks = createSelector(
  [selectDayLogs, selectTodayArg, selectCourseActiveDates],
  (dayLogs, today, courseActiveDates) => computeStreaks(dayLogs, today, courseActiveDates),
);

export const selectLevelInfo = createSelector([selectXp], (xp) => levelProgress(xp));

function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

// Last 365 days ending today (oldest first).
export const selectHeatmapData = createSelector(
  [selectDayLogs, selectTodayArg, selectCourseActivityByDate],
  (dayLogs, today, courseActivity): { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] => {
    const days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    for (let i = 364; i >= 0; i--) {
      const date = addDays(today, -i);
      const log = dayLogs[date];
      const dsaCount = log ? log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length : 0;
      const count = dsaCount + (courseActivity.get(date) ?? 0);
      days.push({ date, count, level: heatmapLevel(count) });
    }
    return days;
  },
);

export const selectEstimatedFinish = createSelector(
  [selectDayLogs, selectPerDay, selectSolvedNewCount, selectTodayArg],
  (dayLogs, perDay, solvedNewCount, today) =>
    estimatedFinishDate(today, questions.length - solvedNewCount, dayLogs, perDay),
);

export const selectProductivityScore = createSelector(
  [selectDayLogs, selectProgressById, selectPerDay, selectTodayArg],
  (dayLogs, byId, perDay, today) => productivityScore(dayLogs, byId, perDay, today),
);

export const selectWeakestPatterns = createSelector([selectPatternStats], (stats) =>
  weakestPatterns(stats),
);

// Course weeks climb the same 1/3/7/15/30 ladder as questions, so the load forecast counts
// both tracks in one series.
export const selectForecast = createSelector(
  [selectProgressById, selectCourseByWeekId, selectTodayArg],
  (byId, byWeekId, today) => combinedRevisionLoadForecast(byId, COURSE_WEEKS, byWeekId, today),
);

export const selectBookmarkedIds = createSelector([selectProgressById], (byId): number[] =>
  Object.entries(byId)
    .filter(([, p]) => p.bookmarked)
    .map(([id]) => Number(id)),
);

export const selectTodayLog = createSelector(
  [selectDayLogs, selectTodayArg],
  (dayLogs, today): DayLog | undefined => dayLogs[today],
);

// --- AI/ML course track -------------------------------------------------------------------

export const selectAchievementCtx = createSelector(
  [selectProgressById, selectDayLogs, selectTodayArg, selectCourseByWeekId],
  (byId, dayLogs, today, courseByWeekId) =>
    buildAchievementCtx(questions, byId, dayLogs, today, courseByWeekId),
);

export const selectCourseStats = createSelector([selectCourseByWeekId], (byWeekId) =>
  courseStats(COURSE_WEEKS, byWeekId),
);

export const selectCourseNextSession = createSelector([selectCourseByWeekId], (byWeekId) =>
  nextSession(COURSE_WEEKS, byWeekId),
);

export const selectCourseSchedule = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => courseSchedule(COURSE_WEEKS, byWeekId, today),
);

export const selectCourseProjectedFinish = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => projectedFinish(COURSE_WEEKS, byWeekId, today),
);

export const selectCourseDueReviewIds = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => dueCourseReviewWeekIds(COURSE_WEEKS, byWeekId, today),
);

/** Whether a course session was already marked done today — the track's one-a-day cadence. */
export const selectCourseSessionDoneToday = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today): boolean =>
    Object.values(byWeekId).some((w) => w.day1DoneOn === today || w.day2DoneOn === today),
);

// --- Time intelligence --------------------------------------------------------------------

// Every usable pace measurement, computed once for the whole app rather than per question —
// a question list would otherwise rescan the entire history for each row it renders.
export const selectPaceSamples = createSelector([selectProgressById], (byId) =>
  paceSamples(questions, byId),
);

/** The estimate for one question, personalized when the history supports it. */
export const selectTimeEstimate = createSelector(
  [selectPaceSamples, (_state: RootState, question: Question) => question],
  (samples, question) => estimateFor(question, samples),
);

// --- What to do next ----------------------------------------------------------------------

const selectDrillsByDate = (state: RootState) => state.drills.byDate;
const selectTasksById = (state: RootState) => state.tasks.byId;

/**
 * The whole day's work, ranked — the single source both the "next best action" hero and the
 * "I have N minutes" session planner read from.
 *
 * Everything the ranker needs is assembled here rather than inside it: the engine stays pure
 * and clock-free, and the joins against the static dataset happen once, memoized.
 */
export const selectRankedWork = createSelector(
  [
    selectRevisionQueueIds,
    selectProgressById,
    selectTodaysNewQuestions,
    selectPaceSamples,
    selectDrillsByDate,
    selectMostMissedPatterns,
    selectCourseDueReviewIds,
    selectCourseNextSession,
    selectTasksById,
    selectSolvedNewCount,
    selectDayLogs,
    selectPerDay,
    selectCourseSessionDoneToday,
    selectTodayArg,
  ],
  (
    revisionIds,
    byId,
    todaysNew,
    samples,
    drillsByDate,
    mostMissed,
    courseDueReviewIds,
    courseNext,
    tasksById,
    solvedNewCount,
    dayLogs,
    perDay,
    courseSessionDoneToday,
    today,
  ): WorkItem[] => {
    const revisions = revisionIds
      .map((id) => {
        const question = questionById.get(id);
        const progress = byId[id];
        if (!question || !progress) return null;
        const daysPastDue = progress.nextRevision ? diffDays(today, progress.nextRevision) : 0;
        return {
          question,
          overdueDays: Math.max(0, daysPastDue),
          intervalDays: REVISION_INTERVALS[progress.revisionStage] ?? REVISION_INTERVALS[0],
          minutes: revisionMinutes(question),
          // A weekly-revision-day top-up is scheduled in the FUTURE (negative days-past-due).
          // Flagged rather than clamped-and-forgotten, so the ranker can give it a reason that
          // is true instead of announcing a ladder step that has not arrived.
          topUp: daysPastDue < 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // `currentDay` derives from the solved count, so finishing today's slice immediately
    // advances the roadmap and exposes the NEXT day's questions. Left uncapped, the plan would
    // refill the instant it was emptied and the day could never be finished — a treadmill with
    // no completion moment, which is the single most demotivating shape a daily surface can
    // have. The allowance closes it: once the day's goal is met, further questions are
    // available on the roadmap as explicitly optional work, not as unfinished business.
    // Counted against ALL of today's solves, matching the daily goal the rest of the app shows.
    // Scoping it to today's slice instead does not work: `currentDay` derives from the solved
    // count, so the moment the slice is finished `todaysNew` becomes the NEXT slice, a
    // slice-scoped allowance resets to full, and the plan refills — the treadmill this cap
    // exists to close.
    //
    // Known interaction with the locked roadmap spec: solving out of order (e.g. from a company
    // practice set) advances `currentDay` past questions that were never shown here, and they do
    // not return to Today. That is inherent to `currentDay = f(solvedCount)` over static id
    // ranges, not to this cap — /roadmap remains the surface that shows every question, and
    // Today links to it for exactly this reason.
    const solvedToday = dayLogs[today]?.solvedIds.length ?? 0;
    const remainingAllowance = Math.max(0, perDay - solvedToday);
    const newQuestions = todaysNew
      .filter((q) => {
        const status = byId[q.id]?.status ?? 'unsolved';
        return status !== 'solved' && status !== 'skipped';
      })
      .slice(0, remainingAllowance)
      .map((question) => ({ question, minutes: plannedMinutes(estimateFor(question, samples)) }));

    const weakest = mostMissed[0]?.pattern as PatternId | undefined;

    return rankWork({
      revisions,
      newQuestions,
      drill: {
        eligible: solvedNewCount >= DRILL_MIN_SOLVED,
        doneToday: drillsByDate[today] !== undefined,
        weakestPattern: weakest ?? null,
        weakestPatternName: weakest ? (PATTERNS.find((p) => p.id === weakest)?.name ?? null) : null,
        minutes: DRILL_MINUTES,
      },
      course: {
        dueReviews: courseDueReviewIds.map((weekId) => ({
          weekId,
          title: courseWeekById.get(weekId)?.title ?? weekId,
          minutes: COURSE_REVIEW_MINUTES,
        })),
        // The course is paced one session a day (day 1 lecture, day 2 practice, on consecutive
        // days). Once today's session is done, `nextSession` still reports the following one —
        // suggesting it here would push the learner a day ahead of the cadence and, because
        // there is always a next week, would keep the day's plan permanently non-empty.
        nextSession: courseNext && !courseSessionDoneToday
          ? {
              weekId: courseNext.weekId,
              title: `${courseWeekById.get(courseNext.weekId)?.title ?? courseNext.weekId} · Day ${courseNext.day}`,
              minutes: COURSE_SESSION_MINUTES,
            }
          : null,
      },
      openTasks: Object.values(tasksById).filter((t) => t.date === today && !t.done),
      taskDefaultMinutes: DEFAULT_TASK_MINUTES,
    });
  },
);

// --- Decision-support analytics ------------------------------------------------------------

/**
 * Mean `revisionMinutes` across the questions currently on the review ladder.
 *
 * The revision-load forecast is a count of reviews per day, so converting it to time needs one
 * representative figure. Deriving it from the learner's own ladder keeps the analytics surface
 * and the session plan quoting compatible numbers; the flat constant is only the empty-ladder
 * fallback.
 */
function meanRevisionMinutes(byId: Record<number, QuestionProgress>): number {
  let total = 0;
  let count = 0;
  for (const [id, progress] of Object.entries(byId)) {
    if (progress.status !== 'solved' || progress.nextRevision === null) continue;
    const question = questionById.get(Number(id));
    if (!question) continue;
    total += revisionMinutes(question);
    count += 1;
  }
  return count === 0 ? REVISION_MINUTES : Math.round(total / count);
}

/**
 * The findings the current evidence actually supports, most actionable first.
 *
 * Returns [] freely: each builder in the insights engine states its own minimum sample and
 * declines below it, so an early-days learner correctly gets nothing rather than a confident
 * reading of four data points.
 */
export const selectInsights = createSelector(
  [
    selectProgressById,
    selectDayLogs,
    selectDrillsByDate,
    selectPatternStats,
    selectForecast,
    (state: RootState) => state.settings.dailyCapacityMin,
    selectCourseActiveDates,
    selectTodayArg,
  ],
  (byId, dayLogs, drills, patternStatsList, forecast, capacityMin, courseActiveDates, today) =>
    buildInsights(
      {
        today,
        all: questions,
        byId,
        dayLogs,
        drills,
        patternStats: patternStatsList,
        forecast,
        capacityMin,
        // The mean cost of the reviews actually on this learner's ladder — not the flat
        // REVISION_MINUTES fallback. The forecast counts reviews, not questions, so a single
        // figure is unavoidable here; it must at least be the same figure the session plan
        // would arrive at, or the schedule-risk card quotes minutes the plan contradicts.
        revisionMinutes: meanRevisionMinutes(byId),
      },
      courseActiveDates,
    ),
);

/** Whether anything is left on today's plan — the "done for today" signal. */
export const selectDayCleared = createSelector([selectRankedWork], (work) => work.length === 0);

/**
 * Days since the last day with any activity on either track, or null for a learner who has never
 * been active. Drives the return experience: coming back after a gap should be met with a
 * fresh-start frame and a rebalanced plan, not a pile of overdue debt.
 */
export const selectDaysAway = createSelector(
  [selectDayLogs, selectCourseActiveDates, selectTodayArg],
  (dayLogs, courseDates, today): number | null => {
    let last: string | null = null;
    for (const log of Object.values(dayLogs)) {
      if (log.date < today && hasActivity(log) && (last === null || log.date > last)) last = log.date;
    }
    for (const date of courseDates) {
      if (date < today && (last === null || date > last)) last = date;
    }
    return last === null ? null : diffDays(today, last);
  },
);
