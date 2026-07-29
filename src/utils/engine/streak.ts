import type { DayLog } from '@/types';
import { addDays, diffDays } from '@/utils/dates';

export function hasActivity(log: DayLog | undefined): boolean {
  return !!log && (log.solvedIds.length > 0 || log.revisionsPassed.length > 0 || log.revisionsFailed.length > 0);
}

export function isPerfectDay(log: DayLog | undefined, perDay: number): boolean {
  return !!log && log.solvedIds.length >= perDay;
}

export function computeStreaks(
  dayLogs: Record<string, DayLog>, today: string
): { current: number; longest: number } {
  let current = 0;
  let cursor = hasActivity(dayLogs[today]) ? today : addDays(today, -1);
  while (hasActivity(dayLogs[cursor])) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const activeDates = Object.keys(dayLogs)
    .filter((date) => hasActivity(dayLogs[date]))
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
