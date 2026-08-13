// Personalized time estimates.
//
// The product rule this module exists to enforce: never pretend to know someone's pace from one
// attempt. A personal figure appears only once there are MIN_SAMPLES comparable measurements,
// and the UI is told exactly what the figure was computed over so it can say so.
//
// The measurement is a PACE RATIO, not a per-question average — a learner solves each question
// once, so there is never a second sample for the same problem. What generalizes instead is how
// this person's minutes relate to the dataset's estimate: median(actual / estimated) over
// comparable solved questions. A ratio of 0.8 means "you finish these in about four-fifths of
// the book estimate", which is a claim five samples can support.
//
// The minutes come from QuestionProgress.timeSpentMin — focus-session minutes attributed to a
// question (see the time-attribution invariant in CLAUDE.md). Questions solved without ever
// running a focus session contribute nothing, which is correct: an unmeasured solve is not a
// measurement of zero.
import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';

/** Below this, there is no personal estimate — there is a dataset estimate and an honest silence. */
export const MIN_SAMPLES = 5;

/** Guards against a stale focus timer left running turning into a 6-hour "sample". */
const MAX_PLAUSIBLE_RATIO = 6;

export type EstimateBasis = 'pattern' | 'difficulty';

export interface TimeEstimate {
  /** The dataset's authored first-attempt estimate for this question, in minutes. */
  typical: number;
  /** The learner's projected minutes, or null when the evidence is too thin to say. */
  personal: number | null;
  /** How many comparable measurements `personal` rests on. */
  sampleSize: number;
  /** What the comparison set was — surfaced so the UI never implies more precision than exists. */
  basis: EstimateBasis | null;
}

interface Sample {
  ratio: number;
  pattern: PatternId;
  difficulty: Difficulty;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Every usable pace measurement in the learner's history. Exported so callers that need many
 * estimates (a plan, a list) build the sample set once instead of per question.
 */
export function paceSamples(all: Question[], byId: Record<number, QuestionProgress>): Sample[] {
  const samples: Sample[] = [];
  for (const q of all) {
    const p = byId[q.id];
    if (!p || p.status !== 'solved' || p.timeSpentMin <= 0 || q.estimatedTime <= 0) continue;
    const ratio = p.timeSpentMin / q.estimatedTime;
    if (ratio > MAX_PLAUSIBLE_RATIO) continue;
    samples.push({ ratio, pattern: q.pattern, difficulty: q.difficulty });
  }
  return samples;
}

/**
 * The estimate for one question. Prefers a same-pattern comparison (pace varies far more by
 * pattern than by difficulty — someone fluent in two pointers may still be slow on DP) and falls
 * back to same-difficulty; below MIN_SAMPLES on both, `personal` stays null.
 */
export function estimateFor(question: Question, samples: Sample[]): TimeEstimate {
  const byPattern = samples.filter((s) => s.pattern === question.pattern);
  const byDifficulty = samples.filter((s) => s.difficulty === question.difficulty);

  const pool =
    byPattern.length >= MIN_SAMPLES
      ? { rows: byPattern, basis: 'pattern' as const }
      : byDifficulty.length >= MIN_SAMPLES
        ? { rows: byDifficulty, basis: 'difficulty' as const }
        : null;

  if (!pool) {
    return { typical: question.estimatedTime, personal: null, sampleSize: byPattern.length, basis: null };
  }

  const ratio = median(pool.rows.map((s) => s.ratio));
  return {
    typical: question.estimatedTime,
    personal: Math.max(1, Math.round(question.estimatedTime * ratio)),
    sampleSize: pool.rows.length,
    basis: pool.basis,
  };
}

/**
 * The minutes a plan should budget for this question: the personal figure when it exists,
 * the dataset's otherwise. One function so the plan, the next-action card, and the question
 * header can never disagree about how long the same piece of work will take.
 */
export function plannedMinutes(estimate: TimeEstimate): number {
  return estimate.personal ?? estimate.typical;
}

export const BASIS_LABEL: Record<EstimateBasis, string> = {
  pattern: 'your pace on this pattern',
  difficulty: 'your pace on this difficulty',
};
