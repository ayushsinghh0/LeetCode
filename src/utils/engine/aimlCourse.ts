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
import { MASTERED_STAGE, REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';

// Course XP register (deliberately NOT in xp.ts, which is the locked DSA spec):
// a session is a solid evening of work → medium-solve XP; clearing a week matches
// the existing weekly-clear bonus register; a review is half a session, mirroring
// the revisionXp = solve/2 rule.
export const COURSE_SESSION_XP = 20;
export const COURSE_WEEK_CLEAR_BONUS = 50;
export const COURSE_REVIEW_XP = 10;

export type CourseDay = 1 | 2;

export interface CourseSession {
  weekId: string;
  day: CourseDay;
}

export function initialCourseProgress(): CourseWeekProgress {
  return {
    day1DoneOn: null,
    day2DoneOn: null,
    notes: '',
    revisionStage: 0,
    nextRevision: null,
    lastReviewed: null,
    revisionHistory: [],
  };
}

// Fills fields missing from pre-ladder persisted entries (first course release stored only
// day stamps + notes). The boundary layers (loadInitialState, stateImported) run every entry
// through this so in-memory state always carries the full shape.
export function normalizeCourseWeekProgress(raw: Partial<CourseWeekProgress>): CourseWeekProgress {
  return { ...initialCourseProgress(), ...raw };
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

// --- Review ladder (cleared core weeks only) -------------------------------------------------
// Same intervals and stage arithmetic as questions/spacedRepetition, applied to a week: a
// review means re-deriving the week from its slides and notes, then grading yourself.

export function applyCourseWeekClear(p: CourseWeekProgress, date: string): CourseWeekProgress {
  return { ...p, revisionStage: 0, nextRevision: addDays(date, REVISION_INTERVALS[0]) };
}

export function applyCourseReview(
  p: CourseWeekProgress,
  date: string,
  passed: boolean,
): CourseWeekProgress {
  const history = [...p.revisionHistory, { date, passed }];
  if (!passed) {
    return { ...p, revisionStage: 0, nextRevision: addDays(date, 1), lastReviewed: date, revisionHistory: history };
  }
  const stage = p.revisionStage + 1;
  return {
    ...p,
    revisionStage: stage,
    lastReviewed: date,
    revisionHistory: history,
    nextRevision: stage >= MASTERED_STAGE ? null : addDays(date, REVISION_INTERVALS[stage]),
  };
}

export const isWeekRetained = (p: CourseWeekProgress): boolean => p.revisionStage >= MASTERED_STAGE;

// Cleared, unretained core weeks whose review date has arrived — ordered by review date,
// then course order. Extras never enter the ladder.
export function dueCourseReviewWeekIds(
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
  today: string,
): string[] {
  return weeks
    .map((week, order) => ({ week, order, progress: progressFor(byWeekId, week.id) }))
    .filter(
      ({ week, progress }) =>
        !week.optional &&
        isWeekDone(week, progress) &&
        !isWeekRetained(progress) &&
        progress.nextRevision !== null &&
        progress.nextRevision <= today,
    )
    .sort((a, b) =>
      a.progress.nextRevision! < b.progress.nextRevision! ? -1 :
      a.progress.nextRevision! > b.progress.nextRevision! ? 1 : a.order - b.order,
    )
    .map(({ week }) => week.id);
}

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
