import questionsData from '@/data/questions.json';
import type { DayLog, PersistedStateV1, Question, QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { patternStats, difficultyStats, productivityScore } from '@/utils/engine/stats';
import { computeStreaks } from '@/utils/engine/streak';
import { levelProgress } from '@/utils/engine/xp';
import { combinedRevisionLoadForecast, revisionLoadForecast } from '@/utils/engine/predictor';
import { COURSE_WEEKS } from '@/data/aimlCourse';
import { weeklyTopUp } from '@/utils/engine/weeklyRevision';
import { buildAchievementCtx } from '@/utils/engine/achievements';
import { makeStore } from '@/store/store';
import { completeCourseSession, importProgress, solveQuestion } from '@/store/actions';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import {
  selectAchievementCtx,
  selectBookmarkedIds,
  selectCurrentDay,
  selectDifficultyStats,
  selectDueRevisionIds,
  selectForecast,
  selectHeatmapData,
  selectIsWeeklyDay,
  selectLevelInfo,
  selectPatternStats,
  selectPerDay,
  selectProductivityScore,
  selectQuestionById,
  selectQuestions,
  selectRevisionQueueIds,
  selectSolvedNewCount,
  selectStreaks,
  selectTodayLog,
  selectTodaysNewQuestions,
  selectTotalDays,
  selectWeeklyTopUpIds,
} from '@/store/selectors';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function progressFixture(overrides: Partial<QuestionProgress> = {}): QuestionProgress {
  return { ...initialProgress(), ...overrides };
}

function importFixture(
  store: ReturnType<typeof makeStore>,
  byId: Record<number, QuestionProgress>,
  dayLogs: Record<string, DayLog> = {},
): void {
  const fixture: PersistedStateV1 = {
    version: 1,
    progress: { byId, dayLogs, startDate: null },
    settings: { questionsPerDay: 8, revisionEnabled: true, theme: 'dark', notifications: false },
    gamification: { xp: 0, unlocked: {} },
  };
  store.dispatch(importProgress(fixture));
}

// --- Static dataset helpers ----------------------------------------------------------------

test('selectQuestions returns the static dataset by identity', () => {
  const store = makeStore();
  const a = selectQuestions();
  const b = selectQuestions();
  expect(a).toBe(b);
  expect(a).toHaveLength(539);
  void store;
});

test('selectQuestionById looks up by id, undefined for unknown ids', () => {
  expect(selectQuestionById(1)?.title).toBe('Valid Palindrome');
  expect(selectQuestionById(999999)).toBeUndefined();
});

// --- Roadmap progression ----------------------------------------------------------------

test('roadmap selectors on a fresh store: day 1, 68 total days', () => {
  const store = makeStore();
  const state = store.getState();

  expect(selectPerDay(state)).toBe(8);
  expect(selectTotalDays(state)).toBe(Math.ceil(539 / 8));
  expect(selectSolvedNewCount(state)).toBe(0);
  expect(selectCurrentDay(state)).toBe(1);
  expect(selectTodaysNewQuestions(state).map((q) => q.id)).toEqual(
    questions.slice(0, 8).map((q) => q.id),
  );
});

test('selectCurrentDay/selectTodaysNewQuestions advance to day 2 after 8 solves', () => {
  const store = makeStore();
  for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
  const state = store.getState();

  expect(selectSolvedNewCount(state)).toBe(8);
  expect(selectCurrentDay(state)).toBe(2);
  expect(selectTodaysNewQuestions(state).map((q) => q.id)).toEqual(
    questions.slice(8, 16).map((q) => q.id),
  );
});

// --- Revision queue ----------------------------------------------------------------------

test('selectDueRevisionIds returns only items whose nextRevision has arrived', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29' }), // due
    2: progressFixture({ status: 'solved', completedAt: '2026-07-02', nextRevision: '2026-08-01' }), // not due yet
  });
  const state = store.getState();

  expect(selectDueRevisionIds(state, TODAY)).toEqual([1]);
});

