import { makeStore } from '@/store/store';
import { completeCourseSession, saveCourseNotes, importProgress, resetProgress } from '@/store/actions';
import {
  selectCourseNextSession,
  selectCourseProjectedFinish,
  selectCourseStats,
  selectStreaks,
} from '@/store/selectors';
import type { PersistedStateV1 } from '@/types';

// Thunks read todayISO() — pin the clock like every other date-dependent suite.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

const basePersisted = (): PersistedStateV1 => ({
  version: 1,
  progress: { byId: {}, dayLogs: {}, startDate: null },
  settings: { questionsPerDay: 8, revisionEnabled: true, theme: 'dark', notifications: false },
  gamification: { xp: 0, unlocked: {} },
});

describe('completeCourseSession', () => {
  test('stamps the session date, awards 20 XP, and logs it into the day ledger', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));

    const state = store.getState();
    expect(state.course.byWeekId.w00.day1DoneOn).toBe('2026-07-30');
    expect(state.course.byWeekId.w00.day2DoneOn).toBeNull();
    expect(state.gamification.xp).toBe(20);
    // Ledger invariant: Σ dayLogs[*].xpEarned tracks gamification.xp.
    expect(state.progress.dayLogs['2026-07-30'].xpEarned).toBe(20);
    // …but with no solve/revision arrays touched, so course work never fakes a streak day.
    expect(state.progress.dayLogs['2026-07-30'].solvedIds).toEqual([]);
    expect(selectStreaks(state, '2026-07-30').current).toBe(0);
  });

  test('is idempotent per session', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 1));

    expect(store.getState().gamification.xp).toBe(20);
    expect(store.getState().progress.dayLogs['2026-07-30'].xpEarned).toBe(20);
  });

  test('completing both sessions of a core week adds the 50 XP clear bonus and confetti', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));

    expect(store.getState().gamification.xp).toBe(20 + 20 + 50);
    expect(store.getState().progress.dayLogs['2026-07-30'].xpEarned).toBe(90);
    expect(store.getState().ui.celebration).toBe('confetti');
  });

  test('course milestones unlock achievements and queue their toasts', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));

    expect(store.getState().gamification.unlocked['course-first-session']).toBe('2026-07-30');
    expect(store.getState().ui.toastQueue).toContain('course-first-session');

    store.dispatch(completeCourseSession('w00', 2));
    expect(store.getState().gamification.unlocked['course-first-week']).toBe('2026-07-30');
  });

  test('extras are single-session: 20 XP, no clear bonus, no celebration', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('x-memory-1', 1));

    expect(store.getState().course.byWeekId['x-memory-1'].day1DoneOn).toBe('2026-07-30');
    expect(store.getState().gamification.xp).toBe(20);
    expect(store.getState().ui.celebration).toBeNull();
  });

  test('unknown week ids and day 2 on an extra are no-ops', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('nope', 1));
    store.dispatch(completeCourseSession('x-memory-1', 2));

    expect(store.getState().gamification.xp).toBe(0);
    expect(store.getState().course.byWeekId).toEqual({});
  });
});

describe('saveCourseNotes', () => {
  test('saves markdown notes without awarding XP', () => {
    const store = makeStore();
    store.dispatch(saveCourseNotes('w03', '## attention is all you need'));

    expect(store.getState().course.byWeekId.w03.notes).toBe('## attention is all you need');
    expect(store.getState().course.byWeekId.w03.day1DoneOn).toBeNull();
    expect(store.getState().gamification.xp).toBe(0);
  });
});

describe('course selectors', () => {
  test('stats, next session and projection move as sessions complete', () => {
    const store = makeStore();
    expect(selectCourseStats(store.getState()).sessionsDone).toBe(0);
    expect(selectCourseNextSession(store.getState())).toEqual({ weekId: 'w00', day: 1 });
    expect(selectCourseProjectedFinish(store.getState(), '2026-07-30')).toBe('2026-09-19'); // 52 sessions

    store.dispatch(completeCourseSession('w00', 1));
    expect(selectCourseStats(store.getState()).sessionsDone).toBe(1);
    expect(selectCourseNextSession(store.getState())).toEqual({ weekId: 'w00', day: 2 });
    expect(selectCourseProjectedFinish(store.getState(), '2026-07-30')).toBe('2026-09-18');
  });
});

describe('course import/reset lifecycle', () => {
  test('stateImported restores course progress, and defaults to empty when the backup predates it', () => {
    const store = makeStore();
    store.dispatch(
      importProgress({
        ...basePersisted(),
        course: { byWeekId: { w05: { day1DoneOn: '2026-07-01', day2DoneOn: null, notes: 'hi' } } },
      }),
    );
    expect(store.getState().course.byWeekId.w05.notes).toBe('hi');

    store.dispatch(importProgress(basePersisted())); // old backup, no course key
    expect(store.getState().course.byWeekId).toEqual({});
  });

  test('progressReset clears course progress', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(resetProgress());

    expect(store.getState().course.byWeekId).toEqual({});
  });
});
