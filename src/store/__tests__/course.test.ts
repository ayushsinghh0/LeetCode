import { makeStore } from '@/store/store';
import {
  completeCourseSession,
  reviseCourseWeek,
  saveCourseNotes,
  importProgress,
  resetProgress,
} from '@/store/actions';
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
    expect(state.course.byWeekId.w00!.day1DoneOn).toBe('2026-07-30');
    expect(state.course.byWeekId.w00!.day2DoneOn).toBeNull();
    expect(state.gamification.xp).toBe(20);
    // Ledger invariant: Σ dayLogs[*].xpEarned tracks gamification.xp.
    expect(state.progress.dayLogs['2026-07-30']!.xpEarned).toBe(20);
    // Course work never writes into the DSA ledger arrays…
    expect(state.progress.dayLogs['2026-07-30']!.solvedIds).toEqual([]);
    // …yet the day still counts as unified activity: the streak starts.
    expect(selectStreaks(state, '2026-07-30').current).toBe(1);
  });

  test('is idempotent per session', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 1));

    expect(store.getState().gamification.xp).toBe(20);
    expect(store.getState().progress.dayLogs['2026-07-30']!.xpEarned).toBe(20);
  });

  test('completing both sessions of a core week adds the 50 XP clear bonus and confetti', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));

    expect(store.getState().gamification.xp).toBe(20 + 20 + 50);
    expect(store.getState().progress.dayLogs['2026-07-30']!.xpEarned).toBe(90);
    expect(store.getState().ui.celebration).toBe('confetti');
  });

  test('clearing a core week enters the review ladder: first review due tomorrow', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));

    expect(store.getState().course.byWeekId.w00!.revisionStage).toBe(0);
    expect(store.getState().course.byWeekId.w00!.nextRevision).toBe('2026-07-31');
    // Extras never enter the ladder.
    store.dispatch(completeCourseSession('x-memory-1', 1));
    expect(store.getState().course.byWeekId['x-memory-1']!.nextRevision).toBeNull();
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

    expect(store.getState().course.byWeekId['x-memory-1']!.day1DoneOn).toBe('2026-07-30');
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

describe('reviseCourseWeek', () => {
  test('a pass climbs the ladder and earns 10 XP through both registers', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));
    const xpAfterClear = store.getState().gamification.xp;

    store.dispatch(reviseCourseWeek('w00', true));

    const p = store.getState().course.byWeekId.w00!;
    expect(p.revisionStage).toBe(1);
    expect(p.nextRevision).toBe('2026-08-02'); // today + 3
    expect(p.revisionHistory).toEqual([{ date: '2026-07-30', passed: true }]);
    expect(store.getState().gamification.xp).toBe(xpAfterClear + 10);
    expect(store.getState().progress.dayLogs['2026-07-30']!.xpEarned).toBe(xpAfterClear + 10);
    // Reviews live in course revisionHistory, never in the DSA ledger arrays.
    expect(store.getState().progress.dayLogs['2026-07-30']!.revisionsPassed).toEqual([]);
  });

  test('course activity alone extends the streak; a review can unlock streak achievements', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1)); // 2026-07-30
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(completeCourseSession('w00', 2)); // clears the week, review due tomorrow
    vi.setSystemTime(new Date('2026-08-01T12:00:00'));
    store.dispatch(reviseCourseWeek('w00', true));

    expect(selectStreaks(store.getState(), '2026-08-01')).toEqual({ current: 3, longest: 3 });
    expect(store.getState().gamification.unlocked['streak-3']).toBe('2026-08-01');
  });

  test('a fail restarts the ladder, due tomorrow', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));

    store.dispatch(reviseCourseWeek('w00', false));

    expect(store.getState().course.byWeekId.w00!.revisionStage).toBe(0);
    expect(store.getState().course.byWeekId.w00!.nextRevision).toBe('2026-07-31');
  });

  test('no-ops on uncleared weeks, extras, and unknown ids', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1)); // half done
    const xpBefore = store.getState().gamification.xp;

    store.dispatch(reviseCourseWeek('w00', true));
    store.dispatch(reviseCourseWeek('x-memory-1', true));
    store.dispatch(reviseCourseWeek('nope', true));

    expect(store.getState().gamification.xp).toBe(xpBefore);
    expect(store.getState().course.byWeekId.w00!.revisionHistory).toEqual([]);
  });
});

describe('saveCourseNotes', () => {
  test('saves markdown notes without awarding XP', () => {
    const store = makeStore();
    store.dispatch(saveCourseNotes('w03', '## attention is all you need'));

    expect(store.getState().course.byWeekId.w03!.notes).toBe('## attention is all you need');
    expect(store.getState().course.byWeekId.w03!.day1DoneOn).toBeNull();
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
  test('stateImported restores course progress (normalizing pre-ladder entries), empty when the backup predates it', () => {
    const store = makeStore();
    // Pre-ladder backup entry: day stamps + notes only — the import path must fill the
    // revision fields in.
    const legacyEntry = { day1DoneOn: '2026-07-01', day2DoneOn: null, notes: 'hi' };
    // Pre-ladder CLEARED week: both days stamped but no review schedule — normalization must
    // seed the ladder (due day-2 + 1) or the week could never become reviewable.
    const legacyCleared = { day1DoneOn: '2026-07-01', day2DoneOn: '2026-07-02', notes: '' };
    store.dispatch(
      importProgress({
        ...basePersisted(),
        course: { byWeekId: { w05: legacyEntry as never, w06: legacyCleared as never } },
      }),
    );
    expect(store.getState().course.byWeekId.w05!.notes).toBe('hi');
    expect(store.getState().course.byWeekId.w05!.revisionStage).toBe(0);
    expect(store.getState().course.byWeekId.w05!.revisionHistory).toEqual([]);
    expect(store.getState().course.byWeekId.w05!.nextRevision).toBeNull(); // half-done: no backfill
    expect(store.getState().course.byWeekId.w06!.nextRevision).toBe('2026-07-03');

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
