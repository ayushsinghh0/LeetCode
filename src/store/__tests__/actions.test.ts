import questionsData from '@/data/questions.json';
import type { PersistedStateV1, Question } from '@/types';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { SOLVE_XP, DAILY_GOAL_BONUS, revisionXp } from '@/utils/engine/xp';
import { makeStore } from '@/store/store';
import {
  importProgress,
  reviseQuestion,
  resetProgress,
  setConfidence,
  solveQuestion,
} from '@/store/actions';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { celebrationShown } from '@/store/slices/uiSlice';
import { selectCurrentDay, selectSolvedNewCount, selectTodaysNewQuestions, selectHeatmapData } from '@/store/selectors';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

// Flow 1 -----------------------------------------------------------------------------------
test('solveQuestion(1): marks solved, logs today, awards easy XP', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  const state = store.getState();

  expect(state.progress.byId[1].status).toBe('solved');
  expect(state.progress.dayLogs[TODAY].solvedIds).toEqual([1]);
  expect(state.gamification.xp).toBe(10); // question 1 is easy
  expect(state.progress.startDate).toBe(TODAY); // set on first-ever solve
});

test('solving the same question twice the same day does not double-count XP', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  store.dispatch(solveQuestion(1));
  const state = store.getState();

  expect(state.progress.dayLogs[TODAY].solvedIds).toEqual([1]); // not [1, 1]
  expect(state.progress.dayLogs[TODAY].xpEarned).toBe(10);
  expect(state.gamification.xp).toBe(10);
});

// Flow 2 -----------------------------------------------------------------------------------
test('solving 8 questions awards the daily-goal bonus exactly once, with confetti', () => {
  const store = makeStore();
  for (let id = 1; id <= 8; id++) {
    store.dispatch(solveQuestion(id));
  }
  const rawXp = questions
    .slice(0, 8)
    .reduce((sum, q) => sum + SOLVE_XP[q.difficulty], 0);

  const stateAfter8 = store.getState();
  expect(stateAfter8.gamification.xp).toBe(rawXp + DAILY_GOAL_BONUS);
  expect(stateAfter8.ui.celebration).toBe('confetti');

  const xpAfter8 = stateAfter8.gamification.xp;
  store.dispatch(solveQuestion(9));
  const stateAfter9 = store.getState();

  // 9th solve must NOT re-award the daily-goal bonus.
  expect(stateAfter9.gamification.xp).toBe(xpAfter8 + SOLVE_XP[questions[8].difficulty]);
});

test('daily-goal bonus is credited into dayLog.xpEarned too, keeping the per-day sum in sync with gamification.xp', () => {
  const store = makeStore();
  for (let id = 1; id <= 8; id++) {
    store.dispatch(solveQuestion(id));
  }
  const state = store.getState();

  expect(state.gamification.xp).toBeGreaterThan(0); // sanity: DAILY_GOAL_BONUS was actually awarded
  expect(state.progress.dayLogs[TODAY].xpEarned).toBe(state.gamification.xp);
});

test('re-solving an already-solved-today question does not re-award the daily-goal bonus or re-fire celebration', () => {
  const store = makeStore();
  for (let id = 1; id <= 8; id++) {
    store.dispatch(solveQuestion(id));
  }
  const xpAfter8 = store.getState().gamification.xp; // includes DAILY_GOAL_BONUS exactly once
  expect(store.getState().ui.celebration).toBe('confetti');

  // Clear the celebration so we can tell whether the duplicate solve re-sets it.
  store.dispatch(celebrationShown(null));
  expect(store.getState().ui.celebration).toBeNull();

  // Re-dispatch for an id already solved today (still 8 distinct solvedIds -> still === perDay).
  store.dispatch(solveQuestion(1));
  const state = store.getState();

  expect(state.gamification.xp).toBe(xpAfter8); // unchanged: no second bonus, no base xp either
  expect(state.ui.celebration).toBeNull(); // not re-set by the duplicate dispatch
});

// Flow 2b (cross-day re-solve guard) --------------------------------------------------------
test('re-solving a question on a later day is a no-op: no XP, no new day-log entry, ladder untouched', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1)); // day 1: xp 10, nextRevision = 2026-07-31
  store.dispatch(reviseQuestion(1, true)); // climb the ladder: revisionStage 0 -> 1, xp += revisionXp('easy')

  const xpBefore = store.getState().gamification.xp;
  const progressBefore = store.getState().progress.byId[1];

  vi.setSystemTime(new Date('2026-07-31T12:00:00')); // move the clock a day forward
  const NEXT_DAY = '2026-07-31';

  store.dispatch(solveQuestion(1)); // re-solve on a later day
  const state = store.getState();

  expect(state.gamification.xp).toBe(xpBefore); // no XP re-award
  expect(state.progress.dayLogs[NEXT_DAY]).toBeUndefined(); // no dayLog created for the new day
  expect(state.progress.byId[1]).toEqual(progressBefore); // ladder/progress completely untouched
});

