// Analytics selectors — everything that reads `engine/insights.ts`.
//
// Split out of `selectors.ts` for one reason, and it is a load-time one: insights.ts is the
// largest engine module in the product, and `selectors.ts` is imported by the app chunk, so every
// page paid for the analytics engine including the Dashboard. This module is imported by
// /analytics alone, which is a lazy route, so the bundler can put the whole thing behind it.
//
// Same contract as every other selector here: memoized wrappers around the pure engine, no clock
// (`today` arrives as the second argument), and no logic that the engine does not already own.
import { createSelector } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress } from '@/types';
import type { RootState } from '@/store/store';
import {
  accuracyTrend,
  buildInsights,
  confidenceCalibration,
  courseRetention,
  paceAgainstEstimate,
  paceTrend,
  recognitionRecord,
  solveCoverage,
} from '@/utils/engine/insights';
import { transferRecord } from '@/utils/engine/weakness';
import { FAMILIES } from '@/data/curriculum';
import { REVISION_MINUTES, revisionMinutes } from '@/utils/engine/planner';
import {
  selectAllPatternWeakness,
  selectContestsByDate,
  selectCourseByWeekId,
  selectDayLogs,
  selectDrillsByDate,
  selectForecast,
  selectOtherTrackActiveDates,
  selectPaceSamples,
  selectProgressById,
  selectTodayArg,
} from '@/store/selectors';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

function meanRevisionMinutes(byId: Record<number, QuestionProgress>): number {
  let total = 0;
  let count = 0;
  for (const [id, progress] of Object.entries(byId)) {
    if (progress.status !== 'solved' || progress.nextRevision === null) continue;
    const question = questionById.get(Number(id));
    if (!question) continue;
    total += revisionMinutes(question);
    count += 1;
  }
  return count === 0 ? REVISION_MINUTES : Math.round(total / count);
}

/**
 * Transfer, measured once. Declared above `selectInsights` because the insight and the figure on
 * the analytics page must quote the same record — the card reads this selector rather than
 * re-deriving, exactly as it does for the weakness model.
 */
export const selectTransferRecord = createSelector([selectProgressById], (byId) =>
  transferRecord(questions, byId, FAMILIES),
);

/**
 * The findings the current evidence actually supports, most actionable first.
 *
 * Returns [] freely: each builder in the insights engine states its own minimum sample and
 * declines below it, so an early-days learner correctly gets nothing rather than a confident
 * reading of four data points.
 */
export const selectInsights = createSelector(
  [
    selectProgressById,
    selectDayLogs,
    selectDrillsByDate,
    selectAllPatternWeakness,
    selectForecast,
    (state: RootState) => state.settings.dailyCapacityMin,
    selectOtherTrackActiveDates,
    selectCourseByWeekId,
    selectTransferRecord,
    (state: RootState) => state.practice.sittings,
    selectContestsByDate,
    (state: RootState) => state.interviews.sittings,
    selectTodayArg,
  ],
  (
    byId,
    dayLogs,
    drills,
    weakness,
    forecast,
    capacityMin,
    courseActiveDates,
    courseByWeekId,
    transfer,
    sittings,
    contests,
    interviews,
    today,
  ) =>
    buildInsights(
      {
        today,
        all: questions,
        byId,
        dayLogs,
        drills,
        weakness,
        forecast,
        capacityMin,
        // The sitting ledger feeds the follow-through card (measurement stays internal).
        sittings,
        // The mean cost of the reviews actually on this learner's ladder — not the flat
        // REVISION_MINUTES fallback. The forecast counts reviews, not questions, so a single
        // figure is unavoidable here; it must at least be the same figure the session plan
        // would arrive at, or the schedule-risk card quotes minutes the plan contradicts.
        revisionMinutes: meanRevisionMinutes(byId),
        // Both tracks climb one ladder, so the accuracy card grades both — the same blend
        // `selectAccuracyTrend` feeds the figure with, or the card and the figure would print
        // different numbers about the same recalls on the same screen.
        courseByWeekId,
        transfer,
        // The V8 performance channels. Both are derived records of finished sittings; the live
        // slices never persist, so there is nothing here that a reload could invent.
        contests,
        interviews,
      },
      courseActiveDates,
    ),
);

/**
 * The measurements the analytics page reads.
 *
 * Every one of them is an engine call with its own suppression floor — the selectors do the joins
 * against the static dataset and nothing else. A `null` here means "the record cannot answer that
 * yet", and the page is required to say so rather than render a zero.
 */
export const selectSolveCoverage = createSelector([selectProgressById], (byId) => solveCoverage(byId));

export const selectCalibration = createSelector([selectProgressById], (byId) =>
  confidenceCalibration(byId),
);

export const selectRecognitionRecord = createSelector([selectDrillsByDate], (drills) =>
  recognitionRecord(drills),
);

export const selectPaceAgainstEstimate = createSelector([selectPaceSamples], (samples) =>
  paceAgainstEstimate(samples),
);

export const selectPaceTrend = createSelector([selectProgressById], (byId) =>
  paceTrend(questions, byId),
);

// Both tracks climb the same ladder and share the revisionHistory shape, so accuracy is measured
// across both — the same blending the pass-rate figure on the analytics page does.
export const selectAccuracyTrend = createSelector(
  [selectProgressById, selectCourseByWeekId],
  (byId, byWeekId) => accuracyTrend(byId, byWeekId),
);

export const selectCourseRetention = createSelector([selectCourseByWeekId], (byWeekId) =>
  courseRetention(byWeekId),
);