test('selectRevisionQueueIds is [] when revisionEnabled is false, even with due items', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29' }),
  });
  store.dispatch(settingsUpdated({ revisionEnabled: false }));
  const state = store.getState();

  expect(selectDueRevisionIds(state, TODAY)).toEqual([1]); // still due
  expect(selectRevisionQueueIds(state, TODAY)).toEqual([]); // but queue respects the toggle
});

test('selectRevisionQueueIds on a non-weekly day is exactly the due ids (no top-up)', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29' }),
  });
  const state = store.getState();

  expect(selectIsWeeklyDay(state)).toBe(false); // day 1
  expect(selectRevisionQueueIds(state, TODAY)).toEqual(selectDueRevisionIds(state, TODAY));
});

test('selectWeeklyTopUpIds/selectRevisionQueueIds on a weekly day delegate to the engine', () => {
  const store = makeStore();
  const byId: Record<number, QuestionProgress> = {};
  // 46 filler solves (non-due, non-mastered) + 2 due -> solvedNewCount 48 -> currentDay 7 (weekly).
  for (let id = 1; id <= 46; id++) {
    byId[id] = progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-08-15' });
  }
  byId[47] = progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-20' });
  byId[48] = progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-20' });
  importFixture(store, byId);
  const state = store.getState();

  expect(selectSolvedNewCount(state)).toBe(48);
  expect(selectCurrentDay(state)).toBe(7);
  expect(selectIsWeeklyDay(state)).toBe(true);

  const due = selectDueRevisionIds(state, TODAY);
  expect(due.sort()).toEqual([47, 48]);

  const expectedTopUp = weeklyTopUp(questions, state.progress.byId, due, TODAY);
  expect(selectWeeklyTopUpIds(state, TODAY)).toEqual(expectedTopUp);
  expect(selectRevisionQueueIds(state, TODAY)).toEqual([...due, ...expectedTopUp]);
});

// --- Stats / gamification -----------------------------------------------------------------

test('selectPatternStats/selectDifficultyStats delegate to the stats engine', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', confidence: 4 }),
    2: progressFixture({ status: 'solved', completedAt: '2026-07-02', confidence: 2 }),
  });
  const state = store.getState();

  expect(selectPatternStats(state)).toEqual(patternStats(questions, state.progress.byId));
  expect(selectDifficultyStats(state)).toEqual(difficultyStats(questions, state.progress.byId));
});

test('selectStreaks delegates to the streak engine', () => {
  const store = makeStore();
  importFixture(
    store,
    {},
    {
      '2026-07-30': { date: '2026-07-30', solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 10, focusMinutes: 0 },
      '2026-07-29': { date: '2026-07-29', solvedIds: [2], revisionsPassed: [], revisionsFailed: [], xpEarned: 20, focusMinutes: 0 },
    },
  );
  const state = store.getState();

  expect(selectStreaks(state, TODAY)).toEqual(computeStreaks(state.progress.dayLogs, TODAY));
  expect(selectStreaks(state, TODAY)).toEqual({ current: 2, longest: 2 });
});

test('selectLevelInfo delegates to levelProgress', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1)); // 10 xp
  const state = store.getState();

  expect(selectLevelInfo(state)).toEqual(levelProgress(state.gamification.xp));
});

test('selectBookmarkedIds returns only bookmarked ids', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ bookmarked: true }),
    2: progressFixture({ bookmarked: false }),
    3: progressFixture({ bookmarked: true }),
  });
  const state = store.getState();

  expect(selectBookmarkedIds(state)).toEqual([1, 3]);
});

test('selectTodayLog returns the log for the given date, or undefined', () => {
  const store = makeStore();
  importFixture(
    store,
    {},
    { [TODAY]: { date: TODAY, solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 10, focusMinutes: 0 } },
  );
  const state = store.getState();

  expect(selectTodayLog(state, TODAY)?.solvedIds).toEqual([1]);
  expect(selectTodayLog(state, '2026-01-01')).toBeUndefined();
});

