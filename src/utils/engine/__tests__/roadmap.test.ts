import questions from '@/data/questions.json';
import type { DayLog, Question } from '@/types';
import {
  currentDay, dayOfQuestion, daySlice, estimatedFinishDate,
  isWeeklyRevisionDay, solvePace, totalDays,
} from '@/utils/engine/roadmap';

const qs = questions as Question[];
const log = (date: string, solved: number): DayLog => ({
  date, solvedIds: Array.from({ length: solved }, (_, i) => i + 1),
  revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

test('68 days at 8/day for 539 questions; last day is short', () => {
  expect(totalDays(539, 8)).toBe(68);
  expect(daySlice(qs, 1, 8).map((q) => q.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(daySlice(qs, 68, 8).map((q) => q.id)).toEqual([537, 538, 539]);
  expect(daySlice(qs, 69, 8)).toEqual([]);
});

test('dayOfQuestion and currentDay', () => {
  expect(dayOfQuestion(1, 8)).toBe(1);
  expect(dayOfQuestion(8, 8)).toBe(1);
  expect(dayOfQuestion(9, 8)).toBe(2);
  expect(currentDay(0, 8, 539)).toBe(1);
  expect(currentDay(7, 8, 539)).toBe(1);   // day 1 not finished
  expect(currentDay(8, 8, 539)).toBe(2);
  expect(currentDay(539, 8, 539)).toBe(68); // capped, never 69
});

test('weekly revision day every 7th roadmap day', () => {
  expect(isWeeklyRevisionDay(7)).toBe(true);
  expect(isWeeklyRevisionDay(14)).toBe(true);
  expect(isWeeklyRevisionDay(8)).toBe(false);
  expect(isWeeklyRevisionDay(0)).toBe(false);
});

test('solvePace averages over the last 14 calendar days', () => {
  const logs = {
    '2026-07-29': log('2026-07-29', 8),
    '2026-07-28': log('2026-07-28', 8),
    '2026-07-20': log('2026-07-20', 12),
  };
  expect(solvePace(logs, '2026-07-30')).toBeCloseTo(28 / 14);
});

test('estimatedFinishDate uses pace, falls back to perDay with <3 active days', () => {
  // fallback: no history → 80 remaining at 8/day = 10 days out
  expect(estimatedFinishDate('2026-07-30', 80, {}, 8)).toBe('2026-08-09');
  // real pace: 28 solves in window → pace 2/day → 20 remaining = 10 days
  const logs = {
    '2026-07-27': log('2026-07-27', 10), '2026-07-25': log('2026-07-25', 10),
    '2026-07-23': log('2026-07-23', 8),
  };
  expect(estimatedFinishDate('2026-07-30', 20, logs, 8)).toBe('2026-08-09');
});
