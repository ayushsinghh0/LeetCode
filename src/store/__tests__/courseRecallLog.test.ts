// Wave F: the "Check yourself" recall dialog records a self-test result per week, first-attempt-
// per-date (drills precedent), and that result counts as a review for courseRetention.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeStore } from '@/store/store';
import { logCourseRecall } from '@/store/actions';
import { initialCourseProgress } from '@/utils/engine/aimlCourse';
import { courseRetention } from '@/utils/engine/insights';
import type { CourseWeekProgress } from '@/types';

const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('logCourseRecall', () => {
  test('records a self-check for today, keyed by date', () => {
    const store = makeStore();
    store.dispatch(logCourseRecall('w00', 3, 5));
    expect(store.getState().course.byWeekId['w00']!.recallChecks![TODAY]).toEqual({ correct: 3, total: 5 });
  });

  test('the first attempt of a date is the signal — a same-day rerun does not overwrite it', () => {
    const store = makeStore();
    store.dispatch(logCourseRecall('w00', 5, 5)); // a best-of-N would be tempting, and dishonest
    store.dispatch(logCourseRecall('w00', 1, 5));
    expect(store.getState().course.byWeekId['w00']!.recallChecks![TODAY]).toEqual({ correct: 5, total: 5 });
  });

  test('an unknown week id is a no-op', () => {
    const store = makeStore();
    store.dispatch(logCourseRecall('not-a-week', 3, 5));
    expect(store.getState().course.byWeekId['not-a-week']).toBeUndefined();
  });

  test('correct is clamped to [0, total]; a zero-prompt check records nothing', () => {
    const store = makeStore();
    store.dispatch(logCourseRecall('w00', 9, 5));
    expect(store.getState().course.byWeekId['w00']!.recallChecks![TODAY]!.correct).toBe(5);

    const store2 = makeStore();
    store2.dispatch(logCourseRecall('w01', 0, 0));
    expect(store2.getState().course.byWeekId['w01']).toBeUndefined();
  });
});

describe('courseRetention counts a recall check as a review', () => {
  const clearedWeek = (extra: Partial<CourseWeekProgress> = {}): CourseWeekProgress => ({
    ...initialCourseProgress(),
    day1DoneOn: '2026-07-01',
    day2DoneOn: '2026-07-02',
    revisionStage: 1,
    nextRevision: '2026-08-15',
    ...extra,
  });

  test('a cleared week with only a recall check is no longer "never reviewed"', () => {
    const r = courseRetention({
      w00: clearedWeek({ recallChecks: { '2026-07-10': { correct: 4, total: 5 } } }),
    });
    expect(r.onLadder).toBe(1);
    expect(r.neverReviewed).toBe(0);
  });

  test('a cleared week with neither a formal review nor a recall check is never reviewed', () => {
    expect(courseRetention({ w00: clearedWeek() }).neverReviewed).toBe(1);
  });
});
