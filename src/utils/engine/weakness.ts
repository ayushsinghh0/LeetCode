// The unified weakness model — one answer to "which patterns are not holding, and why".
//
// Weakness used to be computed twice: a drill-miss/recall blend in the store and a
// confidence/coverage blend in engine/recommendations. Two formulas meant two answers to the same
// question about the same person, and a weakness claim is a claim *about someone* — two
// contradictory versions of it are worse than one imperfect one. This module is the only place
// that answers it.
//
// Four rules keep it an explanation rather than a black box.
//
// 1. RECENCY. Every observation decays on a 30-day half-life, so a drill missed last week counts
//    for roughly eight times what the same miss three months ago counts for. Weakness is a claim
//    about the present tense; without decay it is a claim about the learner's whole history, which
//    is a different and much less useful thing.
//
// 2. REPEATED EVIDENCE. A signal contributes nothing until it rests on MIN_OBSERVATIONS negative
//    observations. One miss is a bad evening. This is the same floor `selectMostMissedPatterns`
//    already applies to drill misses, applied to every signal rather than to one of them.
//
// 3. NO SINGLE SIGNAL DOMINATES. Every weight is at most 0.24, so no metric owns even a quarter of
//    the score, and a pattern cannot reach a full-strength weakness claim until signals worth at
//    least MIN_EVIDENCE_WEIGHT of the budget have fired (see `combine`). One failing metric can
//    say "look here"; only corroboration can say "this is your weakest area".
//
// 4. UNMEASURED IS NOT ZERO. A pattern with no negative evidence is absent from the result, not
//    scored 0 and called strong. Silence and strength are different findings.
//
// Pure and deterministic like every engine module: ISO date strings in, no clock, no store.
import { PATTERNS } from '@/data/patterns';
import type { DrillDayResult, PatternId, ProblemFamily, Question, QuestionProgress } from '@/types';
import { diffDays } from '@/utils/dates';

/* ------------------------------------------------------------------------------------------- */
/* Calibration constants — all in one place so the honesty budget is auditable                  */
/* ------------------------------------------------------------------------------------------- */

/** Evidence halves in weight every 30 days. Three months ago is worth an eighth of last week. */
export const RECENCY_HALF_LIFE_DAYS = 30;

/**
 * Two records carry no date: a skipped question and an abandoned one are *states*, not events.
 * They are weighted as though they were exactly one half-life old rather than silently treated as
 * today's news — a standing fact should not outrank a measurement taken this morning.
 */
const UNDATED_WEIGHT = 0.5;

/** A signal with fewer negative observations than this is noise and contributes nothing. */
export const MIN_OBSERVATIONS = 2;

/**
 * Drill misses are the one signal with no denominator: a drill records which patterns were missed,
 * never how many prompts each pattern was given. So it is normalized against a saturation point
 * instead of a rate — four recency-weighted misses reads as fully missed. An absolute scale is
 * deliberate: normalizing against the worst pattern (the previous model) forces some pattern to
 * score maximally even when the learner is not weak anywhere.
 */
const DRILL_SATURATION = 4;

/** Confidence at or below this is the learner saying "I do not really have this". */
const LOW_CONFIDENCE = 2;

/** A timed solve at or above this multiple of the authored estimate counts as a struggle. */
const SLOW_RATIO = 1.5;

/**
 * Mirrors timeEstimate's MAX_PLAUSIBLE_RATIO: a focus timer left running overnight is not a
 * six-hour solve, and both modules must discard the same implausible samples or they will disagree
 * about the same learner's pace.
 */
const MAX_PLAUSIBLE_RATIO = 6;

/** Hint rung 2 is "which technique"; needing it on an idea you have already met is the signal. */
const TRANSFER_HINT_RUNG = 2;

/**
 * The share of the weight budget that must have fired before a score can reach 1.
 *
 * Below it the score is divided by this floor rather than by the fired weight, so a single failing
 * metric tops out near half strength however badly it reads. This is rule 3 made arithmetic: one
 * signal can nominate a pattern, but only corroboration can convict it.
 */
export const MIN_EVIDENCE_WEIGHT = 0.5;

/* ------------------------------------------------------------------------------------------- */
/* Signals                                                                                      */
/* ------------------------------------------------------------------------------------------- */

