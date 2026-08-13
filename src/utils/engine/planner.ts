// What a piece of work costs, and how to print a duration.
//
// The estimates are deliberately explicit constants rather than fabricated precision: a course
// session is the two-day sprint's evening block, a task without a user estimate gets a small
// default. Every total is rendered with a leading "~" for exactly this reason.
//
// The plan-building that used to live here moved to engine/nextAction.ts when the day's work
// became one ranked list — `rankWork` + `buildSession` replaced `buildDailyPlan`, which is why
// only the cost model and the formatter remain.
import type { Question } from '@/types';

/** Fallback only: the mean-of-the-ladder figure is preferred wherever the ladder is available. */
export const REVISION_MINUTES = 8;
export const COURSE_SESSION_MINUTES = 60;
export const COURSE_REVIEW_MINUTES = 10;
export const DEFAULT_TASK_MINUTES = 15;

// A revision is a re-derive, not a re-solve — roughly a third of the first attempt. Derived from
// the question's own calibrated estimate rather than one flat constant, because "revise Two Sum"
// and "revise Burst Balloons" are not the same eight minutes. Clamped so the arithmetic can
// never produce an estimate too small to be worth showing or long enough to distort a plan.
export const REVISION_FRACTION = 0.35;
export const MIN_REVISION_MINUTES = 5;
export const MAX_REVISION_MINUTES = 20;

export function revisionMinutes(question: Question): number {
  const raw = Math.round(question.estimatedTime * REVISION_FRACTION);
  return Math.min(MAX_REVISION_MINUTES, Math.max(MIN_REVISION_MINUTES, raw));
}

// "2h 05m" / "45m" — the plan's one time format.
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}