test('selectAchievementCtx delegates to buildAchievementCtx', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  const state = store.getState();

  expect(selectAchievementCtx(state, TODAY)).toEqual(
    buildAchievementCtx(questions, state.progress.byId, state.progress.dayLogs, TODAY),
  );
});

test('selectProductivityScore/selectForecast delegate correctly', () => {
  const store = makeStore();
  importFixture(store, {
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29', confidence: 3 }),
  });
  const state = store.getState();

  expect(selectProductivityScore(state, TODAY)).toBe(
    productivityScore(state.progress.dayLogs, state.progress.byId, selectPerDay(state), TODAY),
  );

  // With no course progress, the merged forecast collapses to the question-only series.
  expect(selectForecast(state, TODAY)).toEqual(revisionLoadForecast(state.progress.byId, TODAY));
});

test('selectForecast counts course-week reviews alongside question revisions', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));                // question review due tomorrow
  store.dispatch(completeCourseSession('w00', 1));
  store.dispatch(completeCourseSession('w00', 2)); // week cleared -> review due tomorrow
  const state = store.getState();

  const forecast = selectForecast(state, TODAY);
  expect(forecast).toEqual(
    combinedRevisionLoadForecast(state.progress.byId, COURSE_WEEKS, state.course.byWeekId, TODAY),
  );
  // Both tracks land tomorrow: one question revision + one course review.
  expect(forecast[0]).toEqual({ date: addDays(TODAY, 1), count: 2 });
});

// --- Heatmap -------------------------------------------------------------------------------

test('selectHeatmapData returns 365 entries with correct counts and level thresholds', () => {
  const store = makeStore();
  const dayLogs: Record<string, DayLog> = {};
  // offset -> solved+revision count for that day; expected level per the 0/1-2/3-5/6-8/>8 bands.
  const countsByOffset: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 8, 7: 9 };
  const expectedLevelByOffset: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4 };
  const dateForOffset: Record<number, string> = {};

  for (const offsetStr of Object.keys(countsByOffset)) {
    const offset = Number(offsetStr);
    dateForOffset[offset] = addDays(TODAY, -offset);
  }
  for (const [offsetStr, count] of Object.entries(countsByOffset)) {
    const iso = dateForOffset[Number(offsetStr)]!;
    dayLogs[iso] = {
      date: iso,
      solvedIds: Array.from({ length: count }, (_, i) => i + 1),
      revisionsPassed: [],
      revisionsFailed: [],
      xpEarned: 0,
      focusMinutes: 0,
    };
  }
  importFixture(store, {}, dayLogs);
  const state = store.getState();

  const heatmap = selectHeatmapData(state, TODAY);
  expect(heatmap).toHaveLength(365);
  expect(heatmap[heatmap.length - 1]!.date).toBe(TODAY);
  expect(heatmap[0]!.date).toBe(addDays(TODAY, -364));

  const byDate = new Map(heatmap.map((h) => [h.date, h]));
  for (const offset of Object.keys(countsByOffset).map(Number)) {
    const entry = byDate.get(dateForOffset[offset]!);
    expect(entry?.count).toBe(countsByOffset[offset]);
    expect(entry?.level).toBe(expectedLevelByOffset[offset]);
  }

  const noActivityEntry = byDate.get('2026-01-01');
  expect(noActivityEntry).toEqual({ date: '2026-01-01', count: 0, level: 0 });
});

// --- Memoization ----------------------------------------------------------------------------

test('selectPatternStats is memoized: same state reference => same result reference', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  const state1 = store.getState();

  const a = selectPatternStats(state1);
  const b = selectPatternStats(state1);
  expect(a).toBe(b); // identical state -> cached result, no recompute

  store.dispatch(solveQuestion(2));
  const state2 = store.getState();
  const c = selectPatternStats(state2);
  expect(c).not.toBe(a); // progress changed -> recomputed
});
