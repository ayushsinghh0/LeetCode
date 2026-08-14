import type { CourseWeekProgress, QuestionProgress } from '@/types';
import type { CourseWeek } from '@/data/aimlCourse';
import { addDays } from '@/utils/dates';
import type { LadderState } from '@/utils/engine/spacedRepetition';
import { MASTERED_STAGE, REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';
import { courseLadderItems } from '@/utils/engine/aimlCourse';

// One simulated pass chain: count `weight` on the event date, climb a stage, and schedule the
// following event `REVISION_INTERVALS[newStage]` days later, until the stage reaches "mastered"
// (5) or the next event would fall past the horizon.
function walkChain(
  counts: Record<string, number>,
  stage: number,
  eventDate: string,
  horizonEnd: string,
  weight: number,
): void {
  while (eventDate <= horizonEnd) {
    counts[eventDate] = (counts[eventDate] ?? 0) + weight;
    stage += 1;
    if (stage >= MASTERED_STAGE) break;
    eventDate = addDays(eventDate, REVISION_INTERVALS[stage]!);
  }
}

// Zero-filled horizon: one entry per day for days 1..horizonDays after `today` — "nothing
// scheduled" is an all-zero series, never a shorter one.
function toSeries(
  counts: Record<string, number>,
  today: string,
  horizonDays: number,
): { date: string; count: number }[] {
  const forecast: { date: string; count: number }[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const date = addDays(today, i);
    forecast.push({ date, count: counts[date] ?? 0 });
  }
  return forecast;
}

const solvedQuestions = (byId: Record<number, QuestionProgress>): QuestionProgress[] =>
  Object.values(byId).filter((p) => p.status === 'solved');

/**
 * Shared ladder simulation — the primitive both tracks (questions, course weeks) flow through.
 *
 * Simulation model (deterministic — assumes every review passes on its simulated due date):
 *  - For each item still on the ladder, the *next* event date is `max(nextRevision, tomorrow)` —
 *    an overdue/due-today item is simulated as reviewed tomorrow, the earliest possible future
 *    slot.
 *  - After each simulated pass, the chain walks the 1/3/7/15/30 intervals until mastery or the
 *    horizon (see walkChain).
 *
 * Retired items (stage 5 / null nextRevision) are skipped here; any track-specific eligibility
 * ("solved question", "cleared core week") is the caller's filter.
 */
export function ladderForecast(
  items: Iterable<LadderState>,
  today: string,
  horizonDays = 30,
): { date: string; count: number }[] {
  const tomorrow = addDays(today, 1);
  const horizonEnd = addDays(today, horizonDays);
  const counts: Record<string, number> = {};

  for (const item of items) {
    if (item.revisionStage >= MASTERED_STAGE || item.nextRevision === null) continue;
    const eventDate = item.nextRevision > tomorrow ? item.nextRevision : tomorrow; // overdue -> tomorrow
    walkChain(counts, item.revisionStage, eventDate, horizonEnd, 1);
  }
  return toSeries(counts, today, horizonDays);
}

/**
 * Forecasts how many question revisions will land on each of the next `horizonDays` days —
 * ladderForecast specialized to solved questions, plus an optional hypothetical layer:
 * `expectedNewPerDay` assumes that many new solves happen on every future day `d` in
 * 1..horizonDays, each seeding its own stage-0-onward chain (first review the following day),
 * contributing to every one of its scheduled event dates that still fits inside the horizon.
 */
export function revisionLoadForecast(
  byId: Record<number, QuestionProgress>,
  today: string,
  horizonDays = 30,
  expectedNewPerDay = 0,
): { date: string; count: number }[] {
  const forecast = ladderForecast(solvedQuestions(byId), today, horizonDays);

  // Hypothetical future solves, each seeding its own stage-0-onward chain.
  if (expectedNewPerDay > 0) {
    const horizonEnd = addDays(today, horizonDays);
    const counts: Record<string, number> = {};
    for (let d = 1; d <= horizonDays; d++) {
      const solveDate = addDays(today, d);
      walkChain(counts, 0, addDays(solveDate, REVISION_INTERVALS[0]), horizonEnd, expectedNewPerDay);
    }
    for (const day of forecast) day.count += counts[day.date] ?? 0;
  }
  return forecast;
}

/**
 * Both ladder tracks in one series: solved questions (the same filter revisionLoadForecast
 * applies) plus cleared, unretained core course weeks (the same eligibility as
 * dueCourseReviewWeekIds). No hypothetical-solve layer — this is the load already earned.
 */
export function combinedRevisionLoadForecast(
  byId: Record<number, QuestionProgress>,
  weeks: CourseWeek[],
  byWeekId: Record<string, CourseWeekProgress>,
  today: string,
  horizonDays = 30,
  // Third ladder, added in V8: an ML track enters it when its scratch rung is stamped. Optional so
  // every existing caller and test keeps working, and because the forecast must describe the whole
  // load or it is not a load forecast — a learner with eight tracks on the ladder would otherwise
  // be shown a schedule missing a third of the work it is warning them about.
  mlItems: LadderState[] = [],
): { date: string; count: number }[] {
  return ladderForecast(
    [...solvedQuestions(byId), ...courseLadderItems(weeks, byWeekId), ...mlItems],
    today,
    horizonDays,
  );
}

/**
 * Actual currently-scheduled review dates — no simulation, unlike the forecast above. Groups
 * items by their real `nextRevision` when it falls strictly after `today` and within the
 * horizon; due/overdue items belong to the due queue, not here. As with ladderForecast,
 * track-specific eligibility filtering happens in the caller.
 */
export function upcomingByDate<T extends LadderState>(
  items: Iterable<T>,
  today: string,
  horizonDays: number,
): Map<string, T[]> {
  const horizonEnd = addDays(today, horizonDays);
  const byDate = new Map<string, T[]>();

  for (const item of items) {
    if (item.revisionStage >= MASTERED_STAGE || item.nextRevision === null) continue;
    if (item.nextRevision <= today || item.nextRevision > horizonEnd) continue;
    const list = byDate.get(item.nextRevision);
    if (list) list.push(item);
    else byDate.set(item.nextRevision, [item]);
  }
  return byDate;
}
