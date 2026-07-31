import type { CourseWeekProgress } from '@/types';
import { COURSE_WEEKS, courseWeekById } from '@/data/aimlCourse';
import {
  COURSE_SESSION_XP,
  COURSE_WEEK_CLEAR_BONUS,
  courseSchedule,
  courseSessions,
  courseStats,
  initialCourseProgress,
  isSessionDone,
  isWeekDone,
  nextSession,
  projectedFinish,
  remainingSessions,
  sessionCount,
} from '@/utils/engine/aimlCourse';

const done = (day1: string | null, day2: string | null): CourseWeekProgress => ({
  day1DoneOn: day1,
  day2DoneOn: day2,
  notes: '',
});

// Marks every core session done; extras untouched.
const allCoreDone = (): Record<string, CourseWeekProgress> => {
  const byWeekId: Record<string, CourseWeekProgress> = {};
  for (const w of COURSE_WEEKS) {
    if (!w.optional) byWeekId[w.id] = done('2026-07-01', '2026-07-02');
  }
  return byWeekId;
};

test('XP register: 20 per session, 50 per cleared week', () => {
  expect(COURSE_SESSION_XP).toBe(20);
  expect(COURSE_WEEK_CLEAR_BONUS).toBe(50);
});

test('initialCourseProgress starts both sessions unfinished with empty notes', () => {
  expect(initialCourseProgress()).toEqual({ day1DoneOn: null, day2DoneOn: null, notes: '' });
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
