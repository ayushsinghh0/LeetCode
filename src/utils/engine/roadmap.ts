import type { DayLog, Question } from '@/types';
import { addDays, diffDays } from '@/utils/dates';

export function totalDays(totalQuestions: number, perDay: number): number {
  return Math.ceil(totalQuestions / perDay);
}

export function daySlice(all: Question[], day: number, perDay: number): Question[] {
  const start = (day - 1) * perDay;
  return all.slice(start, start + perDay);
}

export function dayOfQuestion(id: number, perDay: number): number {
  return Math.ceil(id / perDay);
}

export function currentDay(solvedNewCount: number, perDay: number, totalQuestions: number): number {
  const day = Math.floor(solvedNewCount / perDay) + 1;
  return Math.min(day, totalDays(totalQuestions, perDay));
}

export function isWeeklyRevisionDay(day: number): boolean {
  return day > 0 && day % 7 === 0;
}

/** The trailing window a measured pace is read from. */
const PACE_WINDOW_DAYS = 14;
/** Fewer active days than this in the window is a sample, not a rate. */
const MIN_ACTIVE_DAYS = 3;
/** Floor on the divisor, so a near-stalled learner gets a far date rather than Infinity. */
const MIN_PACE = 0.5;

/**
 * How many days the trailing window actually covers *for this learner*: `windowDays` once they
 * have been at it that long, fewer while they are new.
 *
 * Dividing by a flat 14 is what put "Est. finish" ten months out for someone on day 3 of perfect
 * adherence — 24 solves in three days read as 1.71/day instead of 8/day, under a header saying
 * "Day 4 of 68". The origin is `progress.startDate` when the caller has it, and otherwise the
 * earliest day log, which is stamped by the same first solve that sets `startDate` — so the
 * denominator is honest on both call paths rather than only the one that happens to pass it.
 */
function observedDays(
  dayLogs: Record<string, DayLog>, today: string, windowDays: number, startDate?: string | null
): number {
  let origin = startDate ?? null;
  if (origin === null) {
    for (const log of Object.values(dayLogs)) {
      if (origin === null || log.date < origin) origin = log.date;
    }
  }
  if (origin === null) return windowDays;
  const elapsed = diffDays(today, origin) + 1; // inclusive of both the first day and today
  return Math.min(windowDays, Math.max(1, elapsed));
}

/** Solves per day over the trailing window, divided by the days the learner has actually had. */
export function solvePace(
  dayLogs: Record<string, DayLog>, today: string, windowDays = PACE_WINDOW_DAYS,
  startDate?: string | null,
): number {
  let count = 0;
  for (const log of Object.values(dayLogs)) {
    const delta = diffDays(today, log.date); // today - log.date
    if (delta >= 0 && delta < windowDays) {
      count += log.solvedIds.length;
    }
  }
  return count / observedDays(dayLogs, today, windowDays, startDate);
}

/**
 * Where the projected finish date came from — the UI must not label a figure it did not measure.
 *
 * - `measured` — the learner's own solve rate over the trailing window ("at your current pace").
 * - `target`   — the questions-per-day *setting*, because there is not enough history yet
 *                ("at your target pace"). This is a plan, not an observation, and saying
 *                "current pace" over it was a claim about a learner who had not solved anything.
 * - `complete` — nothing remaining, so there is no estimate at all and the surface shows none.
 */
export type FinishBasis = 'measured' | 'target' | 'complete';

export interface FinishProjection {
  /** `null` exactly when `basis === 'complete'` — today's date is not an estimate. */
  date: string | null;
  basis: FinishBasis;
  /** Solves per day the date was derived from; 0 when there is nothing left to project. */
  pace: number;
}

export function finishProjection(
  today: string, remaining: number, dayLogs: Record<string, DayLog>, perDay: number,
  startDate?: string | null,
): FinishProjection {
  if (remaining <= 0) return { date: null, basis: 'complete', pace: 0 };

  let activeDays = 0;
  for (const log of Object.values(dayLogs)) {
    const delta = diffDays(today, log.date);
    if (delta >= 0 && delta < PACE_WINDOW_DAYS && log.solvedIds.length >= 1) {
      activeDays += 1;
    }
  }
  const measured = activeDays >= MIN_ACTIVE_DAYS;
  const raw = measured ? solvePace(dayLogs, today, PACE_WINDOW_DAYS, startDate) : perDay;
  const pace = Math.max(raw, MIN_PACE);

  return {
    date: addDays(today, Math.ceil(remaining / pace)),
    basis: measured ? 'measured' : 'target',
    pace,
  };
}

/** Date-only view of {@link finishProjection}, for callers that cannot show the basis. */
export function estimatedFinishDate(
  today: string, remaining: number, dayLogs: Record<string, DayLog>, perDay: number,
  startDate?: string | null,
): string {
  return finishProjection(today, remaining, dayLogs, perDay, startDate).date ?? today;
}
