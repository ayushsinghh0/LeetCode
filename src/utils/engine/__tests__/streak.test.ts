import { computeStreaks, hasActivity, isPerfectDay } from '@/utils/engine/streak';
import type { DayLog } from '@/types';

const mk = (date: string, s = 0, r = 0): DayLog => ({
  date, solvedIds: Array.from({ length: s }, (_, i) => i + 1),
  revisionsPassed: Array.from({ length: r }, (_, i) => 100 + i),
  revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

test('revision-only days keep the streak alive', () => {
  const logs = { '2026-07-29': mk('2026-07-29', 0, 2), '2026-07-28': mk('2026-07-28', 8) };
  expect(computeStreaks(logs, '2026-07-30').current).toBe(2); // today empty ≠ broken
});

test('a gap breaks current but longest survives', () => {
  const logs = {
    '2026-07-20': mk('2026-07-20', 8), '2026-07-21': mk('2026-07-21', 8),
    '2026-07-22': mk('2026-07-22', 8), '2026-07-29': mk('2026-07-29', 8),
    '2026-07-30': mk('2026-07-30', 3),
  };
  expect(computeStreaks(logs, '2026-07-30')).toEqual({ current: 2, longest: 3 });
});

test('empty logs → zero streaks; perfect day threshold', () => {
  expect(computeStreaks({}, '2026-07-30')).toEqual({ current: 0, longest: 0 });
  expect(isPerfectDay(mk('2026-07-30', 8), 8)).toBe(true);
  expect(isPerfectDay(mk('2026-07-30', 7), 8)).toBe(false);
  expect(hasActivity(undefined)).toBe(false);
});

test('extra activity dates count like log activity and bridge gaps between logged days', () => {
  const logs = { '2026-07-27': mk('2026-07-27', 8), '2026-07-30': mk('2026-07-30', 3) };
  // Without extras the 28th–29th gap breaks the run…
  expect(computeStreaks(logs, '2026-07-30')).toEqual({ current: 1, longest: 1 });
  // …course-work days fill it: one unbroken 4-day streak.
  const extras = new Set(['2026-07-28', '2026-07-29']);
  expect(computeStreaks(logs, '2026-07-30', extras)).toEqual({ current: 4, longest: 4 });
});

test('extra-only activity sustains a streak with no day logs at all', () => {
  const extras = new Set(['2026-07-29', '2026-07-30']);
  expect(computeStreaks({}, '2026-07-30', extras)).toEqual({ current: 2, longest: 2 });
});
