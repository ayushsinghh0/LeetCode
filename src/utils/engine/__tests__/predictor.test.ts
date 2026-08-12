import { addDays } from '@/utils/dates';
import {
  applyRevision, applySolve, initialProgress, MASTERED_STAGE,
} from '@/utils/engine/spacedRepetition';
import {
  combinedRevisionLoadForecast, ladderForecast, revisionLoadForecast, upcomingByDate,
} from '@/utils/engine/predictor';
import {
  applyCourseReview, applyCourseWeekClear, initialCourseProgress,
} from '@/utils/engine/aimlCourse';
import type { CourseWeek } from '@/data/aimlCourse';
import type { CourseWeekProgress, QuestionProgress } from '@/types';

// Minimal synthetic weeks — the course eligibility filter only reads `id` and `optional`.
const coreWeek = (id: string): CourseWeek => ({
  id, week: 1, title: id, taughtOn: null, contentId: null, contentKind: 'video', resources: [],
});
const extraWeek = (id: string): CourseWeek => ({ ...coreWeek(id), week: null, optional: true });

// Both sessions done and the ladder entered on `date` — first review due date+1, like a solve.
const clearedWeek = (date: string): CourseWeekProgress =>
  applyCourseWeekClear({ ...initialCourseProgress(), day1DoneOn: date, day2DoneOn: date }, date);

const retainedWeek = (clearDate: string): CourseWeekProgress => {
  let p = clearedWeek(clearDate);
  while (p.revisionStage < MASTERED_STAGE) p = applyCourseReview(p, p.nextRevision!, true);
  return p;
};

test('revisionLoadForecast: exact horizon length and date range, default horizonDays=30', () => {
  const today = '2026-07-30';
  const forecast = revisionLoadForecast({}, today);
  expect(forecast).toHaveLength(30);
  expect(forecast[0]!.date).toBe(addDays(today, 1));
  expect(forecast[29]!.date).toBe(addDays(today, 30));
  expect(forecast.every((f) => f.count === 0)).toBe(true);
});

test('revisionLoadForecast: custom horizonDays produces an exact, contiguous date range', () => {
  const today = '2026-07-30';
  const forecast = revisionLoadForecast({}, today, 7);
  expect(forecast).toHaveLength(7);
  expect(forecast.map((f) => f.date)).toEqual([
    '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
  ]);
});

test('revisionLoadForecast: an overdue question counts tomorrow, then walks the ladder', () => {
  const today = '2026-07-30';
  const p = applySolve(initialProgress(), '2026-07-01'); // nextRevision 2026-07-02: overdue relative to today
  const byId = { 1: p };
  const forecast = revisionLoadForecast(byId, today, 30);
  const byDate = new Map(forecast.map((f) => [f.date, f.count]));

  expect(byDate.get('2026-07-31')).toBe(1); // overdue -> collapses to tomorrow
  expect(byDate.get('2026-08-03')).toBe(1); // stage 1 gap (+3) after the tomorrow pass
  expect(byDate.get('2026-08-10')).toBe(1); // stage 2 gap (+7)
  expect(byDate.get('2026-08-25')).toBe(1); // stage 3 gap (+15)
  // stage-4 gap (+30) from 08-25 would land 09-24, past the horizon (ends 08-29) -> not counted
  const total = [...byDate.values()].reduce((a, b) => a + b, 0);
  expect(total).toBe(4);
});

test('revisionLoadForecast: a not-yet-overdue item counts on its real due date, not tomorrow', () => {
  const today = '2026-07-30';
  let p = applySolve(initialProgress(), '2026-07-28'); // nextRevision 2026-07-29
  p = applyRevision(p, '2026-07-29', true);            // stage 1, nextRevision 2026-08-01
  expect(p.revisionStage).toBe(1);
  expect(p.nextRevision).toBe('2026-08-01');

  const byId = { 1: p };
  const forecast = revisionLoadForecast(byId, today, 30);
  const byDate = new Map(forecast.map((f) => [f.date, f.count]));

  expect(byDate.get(addDays(today, 1))).toBe(0); // NOT collapsed to tomorrow
  expect(byDate.get('2026-08-01')).toBe(1);      // counted on its real (future) due date
});

test('revisionLoadForecast: mastered and unsolved questions never contribute', () => {
  const today = '2026-07-30';
  let mastered = applySolve(initialProgress(), '2026-01-01');
  let day = mastered.nextRevision!;
  for (let i = 0; i < 5; i++) {
    mastered = applyRevision(mastered, day, true);
    if (mastered.nextRevision) day = mastered.nextRevision;
  }
  expect(mastered.revisionStage).toBe(MASTERED_STAGE);

  const byId: Record<number, QuestionProgress> = { 1: mastered, 2: initialProgress() };
  const forecast = revisionLoadForecast(byId, today, 30);
  expect(forecast.every((f) => f.count === 0)).toBe(true);
});

test('revisionLoadForecast: expectedNewPerDay seeds a stage-0-onward chain for each future day', () => {
  const today = '2026-07-30';
  const forecast = revisionLoadForecast({}, today, 5, 1);
  expect(forecast).toEqual([
    { date: '2026-07-31', count: 0 }, // day 1: solve happens, no review yet
    { date: '2026-08-01', count: 1 }, // day 1's solve -> stage-0 review (+1)
    { date: '2026-08-02', count: 1 }, // day 2's solve -> stage-0 review
    { date: '2026-08-03', count: 1 }, // day 3's solve -> stage-0 review
    { date: '2026-08-04', count: 2 }, // day 4's solve stage-0 review + day 1's stage-1 review (+3 from 08-01)
  ]);
});