test('Need Revision on an already-solved question sets confidence only — no XP, no ladder reset', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  store.dispatch(reviseQuestion(1, true)); // revisionStage -> 1

  const xpBefore = store.getState().gamification.xp;
  const progressBefore = store.getState().progress.byId[1];

  // Mirrors the "Need Revision" UI action on an already-solved card: solveQuestion + setConfidence(id, 2).
  store.dispatch(solveQuestion(1));
  store.dispatch(setConfidence(1, 2));
  const state = store.getState();

  expect(state.gamification.xp).toBe(xpBefore); // solveQuestion no-ops: no XP
  expect(state.progress.byId[1]).toEqual({ ...progressBefore, confidence: 2 }); // only confidence changed
});

// Flow 3 -----------------------------------------------------------------------------------
test('reviseQuestion pass then fail: revisionStage transitions 1 then 0, XP each attempt', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1)); // xp 10, revisionStage reset to 0 by applySolve

  store.dispatch(reviseQuestion(1, true));
  let state = store.getState();
  expect(state.progress.byId[1].revisionStage).toBe(1);
  const xpAfterPass = state.gamification.xp;
  expect(xpAfterPass).toBe(10 + revisionXp('easy'));

  store.dispatch(reviseQuestion(1, false));
  state = store.getState();
  expect(state.progress.byId[1].revisionStage).toBe(0);
  expect(state.gamification.xp).toBe(xpAfterPass + revisionXp('easy'));
});

// Flow 4 -----------------------------------------------------------------------------------
test('achievements: solveQuestion(1) unlocks first-solve and queues a toast', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  const state = store.getState();

  expect(state.gamification.unlocked['first-solve']).toBe(TODAY);
  expect(state.ui.toastQueue).toContain('first-solve');
});

// Flow 5 -----------------------------------------------------------------------------------
test('resetProgress clears progress + gamification + toasts/celebration but keeps settings', () => {
  const store = makeStore();
  store.dispatch(solveQuestion(1));
  store.dispatch(settingsUpdated({ questionsPerDay: 5 }));

  expect(store.getState().gamification.unlocked['first-solve']).toBe(TODAY); // sanity: unlocked first

  store.dispatch(resetProgress());
  const state = store.getState();

  expect(state.progress.byId).toEqual({});
  expect(state.progress.dayLogs).toEqual({});
  expect(state.progress.startDate).toBeNull();
  expect(state.gamification.xp).toBe(0);
  expect(state.gamification.unlocked).toEqual({});
  expect(state.ui.celebration).toBeNull();
  expect(state.ui.toastQueue).toEqual([]);

  expect(state.settings.questionsPerDay).toBe(5); // settings survive
});

// Flow 6 -----------------------------------------------------------------------------------
test('importProgress replaces state wholesale', () => {
  const fixture: PersistedStateV1 = {
    version: 1,
    progress: {
      byId: {
        1: { ...initialProgress(), status: 'solved', completedAt: '2026-07-01', revisionStage: 2, nextRevision: '2026-07-10' },
        2: { ...initialProgress(), status: 'solved', completedAt: '2026-07-02' },
      },
      dayLogs: {
        '2026-07-01': { date: '2026-07-01', solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 10, focusMinutes: 0 },
        '2026-07-02': { date: '2026-07-02', solvedIds: [2], revisionsPassed: [], revisionsFailed: [], xpEarned: 20, focusMinutes: 0 },
      },
      startDate: '2026-07-01',
    },
    settings: { questionsPerDay: 10, revisionEnabled: false, theme: 'light', notifications: true },
    gamification: { xp: 999, unlocked: { 'first-solve': '2026-07-01' } },
  };

  const store = makeStore();
  store.dispatch(solveQuestion(3)); // pre-existing state that must be fully replaced
  store.dispatch(importProgress(fixture));
  const state = store.getState();

  expect(state.progress.byId).toEqual(fixture.progress.byId);
  expect(state.progress.dayLogs).toEqual(fixture.progress.dayLogs);
  expect(state.progress.startDate).toBe('2026-07-01');
  expect(state.settings).toEqual(fixture.settings);
  expect(state.gamification).toEqual(fixture.gamification);

  expect(selectSolvedNewCount(state)).toBe(2);
});

// Flow 7 -----------------------------------------------------------------------------------
test('selectors: selectCurrentDay advances, selectTodaysNewQuestions/selectHeatmapData follow', () => {
  const store = makeStore();
  expect(selectCurrentDay(store.getState())).toBe(1);

  for (let id = 1; id <= 8; id++) {
    store.dispatch(solveQuestion(id));
  }

  const state = store.getState();
  expect(selectCurrentDay(state)).toBe(2);

  const day2Questions = selectTodaysNewQuestions(state);
  expect(day2Questions.map((q) => q.id)).toEqual(questions.slice(8, 16).map((q) => q.id));

  const heatmap = selectHeatmapData(state, TODAY);
  expect(heatmap).toHaveLength(365);
  expect(heatmap[heatmap.length - 1].date).toBe(TODAY);
  expect(heatmap[heatmap.length - 1].count).toBe(8);
});
