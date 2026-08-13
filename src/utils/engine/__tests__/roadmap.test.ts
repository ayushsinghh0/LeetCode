import questions from '@/data/questions.json';
import type { DayLog, Question } from '@/types';
import {
  currentDay, dayOfQuestion, daySlice, estimatedFinishDate, finishProjection,
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

test('solvePace divides by the days the learner has existed, capped at the 14-day window', () => {
  const logs = {
    '2026-07-29': log('2026-07-29', 8),
    '2026-07-28': log('2026-07-28', 8),
    '2026-07-20': log('2026-07-20', 12),
  };
  // Started on the 20th: 11 calendar days through the 30th, not a flat 14.
  expect(solvePace(logs, '2026-07-30')).toBeCloseTo(28 / 11);
  expect(solvePace(logs, '2026-07-30', 14, '2026-07-20')).toBeCloseTo(28 / 11);
  // A learner older than the window is divided by the window itself.
  expect(solvePace(logs, '2026-07-30', 14, '2026-01-01')).toBeCloseTo(28 / 14);
});

test('solvePace: day 3 of perfect adherence reads as the target rate, not a fraction of it', () => {
  // The regression. 24 solves over the three days this learner has existed is 8/day; dividing by
  // a flat 14 called it 1.71/day and pushed the projected finish ~10 months out.
  const logs = {
    '2026-07-28': log('2026-07-28', 8),
    '2026-07-29': log('2026-07-29', 8),
    '2026-07-30': log('2026-07-30', 8),
  };
  expect(solvePace(logs, '2026-07-30', 14, '2026-07-28')).toBeCloseTo(8);
  expect(solvePace(logs, '2026-07-30')).toBeCloseTo(8); // startDate unknown → earliest day log
});

test('estimatedFinishDate uses pace, falls back to perDay with <3 active days', () => {
  // fallback: no history → 80 remaining at 8/day = 10 days out
  expect(estimatedFinishDate('2026-07-30', 80, {}, 8)).toBe('2026-08-09');
  // real pace: 28 solves over the 8 days since the 23rd → 3.5/day → 20 remaining = 6 days
  const logs = {
    '2026-07-27': log('2026-07-27', 10), '2026-07-25': log('2026-07-25', 10),
    '2026-07-23': log('2026-07-23', 8),
  };
  expect(estimatedFinishDate('2026-07-30', 20, logs, 8)).toBe('2026-08-05');
});

test('finishProjection reports the basis: target while new, measured once there is history', () => {
  // No history at all: the figure is the questions-per-day setting, and says so.
  const fresh = finishProjection('2026-07-30', 539, {}, 8);
  expect(fresh.basis).toBe('target');
  expect(fresh.date).toBe('2026-10-06'); // ceil(539 / 8) = 68 days out

  const logs = {
    '2026-07-28': log('2026-07-28', 8),
    '2026-07-29': log('2026-07-29', 8),
    '2026-07-30': log('2026-07-30', 8),
  };
  const measured = finishProjection('2026-07-30', 515, logs, 8, '2026-07-28');
  expect(measured.basis).toBe('measured');
  expect(measured.pace).toBeCloseTo(8);
  // 515 remaining at 8/day = 65 days. The flat-14 divisor made this 301 days — a date in 2027,
  // which the Dashboard then rendered as a bare "May 27".
  expect(measured.date).toBe('2026-10-03');
});

test('finishProjection has no estimate once nothing remains', () => {
  const done = finishProjection('2026-07-30', 0, {}, 8);
  expect(done.basis).toBe('complete');
  expect(done.date).toBeNull();
  // The date-only wrapper still has to return a string for its one legacy caller.
  expect(estimatedFinishDate('2026-07-30', 0, {}, 8)).toBe('2026-07-30');
});
