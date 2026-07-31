import type { DayLog } from '@/types';
import { addDays, diffDays } from '@/utils/dates';

export function hasActivity(log: DayLog | undefined): boolean {
  return !!log && (log.solvedIds.length > 0 || log.revisionsPassed.length > 0 || log.revisionsFailed.length > 0);
}

export function isPerfectDay(log: DayLog | undefined, perDay: number): boolean {
  return !!log && log.solvedIds.length >= perDay;
}

// `extraActiveDates` lets callers count activity that lives outside dayLogs — today that is
// AI/ML course sessions and reviews, derived per-date by courseActivityByDate. A day counts
// toward the streak when either track saw work.
export function computeStreaks(
  dayLogs: Record<string, DayLog>, today: string, extraActiveDates?: ReadonlySet<string>
): { current: number; longest: number } {
  const activeOn = (date: string): boolean =>
    hasActivity(dayLogs[date]) || (extraActiveDates?.has(date) ?? false);

  let current = 0;
  let cursor = activeOn(today) ? today : addDays(today, -1);
  while (activeOn(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const activeDates = [...new Set([...Object.keys(dayLogs), ...(extraActiveDates ?? [])])]
    .filter(activeOn)
    .sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of activeDates) {
    if (prev !== null && diffDays(date, prev) === 1) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }

  return { current, longest };
}