export type WeaknessSignalId =
  | 'recognition' // drill misses — naming the technique on a cold read
  | 'retention'   // graded recalls that failed after a gap
  | 'confidence'  // the learner's own low ratings
  | 'unfinished'  // questions opened here and skipped or abandoned
  | 'pace'        // timed solves that ran long against the authored estimate
  | 'hints'       // solves that needed the hint ladder
  | 'transfer';   // problems in families already met that did not carry over

/**
 * The weights, and why they sit where they do.
 *
 * The two graded measurements lead because they are the only ones where the product, not the
 * learner, decided the outcome: a failed recall and a missed drill are marks, everything else is
 * circumstantial. Retention edges recognition because forgetting something you once had is a
 * stronger statement than failing to name it on sight.
 *
 * Transfer and unfinished work sit in the middle: both are real behaviour, but each has an
 * innocent reading (a hard variant, a question deferred on purpose).
 *
 * The last three are the softest evidence in the product and are weighted accordingly — a
 * self-rating is a mood as much as a measurement, a slow solve may be a slow evening, and a hint
 * is a support feature that must never read as a punishment (see CLAUDE.md). No weight exceeds
 * 0.24, so no single metric owns even a quarter of the verdict.
 */
export const SIGNAL_WEIGHTS: Record<WeaknessSignalId, number> = {
  retention: 0.24,
  recognition: 0.22,
  transfer: 0.12,
  unfinished: 0.12,
  confidence: 0.1,
  pace: 0.1,
  hints: 0.1,
};

export const SIGNAL_LABEL: Record<WeaknessSignalId, string> = {
  recognition: 'Recognition drills',
  retention: 'Recall after a gap',
  confidence: 'Your own rating',
  unfinished: 'Unfinished attempts',
  pace: 'Time against estimate',
  hints: 'Hint ladder',
  transfer: 'Transfer',
};

export interface WeaknessSignal {
  id: WeaknessSignalId;
  label: string;
  /** This signal's own reading for this pattern, 0 (clean) to 1 (fully missed). */
  value: number;
  /** The weight it was allowed to carry. */
  weight: number;
  /** What it actually added to the score. The signals' contributions sum to `score`. */
  contribution: number;
  /** Negative observations behind it — what MIN_OBSERVATIONS gates on. */
  observations: number;
  /** The reading in plain English, with its numbers. Never a bare score. */
  detail: string;
}

export interface PatternWeakness {
  id: PatternId;
  name: string;
  /** 0..1. Higher is weaker. Comparable across patterns; not a percentage of anything. */
  score: number;
  /** Strongest contributor first. Always non-empty — a scored pattern has evidence by definition. */
  signals: WeaknessSignal[];
  /** The two strongest contributors as one because-clause, for "Review X because …". */
  summary: string;
}

/* ------------------------------------------------------------------------------------------- */
/* Tallies                                                                                      */
/* ------------------------------------------------------------------------------------------- */

interface Tally {
  /** Negative observations, unweighted — the honest count the learner is shown. */
  misses: number;
  /** Chances this signal had to go wrong. Zero for drills, which have no denominator. */
  opportunities: number;
  weightedMiss: number;
  weightedOpportunity: number;
  /** Most recent negative observation that carried a date, for "most recently …". */
  latest: string | null;
}

const emptyTally = (): Tally => ({
  misses: 0,
  opportunities: 0,
  weightedMiss: 0,
  weightedOpportunity: 0,
  latest: null,
});

type Tallies = Record<WeaknessSignalId, Tally>;

const emptyTallies = (): Tallies => ({
  recognition: emptyTally(),
  retention: emptyTally(),
  confidence: emptyTally(),
  unfinished: emptyTally(),
  pace: emptyTally(),
  hints: emptyTally(),
  transfer: emptyTally(),
});

