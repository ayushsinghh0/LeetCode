import type { CourseWeekProgress } from '@/types';
import { COURSE_WEEKS, courseWeekById } from '@/data/aimlCourse';
import {
  COURSE_REVIEW_XP,
  COURSE_SESSION_XP,
  COURSE_WEEK_CLEAR_BONUS,
  applyCourseReview,
  applyCourseWeekClear,
  courseSchedule,
  courseSessions,
  courseStats,
  dueCourseReviewWeekIds,
  initialCourseProgress,
  isSessionDone,
  isWeekDone,
  isWeekRetained,
  nextSession,
  normalizeCourseWeekProgress,
  projectedFinish,
  remainingSessions,
  sessionCount,
} from '@/utils/engine/aimlCourse';

const done = (day1: string | null, day2: string | null): CourseWeekProgress => ({
  ...initialCourseProgress(),
  day1DoneOn: day1,
  day2DoneOn: day2,
});

// Marks every core session done; extras untouched.
const allCoreDone = (): Record<string, CourseWeekProgress> => {
  const byWeekId: Record<string, CourseWeekProgress> = {};
  for (const w of COURSE_WEEKS) {
    if (!w.optional) byWeekId[w.id] = done('2026-07-01', '2026-07-02');
  }
  return byWeekId;
};

test('XP register: 20 per session, 50 per cleared week, 10 per review', () => {
  expect(COURSE_SESSION_XP).toBe(20);
  expect(COURSE_WEEK_CLEAR_BONUS).toBe(50);
  expect(COURSE_REVIEW_XP).toBe(10);
});

test('initialCourseProgress starts unfinished, unreviewed, with empty notes', () => {
  expect(initialCourseProgress()).toEqual({
    day1DoneOn: null,
    day2DoneOn: null,
    notes: '',
    revisionStage: 0,
    nextRevision: null,
    lastReviewed: null,
    revisionHistory: [],
  });
});

test('courseSessions: 52 core sessions in week order, day 1 before day 2, extras excluded', () => {
  const sessions = courseSessions(COURSE_WEEKS);
  expect(sessions).toHaveLength(52);
  expect(sessions[0]).toEqual({ weekId: 'w00', day: 1 });
  expect(sessions[1]).toEqual({ weekId: 'w00', day: 2 });
  expect(sessions[2]).toEqual({ weekId: 'w01', day: 1 });
  expect(sessions[51]).toEqual({ weekId: 'w26', day: 2 });
  expect(sessions.some((s) => s.weekId.startsWith('x-'))).toBe(false);
});

test('sessionCount: extras are single-session, core weeks are two', () => {
  expect(sessionCount(courseWeekById.get('w00')!)).toBe(2);
  expect(sessionCount(courseWeekById.get('x-memory-1')!)).toBe(1);
});

test('isSessionDone / isWeekDone, including single-session extras', () => {
  expect(isSessionDone(done('2026-07-30', null), 1)).toBe(true);
  expect(isSessionDone(done('2026-07-30', null), 2)).toBe(false);

  const core = courseWeekById.get('w03')!;
  expect(isWeekDone(core, done('2026-07-30', null))).toBe(false);
  expect(isWeekDone(core, done('2026-07-30', '2026-07-31'))).toBe(true);

  const extra = courseWeekById.get('x-agents-1')!;
  expect(isWeekDone(extra, done('2026-07-30', null))).toBe(true);
});

test('nextSession walks day 1 → day 2 → next week, with sparse progress', () => {
  expect(nextSession(COURSE_WEEKS, {})).toEqual({ weekId: 'w00', day: 1 });
  expect(nextSession(COURSE_WEEKS, { w00: done('2026-07-30', null) })).toEqual({ weekId: 'w00', day: 2 });
  expect(nextSession(COURSE_WEEKS, { w00: done('2026-07-30', '2026-07-30') })).toEqual({ weekId: 'w01', day: 1 });
  expect(nextSession(COURSE_WEEKS, allCoreDone())).toBeNull();
});

test('out-of-order completion: earlier unfinished weeks still come first', () => {
  const byWeekId = { w05: done('2026-07-01', '2026-07-02') };
  expect(nextSession(COURSE_WEEKS, byWeekId)).toEqual({ weekId: 'w00', day: 1 });
  expect(remainingSessions(COURSE_WEEKS, byWeekId)).toHaveLength(50);
  expect(remainingSessions(COURSE_WEEKS, byWeekId).some((s) => s.weekId === 'w05')).toBe(false);
});

test('courseSchedule maps remaining sessions onto consecutive days starting today', () => {
  const fresh = courseSchedule(COURSE_WEEKS, {}, '2026-07-31');
  expect(fresh.w00).toEqual({ day1: '2026-07-31', day2: '2026-08-01' });
  expect(fresh.w01).toEqual({ day1: '2026-08-02', day2: '2026-08-03' });
  expect(fresh.w26).toEqual({ day1: '2026-09-19', day2: '2026-09-20' });

  // Completing week 0 pulls everything forward — the plan always restarts from today.
  const after = courseSchedule(COURSE_WEEKS, { w00: done('2026-07-31', '2026-07-31') }, '2026-08-01');
  expect(after.w00).toEqual({ day1: null, day2: null });
  expect(after.w01).toEqual({ day1: '2026-08-01', day2: '2026-08-02' });
});

