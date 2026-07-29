import type { QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';
import { isMastered, MASTERED_STAGE, REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';

/**
 * Forecasts how many revision reviews will land on each of the next `horizonDays` days.
 *
 * Simulation model (deterministic — assumes every review passes on its simulated due date):
 *  - For each solved, non-mastered question, the *next* event date is
 *    `max(nextRevision, tomorrow)` — an overdue/due-today item is simulated as reviewed
 *    tomorrow, the earliest possible future slot.
 *  - After each simulated pass, the revision stage advances by one and the following event is
 *    scheduled `REVISION_INTERVALS[newStage]` days after the event that was just counted.
 *    The chain stops once the stage reaches "mastered" (5) or the next event would fall past
 *    the horizon.
 *  - `expectedNewPerDay` layers in hypothetical future solves: for every future day `d` in
 *    1..horizonDays, `expectedNewPerDay` new solves are assumed to happen on that day, each
 *    starting its own stage-0-onward chain (first review the following day), contributing to
 *    every one of its scheduled event dates that still fits inside the horizon.
 */
export function revisionLoadForecast(
  byId: Record<number, QuestionProgress>,
  today: string,
  horizonDays = 30,
  expectedNewPerDay = 0,
): { date: string; count: number }[] {
  const tomorrow = addDays(today, 1);
  const horizonEnd = addDays(today, horizonDays);
  const counts: Record<string, number> = {};

  const addCount = (date: string, n: number): void => {
    counts[date] = (counts[date] ?? 0) + n;
  };

  // Existing solved, non-mastered questions.
  for (const p of Object.values(byId)) {
    if (p.status !== 'solved' || isMastered(p) || p.nextRevision === null) continue;

    let stage = p.revisionStage;
    let eventDate = p.nextRevision > tomorrow ? p.nextRevision : tomorrow; // overdue -> tomorrow

    while (eventDate <= horizonEnd) {
      addCount(eventDate, 1);
      stage += 1;
      if (stage >= MASTERED_STAGE) break;
      eventDate = addDays(eventDate, REVISION_INTERVALS[stage]);
    }
  }

  // Hypothetical future solves, each seeding its own stage-0-onward chain.
  if (expectedNewPerDay > 0) {
    for (let d = 1; d <= horizonDays; d++) {
      const solveDate = addDays(today, d);
      let stage = 0;
      let eventDate = addDays(solveDate, REVISION_INTERVALS[0]);

      while (eventDate <= horizonEnd) {
        addCount(eventDate, expectedNewPerDay);
        stage += 1;
        if (stage >= MASTERED_STAGE) break;
        eventDate = addDays(eventDate, REVISION_INTERVALS[stage]);
      }
    }
  }

  const forecast: { date: string; count: number }[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const date = addDays(today, i);
    forecast.push({ date, count: counts[date] ?? 0 });
  }
  return forecast;
}