/** Half-life decay. Undated evidence is priced at exactly one half-life — see UNDATED_WEIGHT. */
function recency(today: string, date: string | null): number {
  if (date === null) return UNDATED_WEIGHT;
  const age = Math.max(0, diffDays(today, date));
  return 0.5 ** (age / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Record one observation. `severity` is 0 for a clean outcome and 1 for a full miss; the hint
 * ladder is the one signal that uses the range between, because reaching for "notice what the
 * statement is telling you" is not the same event as taking the full walkthrough.
 */
function record(tally: Tally, weight: number, severity: number, date: string | null): void {
  tally.opportunities += 1;
  tally.weightedOpportunity += weight;
  if (severity <= 0) return;
  tally.misses += 1;
  tally.weightedMiss += weight * severity;
  if (date !== null && (tally.latest === null || date > tally.latest)) tally.latest = date;
}

/** A count-only observation: a miss with no denominator to divide it by. */
function countMiss(tally: Tally, weight: number, date: string | null): void {
  tally.misses += 1;
  tally.weightedMiss += weight;
  if (date !== null && (tally.latest === null || date > tally.latest)) tally.latest = date;
}

function agoPhrase(today: string, date: string): string {
  const days = Math.max(0, diffDays(today, date));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* ------------------------------------------------------------------------------------------- */
/* Input                                                                                        */
/* ------------------------------------------------------------------------------------------- */

export interface WeaknessInput {
  today: string;
  all: Question[];
  byId: Record<number, QuestionProgress>;
  drills: Record<string, DrillDayResult>;
  /** Problem families, for the transfer signal. Passed in so the engine imports no dataset. */
  families: ProblemFamily[];
}

/* ------------------------------------------------------------------------------------------- */
/* Reading each signal                                                                          */
/* ------------------------------------------------------------------------------------------- */

interface Reading {
  value: number;
  observations: number;
  detail: string;
  /** Lowercase fragment for the because-clause. */
  fragment: string;
}

function read(id: WeaknessSignalId, tally: Tally, today: string): Reading | null {
  // Rule 2: a signal standing on one observation is not a signal.
  if (tally.misses < MIN_OBSERVATIONS) return null;

  const { misses, opportunities } = tally;

  if (id === 'recognition') {
    // Rule: no denominator exists, so saturate rather than invent one.
    const value = Math.min(1, tally.weightedMiss / DRILL_SATURATION);
    const when = tally.latest ? `, most recently ${agoPhrase(today, tally.latest)}` : '';
    return {
      value,
      observations: misses,
      detail: `Missed in ${misses} recognition ${plural(misses, 'drill', 'drills')}${when}.`,
      fragment: `you missed ${misses} recognition ${plural(misses, 'drill', 'drills')}`,
    };
  }

  if (tally.weightedOpportunity <= 0) return null;
  const value = Math.min(1, tally.weightedMiss / tally.weightedOpportunity);

  switch (id) {
    case 'retention': {
      const when = tally.latest ? ` The most recent was ${agoPhrase(today, tally.latest)}.` : '';
      return {
        value,
        observations: misses,
        detail: `${misses} of ${opportunities} graded recalls failed.${when}`,
        fragment: `${misses} of ${opportunities} recalls failed`,
      };
    }
    case 'confidence':
      return {
        value,
        observations: misses,
        detail: `You rated ${misses} of ${opportunities} solves here ${LOW_CONFIDENCE} or below.`,
        fragment: `you rated ${misses} solves ${LOW_CONFIDENCE} or below`,
      };
    case 'unfinished':
      return {
        value,
        observations: misses,
        detail: `${misses} of ${opportunities} questions you opened here were skipped or left unfinished.`,
        fragment: `${misses} ${plural(misses, 'question', 'questions')} here went unfinished`,
      };
    case 'pace':
      return {
        value,
        observations: misses,
        detail: `${misses} of ${opportunities} timed solves took at least ${SLOW_RATIO}x the estimate.`,
        fragment: `${misses} timed solves ran long`,
      };
    case 'hints':
      return {
        value,
        observations: misses,
        // Framed as what it is — a record of where support was needed, never a cost. Hint use
        // carries no XP penalty anywhere in this product and must not read like one here.
        detail: `You reached for the hint ladder on ${misses} of ${opportunities} solves here.`,
        fragment: `${misses} solves needed the hint ladder`,
      };
    case 'transfer':
      return {
        value,
        observations: misses,
        detail: `${misses} of ${opportunities} problems in families you had already met did not carry over.`,
        fragment: `${misses} familiar-family ${plural(misses, 'problem', 'problems')} did not carry over`,
      };
    default:
      return null;
  }
}

/**
 * Fold the fired signals into one score.
 *
 * The denominator is the fired weight, floored at MIN_EVIDENCE_WEIGHT. Above the floor this is a
 * plain weighted mean of the signals that had something to say — a pattern is not penalized for
 * evidence that does not exist (rule 4). Below it, dividing by the floor instead of by the fired
 * weight is what stops one metric producing a maximal claim (rule 3).
 */
function combine(readings: { id: WeaknessSignalId; reading: Reading }[]): {
  score: number;
  signals: WeaknessSignal[];
} {
  const firedWeight = readings.reduce((sum, r) => sum + SIGNAL_WEIGHTS[r.id], 0);
  const denominator = Math.max(firedWeight, MIN_EVIDENCE_WEIGHT);

  const signals = readings
    .map(({ id, reading }) => ({
      id,
      label: SIGNAL_LABEL[id],
      value: reading.value,
      weight: SIGNAL_WEIGHTS[id],
      contribution: (SIGNAL_WEIGHTS[id] * reading.value) / denominator,
      observations: reading.observations,
      detail: reading.detail,
    }))
    .sort((a, b) => b.contribution - a.contribution || a.id.localeCompare(b.id));

  return { score: signals.reduce((sum, s) => sum + s.contribution, 0), signals };
}

/* ------------------------------------------------------------------------------------------- */
/* The model                                                                                    */
/* ------------------------------------------------------------------------------------------- */

/**
 * Every pattern the evidence says is not holding, weakest first.
 *
 * A pattern with no negative evidence does not appear at all. That is the point: the list is
 * "where the record says to look", not a ranking of all 28 patterns with the top of it relabelled
 * as a problem.
 */
export function patternWeakness(input: WeaknessInput): PatternWeakness[] {
  const { today, all, byId, drills, families } = input;
  const questionById = new Map(all.map((q) => [q.id, q]));
  const tallies = new Map<PatternId, Tallies>();
  const known = new Set<string>(PATTERNS.map((p) => p.id));

  const forPattern = (pattern: PatternId): Tallies => {
    let entry = tallies.get(pattern);
    if (!entry) {
      entry = emptyTallies();
      tallies.set(pattern, entry);
    }
    return entry;
  };

  // --- Recognition: drill misses, dated by the day they were recorded ------------------------
  for (const [date, day] of Object.entries(drills)) {
    const weight = recency(today, date);
    for (const pattern of day.missedPatterns) {
      if (!known.has(pattern)) continue;
      countMiss(forPattern(pattern as PatternId).recognition, weight, date);
    }
  }

  // --- Everything the question record knows --------------------------------------------------
  for (const question of all) {
    const progress = byId[question.id];
    if (!progress) continue; // untouched: no evidence, not zero evidence
    const t = forPattern(question.pattern);
    const solvedOn = progress.completedAt;

    // Retention — each graded recall carries its own date, so this is the best-dated signal here.
    for (const event of progress.revisionHistory) {
      record(t.retention, recency(today, event.date), event.passed ? 0 : 1, event.date);
    }

    // Unfinished — a skipped or abandoned question is a standing state with no date of its own.
    // "Abandoned" deliberately means "opened the hint ladder and never finished", not merely
    // "opened": opening a question is how you read it.
    if (progress.status !== 'unsolved') {
      const abandoned =
        progress.status === 'skipped' ||
        (progress.status === 'in_progress' && (progress.hintLevelUsed ?? 0) > 0);
      record(t.unfinished, UNDATED_WEIGHT, abandoned ? 1 : 0, null);
    }

    if (progress.status !== 'solved') continue;
    const weight = recency(today, solvedOn);

    // Confidence — recorded at the solve, so the solve date is its date.
    if (progress.confidence !== null) {
      record(t.confidence, weight, progress.confidence <= LOW_CONFIDENCE ? 1 : 0, solvedOn);
    }

    // Pace — only questions actually measured by a focus session contribute. An unmeasured solve
    // is not a measurement of zero (the rule engine/timeEstimate.ts already enforces).
    if (progress.timeSpentMin > 0 && question.estimatedTime > 0) {
      const ratio = progress.timeSpentMin / question.estimatedTime;
      if (ratio <= MAX_PLAUSIBLE_RATIO) {
        record(t.pace, weight, ratio >= SLOW_RATIO ? 1 : 0, solvedOn);
      }
    }

    // Hints — graded by how far down the ladder the question went, not by whether it was used.
    const rung = progress.hintLevelUsed ?? 0;
    record(t.hints, weight, Math.min(1, rung / 3), solvedOn);
  }

  // --- Transfer: did an idea already met carry to its next disguise? --------------------------
  for (const family of families) {
    const solved = family.members
      .map((m) => ({ id: m.questionId, progress: byId[m.questionId] }))
      .filter((m) => m.progress?.status === 'solved')
      .sort((a, b) => (a.progress!.completedAt ?? '').localeCompare(b.progress!.completedAt ?? ''));

    // The first solve in a family is where the idea is met. There is nothing to transfer to it.
    const first = solved[0];
    if (!first) continue;

    for (const member of family.members) {
      if (member.questionId === first.id) continue;
      const question = questionById.get(member.questionId);
      const progress = byId[member.questionId];
      if (!question || !progress) continue;
      const t = forPattern(question.pattern);

      if (progress.status === 'solved') {
        const neededTechnique = (progress.hintLevelUsed ?? 0) >= TRANSFER_HINT_RUNG;
        const lostItFirstTime = progress.revisionHistory[0]?.passed === false;
        record(
          t.transfer,
          recency(today, progress.completedAt),
          neededTechnique || lostItFirstTime ? 1 : 0,
          progress.completedAt,
        );
      } else if (progress.status === 'skipped') {
        record(t.transfer, UNDATED_WEIGHT, 1, null);
      }
      // Not yet reached is not a failure to transfer — it is simply not evidence.
    }
  }

  const out: PatternWeakness[] = [];
  for (const [pattern, t] of tallies) {
    const readings = (Object.keys(SIGNAL_WEIGHTS) as WeaknessSignalId[])
      .map((id) => ({ id, reading: read(id, t[id], today) }))
      .filter((r): r is { id: WeaknessSignalId; reading: Reading } => r.reading !== null);

    if (readings.length === 0) continue;
    const { score, signals } = combine(readings);
    if (score <= 0) continue;

    const byContribution = [...readings].sort(
      (a, b) =>
        SIGNAL_WEIGHTS[b.id] * b.reading.value - SIGNAL_WEIGHTS[a.id] * a.reading.value ||
        a.id.localeCompare(b.id),
    );

    out.push({
      id: pattern,
      name: PATTERNS.find((p) => p.id === pattern)?.name ?? pattern,
      score,
      signals,
      summary: byContribution
        .slice(0, 2)
        .map((r) => r.reading.fragment)
        .join(' and '),
    });
  }

  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------------------------------- */
/* Transfer, reported on its own                                                                */
/* ------------------------------------------------------------------------------------------- */

/** Below this the transfer record is one or two problems, which is an anecdote. */
export const MIN_TRANSFER_OBSERVATIONS = 5;

export interface TransferRecord {
  /** Problems taken on in a family whose idea the learner had already solved once. */
  met: number;
  /** How many of those were solved without the technique hint and held their first recall. */
  carried: number;
  /** Null below MIN_TRANSFER_OBSERVATIONS: the count is a fact, the rate would be an anecdote. */
  rate: number | null;
}

/**
 * "Can I solve unfamiliar problems?" answered with the only honest transfer material in the
 * dataset: problems that share a verified underlying idea with something already solved. Picking
 * an arbitrary unsolved question and calling it transfer would not be a measurement.
 *
 * Null only when the learner has never met a second problem in a family they had already solved
 * from — otherwise the counts are returned with `rate` suppressed, so the page can say how far off
 * measurable it is instead of showing nothing.
 */
export function transferRecord(
  all: Question[],
  byId: Record<number, QuestionProgress>,
  families: ProblemFamily[],
): TransferRecord | null {
  const questionById = new Map(all.map((q) => [q.id, q]));
  let met = 0;
  let carried = 0;

  for (const family of families) {
    const solved = family.members
      .map((m) => ({ id: m.questionId, progress: byId[m.questionId] }))
      .filter((m) => m.progress?.status === 'solved')
      .sort((a, b) => (a.progress!.completedAt ?? '').localeCompare(b.progress!.completedAt ?? ''));

    const first = solved[0];
    if (!first) continue;

    for (const member of solved) {
      if (member.id === first.id) continue;
      if (!questionById.has(member.id)) continue;
      met += 1;
      const progress = member.progress!;
      const neededTechnique = (progress.hintLevelUsed ?? 0) >= TRANSFER_HINT_RUNG;
      const lostItFirstTime = progress.revisionHistory[0]?.passed === false;
      if (!neededTechnique && !lostItFirstTime) carried += 1;
    }
  }

  if (met === 0) return null;
  return { met, carried, rate: met < MIN_TRANSFER_OBSERVATIONS ? null : carried / met };
}
