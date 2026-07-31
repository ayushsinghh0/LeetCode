// Every selector here is a thin, memoized wrapper around the pure engine layer — no engine
// logic is reimplemented. Selectors never read the system clock: any that need "today" take it
// as an explicit second argument, `(state, today)`, so results stay deterministic and
// memoizable. Call sites (UI, thunks) supply `todayISO()` themselves.
import { createSelector } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { DayLog, Question, QuestionProgress } from '@/types';
import type { RootState } from '@/store/store';
import { addDays } from '@/utils/dates';
import { dueIds } from '@/utils/engine/spacedRepetition';
import { currentDay, daySlice, isWeeklyRevisionDay, totalDays, estimatedFinishDate } from '@/utils/engine/roadmap';
import { computeStreaks } from '@/utils/engine/streak';
import { levelProgress } from '@/utils/engine/xp';
import { difficultyStats, patternStats, productivityScore } from '@/utils/engine/stats';
import { buildAchievementCtx } from '@/utils/engine/achievements';
import { weakestPatterns } from '@/utils/engine/recommendations';
import { revisionLoadForecast } from '@/utils/engine/predictor';
import { weeklyTopUp } from '@/utils/engine/weeklyRevision';
import { COURSE_WEEKS } from '@/data/aimlCourse';
import {
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

export const selectWeeklyTopUpIds = createSelector(
  [selectProgressById, selectDueRevisionIds, selectTodayArg],
  (byId, due, today) => weeklyTopUp(questions, byId, due, today),
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

export const selectStreaks = createSelector([selectDayLogs, selectTodayArg], (dayLogs, today) =>
  computeStreaks(dayLogs, today),
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
  [selectDayLogs, selectTodayArg],
  (dayLogs, today): { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] => {
    const days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    for (let i = 364; i >= 0; i--) {
      const date = addDays(today, -i);
      const log = dayLogs[date];
      const count = log ? log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length : 0;
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

export const selectForecast = createSelector(
  [selectProgressById, selectTodayArg],
  (byId, today) => revisionLoadForecast(byId, today),
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

const selectCourseByWeekId = (state: RootState): Record<string, CourseWeekProgress> =>
  state.course.byWeekId;

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