test('projectedFinish is the planned date of the last remaining session, null when done', () => {
  expect(projectedFinish(COURSE_WEEKS, {}, '2026-07-31')).toBe('2026-09-20'); // today + 51
  expect(projectedFinish(COURSE_WEEKS, allCoreDone(), '2026-07-31')).toBeNull();

  const oneLeft = allCoreDone();
  oneLeft.w26 = done('2026-07-01', null);
  expect(projectedFinish(COURSE_WEEKS, oneLeft, '2026-07-31')).toBe('2026-07-31');
});

test('applyCourseWeekClear schedules the first review one day out, same ladder as questions', () => {
  const cleared = applyCourseWeekClear(done('2026-07-29', '2026-07-30'), '2026-07-30');
  expect(cleared.revisionStage).toBe(0);
  expect(cleared.nextRevision).toBe('2026-07-31');
});

test('applyCourseReview walks the 1/3/7/15/30 ladder to retained, and a fail restarts it', () => {
  let p = applyCourseWeekClear(done('2026-07-29', '2026-07-30'), '2026-07-30');

  p = applyCourseReview(p, '2026-07-31', true); // stage 1 → +3d
  expect(p.revisionStage).toBe(1);
  expect(p.nextRevision).toBe('2026-08-03');
  expect(p.lastReviewed).toBe('2026-07-31');
  expect(p.revisionHistory).toEqual([{ date: '2026-07-31', passed: true }]);

  p = applyCourseReview(p, '2026-08-03', true); // stage 2 → +7d
  expect(p.nextRevision).toBe('2026-08-10');
  p = applyCourseReview(p, '2026-08-10', true); // stage 3 → +15d
  expect(p.nextRevision).toBe('2026-08-25');
  p = applyCourseReview(p, '2026-08-25', true); // stage 4 → +30d
  expect(p.nextRevision).toBe('2026-09-24');

  p = applyCourseReview(p, '2026-09-24', true); // stage 5 → retained
  expect(isWeekRetained(p)).toBe(true);
  expect(p.nextRevision).toBeNull();

  const failed = applyCourseReview(
    { ...done('2026-07-29', '2026-07-30'), revisionStage: 3, nextRevision: '2026-08-25' },
    '2026-08-25',
    false,
  );
  expect(failed.revisionStage).toBe(0);
  expect(failed.nextRevision).toBe('2026-08-26'); // due tomorrow
});

test('dueCourseReviewWeekIds: only cleared, unretained core weeks whose review date has arrived', () => {
  const clearedDue = applyCourseWeekClear(done('2026-07-28', '2026-07-29'), '2026-07-29'); // due 07-30
  const clearedLater = applyCourseWeekClear(done('2026-07-29', '2026-07-30'), '2026-07-30'); // due 07-31
  const retained = { ...done('2026-07-01', '2026-07-02'), revisionStage: 5, nextRevision: null };
  const halfDone = done('2026-07-30', null);

  const byWeekId: Record<string, CourseWeekProgress> = {
    w05: clearedDue,
    w00: clearedLater,
    w02: retained,
    w03: halfDone,
    // extras never enter the ladder, even with hand-edited fields
    'x-memory-1': { ...done('2026-07-01', null), nextRevision: '2026-07-01' },
  };

  expect(dueCourseReviewWeekIds(COURSE_WEEKS, byWeekId, '2026-07-30')).toEqual(['w05']);
  // Next day both are due — ordered by review date, then course order.
  expect(dueCourseReviewWeekIds(COURSE_WEEKS, byWeekId, '2026-07-31')).toEqual(['w05', 'w00']);
  expect(dueCourseReviewWeekIds(COURSE_WEEKS, {}, '2026-07-31')).toEqual([]);
});

test('normalizeCourseWeekProgress fills revision fields missing from pre-ladder entries', () => {
  const legacy = { day1DoneOn: '2026-07-30', day2DoneOn: null, notes: 'hi' };
  expect(normalizeCourseWeekProgress(legacy)).toEqual({
    ...initialCourseProgress(),
    day1DoneOn: '2026-07-30',
    notes: 'hi',
  });
});

test('courseStats counts core sessions/weeks and extras separately', () => {
  expect(courseStats(COURSE_WEEKS, {})).toEqual({
    weeksTotal: 26, weeksDone: 0, sessionsTotal: 52, sessionsDone: 0, pct: 0,
    extrasTotal: 5, extrasDone: 0,
  });

  const mixed = {
    w00: done('2026-07-30', '2026-07-31'),
    w01: done('2026-07-31', null),
    'x-memory-1': done('2026-07-31', null),
  };
  const stats = courseStats(COURSE_WEEKS, mixed);
  expect(stats.weeksDone).toBe(1);
  expect(stats.sessionsDone).toBe(3);
  expect(stats.pct).toBe(Math.round((3 / 52) * 100));
  expect(stats.extrasDone).toBe(1); // extras never count toward core sessions

  const finished = courseStats(COURSE_WEEKS, allCoreDone());
  expect(finished.weeksDone).toBe(26);
  expect(finished.sessionsDone).toBe(52);
  expect(finished.pct).toBe(100);
});
