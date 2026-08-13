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

/**
 * Bounds on `settings.dailyCapacityMin`, the one time budget.
 *
 * They live in this leaf module because TWO layers must agree on them and neither can import the
 * other: `setDailyCapacity` (store/actions.ts) guards writes, and `validatePersisted`
 * (services/storage/serialize.ts) guards reloads. They once disagreed — the validator floored at
 * 30 while the Today and Revision chips wrote 15 — so tapping the smallest chip persisted a value
 * the next load rejected, quarantining the learner's entire state. A validator stricter than the
 * UI is a data-loss bug; keeping the numbers in one place is what makes that impossible to
 * reintroduce.
 */
export const CAPACITY_MIN = 15;
export const CAPACITY_MAX = 960;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A projected date, formatted for a learner.
 *
 * A projection printed as a bare "MMM d" is a trap: a date in another year loses the only thing
 * that placed it, so an estimate of 27 May 2027 reads as a day that has already been and gone.
 * The year appears exactly when it is load-bearing — when the estimate leaves the current one.
 *
 * It lives here, next to the other plan arithmetic, because three surfaces state a projected
 * finish (the Dashboard's roadmap and course figures, and Analytics' course figure) and a helper
 * that only one of them uses is a helper the other two will drift away from.
 */
export function formatProjection(iso: string, today: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const base = `${MONTHS[month - 1]} ${day}`;
  return year === Number(today.slice(0, 4)) ? base : `${base}, ${year}`;
}

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