test('revisionLoadForecast: expectedNewPerDay scales linearly', () => {
  const today = '2026-07-30';
  const forecastOne = revisionLoadForecast({}, today, 5, 1);
  const forecastThree = revisionLoadForecast({}, today, 5, 3);
  expect(forecastThree.map((f) => f.count)).toEqual(forecastOne.map((f) => f.count * 3));
});

test('revisionLoadForecast: does not mutate its input', () => {
  const today = '2026-07-30';
  const p = applySolve(initialProgress(), '2026-07-01');
  const byId = { 1: p };
  const snapshot = JSON.parse(JSON.stringify(byId));
  revisionLoadForecast(byId, today, 30, 2);
  expect(byId).toEqual(snapshot);
});

test('ladderForecast: revisionLoadForecast is its solved-question specialization', () => {
  const today = '2026-07-30';
  const overdue = applySolve(initialProgress(), '2026-07-01');
  const scheduled = applyRevision(applySolve(initialProgress(), '2026-07-28'), '2026-07-29', true);
  const byId = { 1: overdue, 2: scheduled, 3: initialProgress() }; // unsolved is the caller's filter
  expect(ladderForecast([overdue, scheduled], today, 30)).toEqual(revisionLoadForecast(byId, today, 30));
});

test('combinedRevisionLoadForecast: a cleared, unretained course week walks the ladder like a question', () => {
  const today = '2026-07-30';
  const weeks = [coreWeek('w1')];
  const byWeekId = { w1: clearedWeek('2026-07-30') }; // review due 2026-07-31
  const forecast = combinedRevisionLoadForecast({}, weeks, byWeekId, today, 30);
  const byDate = new Map(forecast.map((f) => [f.date, f.count]));

  expect(byDate.get('2026-07-31')).toBe(1); // stage-0 review on its scheduled date
  expect(byDate.get('2026-08-03')).toBe(1); // stage 1 gap (+3)
  expect(byDate.get('2026-08-10')).toBe(1); // stage 2 gap (+7)
  expect(byDate.get('2026-08-25')).toBe(1); // stage 3 gap (+15)
  // stage-4 gap (+30) from 08-25 falls past the horizon -> not counted
  expect(forecast.reduce((a, f) => a + f.count, 0)).toBe(4);
});

test('combinedRevisionLoadForecast: retained, undone, and extra weeks never contribute', () => {
  const today = '2026-07-30';
  const weeks = [coreWeek('w1'), coreWeek('w2'), extraWeek('x1')];
  const byWeekId: Record<string, CourseWeekProgress> = {
    w1: retainedWeek('2026-01-01'),
    w2: { ...initialCourseProgress(), day1DoneOn: '2026-07-29' }, // half-done: not cleared
    x1: clearedWeek('2026-07-30'), // even with a (never-produced) schedule, extras stay out
  };
  const forecast = combinedRevisionLoadForecast({}, weeks, byWeekId, today, 30);
  expect(forecast.every((f) => f.count === 0)).toBe(true);
});

test('combinedRevisionLoadForecast: question and course events sum on shared dates', () => {
  const today = '2026-07-30';
  const question = applySolve(initialProgress(), '2026-07-30'); // review due 2026-07-31
  const weeks = [coreWeek('w1')];
  const byWeekId = { w1: clearedWeek('2026-07-30') };           // review due 2026-07-31
  const forecast = combinedRevisionLoadForecast({ 1: question }, weeks, byWeekId, today, 30);
  const byDate = new Map(forecast.map((f) => [f.date, f.count]));

  // Identical schedules -> every simulated event date carries both tracks.
  expect(byDate.get('2026-07-31')).toBe(2);
  expect(byDate.get('2026-08-03')).toBe(2);
  expect(byDate.get('2026-08-10')).toBe(2);
  expect(byDate.get('2026-08-25')).toBe(2);
  expect(forecast.reduce((a, f) => a + f.count, 0)).toBe(8);
});

test('combinedRevisionLoadForecast: empty state yields an all-zero, contiguous horizon', () => {
  const today = '2026-07-30';
  const forecast = combinedRevisionLoadForecast({}, [coreWeek('w1')], {}, today);
  expect(forecast).toHaveLength(30);
  expect(forecast[0]!.date).toBe(addDays(today, 1));
  expect(forecast[29]!.date).toBe(addDays(today, 30));
  expect(forecast.every((f) => f.count === 0)).toBe(true);
});

test('upcomingByDate: groups items by their actual scheduled date within (today, today+horizon]', () => {
  const today = '2026-07-30';
  const dueToday = { revisionStage: 1, nextRevision: today };            // due -> due queue, not upcoming
  const overdue = { revisionStage: 0, nextRevision: '2026-07-01' };
  const inWindow = { revisionStage: 1, nextRevision: '2026-08-03' };
  const sameDate = { revisionStage: 2, nextRevision: '2026-08-03' };
  const edge = { revisionStage: 3, nextRevision: addDays(today, 30) };   // last day inside
  const beyond = { revisionStage: 4, nextRevision: addDays(today, 31) }; // first day outside
  const retired = { revisionStage: MASTERED_STAGE, nextRevision: null };

  const grouped = upcomingByDate(
    [dueToday, overdue, inWindow, sameDate, edge, beyond, retired], today, 30,
  );

  expect([...grouped.keys()].sort()).toEqual(['2026-08-03', addDays(today, 30)]);
  expect(grouped.get('2026-08-03')).toEqual([inWindow, sameDate]); // input order preserved
  expect(grouped.get(addDays(today, 30))).toEqual([edge]);
});
