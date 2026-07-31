// Pure schedule/stats math for the AI/ML course track. Same contract as every other engine
// module: no React/Redux imports, no clock access — callers pass ISO `yyyy-MM-dd` strings and
// the sparse `byWeekId` map (missing entries fall back to initialCourseProgress()).
//
// Pacing model: one core week-module per two sessions (day 1 lecture, day 2 practice), one
// session per calendar day. Like the DSA roadmap's currentDay, the plan derives from progress —
// remaining sessions always re-map onto consecutive days starting today, so there is no
// "behind". Optional extras are single-session and live outside the plan.
import type { CourseWeekProgress } from '@/types';
import type { CourseWeek } from '@/data/aimlCourse';
import { addDays } from '@/utils/dates';

// Course XP register (deliberately NOT in xp.ts, which is the locked DSA spec):
// a session is a solid evening of work → medium-solve XP; clearing a week matches
// the existing weekly-clear bonus register.
export const COURSE_SESSION_XP = 20;
export const COURSE_WEEK_CLEAR_BONUS = 50;

export type CourseDay = 1 | 2;

export interface CourseSession {
  weekId: string;
  day: CourseDay;
}

export function initialCourseProgress(): CourseWeekProgress {
  return { day1DoneOn: null, day2DoneOn: null, notes: '' };
}

export function sessionCount(week: CourseWeek): 1 | 2 {
  return week.optional ? 1 : 2;
}

export function isSessionDone(progress: CourseWeekProgress, day: CourseDay): boolean {
  return (day === 1 ? progress.day1DoneOn : progress.day2DoneOn) !== null;
}

export function isWeekDone(week: CourseWeek, progress: CourseWeekProgress): boolean {
  return week.optional
    ? progress.day1DoneOn !== null
    : progress.day1DoneOn !== null && progress.day2DoneOn !== null;
}

const progressFor = (
  byWeekId: Record<string, CourseWeekProgress>,
  weekId: string,
): CourseWeekProgress => byWeekId[weekId] ?? initialCourseProgress();

// All 52 core sessions in course order: w00·d1, w00·d2, w01·d1, … Extras excluded.
export function courseSessions(weeks: CourseWeek[]): CourseSession[] {
  return weeks
    .filter((w) => !w.optional)
    .flatMap((w): CourseSession[] => [{ weekId: w.id, day: 1 }, { weekId: w.id, day: 2 }]);
}

export function remainingSessions(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
): CourseSession[] {
  return courseSessions(weeks).filter((s) => !isSessionDone(progressFor(byWeekId, s.weekId), s.day));
}

export function completedCoreSessionCount(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
): number {
  return courseSessions(weeks).length - remainingSessions(weeks, byWeekId).length;
}

export function nextSession(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
): CourseSession | null {
  return remainingSessions(weeks, byWeekId)[0] ?? null;
}

export interface WeekSchedule {
  day1: string | null; // planned ISO date; null once the session is done
  day2: string | null;
}

// Maps every remaining core session onto consecutive calendar days starting `today`.
export function courseSchedule(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
  today: string,
): Record<string, WeekSchedule> {
  const schedule: Record<string, WeekSchedule> = {};
  for (const w of weeks) {
    if (!w.optional) schedule[w.id] = { day1: null, day2: null };
  }

  remainingSessions(weeks, byWeekId).forEach((s, i) => {
    const planned = addDays(today, i);
    if (s.day === 1) schedule[s.weekId].day1 = planned;
    else schedule[s.weekId].day2 = planned;
  });

  return schedule;
}

export function projectedFinish(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
  today: string,
): string | null {
  const remaining = remainingSessions(weeks, byWeekId).length;
  return remaining === 0 ? null : addDays(today, remaining - 1);
}

export interface CourseStats {
  weeksTotal: number;
  weeksDone: number;
  sessionsTotal: number;
  sessionsDone: number;
  pct: number; // core sessions done, rounded percent
  extrasTotal: number;
  extrasDone: number;
}

export function courseStats(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
): CourseStats {
  const core = weeks.filter((w) => !w.optional);
  const extras = weeks.filter((w) => w.optional);

  const sessionsTotal = core.length * 2;
  const sessionsDone = completedCoreSessionCount(weeks, byWeekId);

  return {
    weeksTotal: core.length,
    weeksDone: core.filter((w) => isWeekDone(w, progressFor(byWeekId, w.id))).length,
    sessionsTotal,
    sessionsDone,
    pct: sessionsTotal === 0 ? 0 : Math.round((sessionsDone / sessionsTotal) * 100),
    extrasTotal: extras.length,
    extrasDone: extras.filter((w) => isWeekDone(w, progressFor(byWeekId, w.id))).length,
  };
}
