// Analytics that decide something.
//
// The structure is Avinash Kaushik's "action dashboard": every card carries the interpretation
// in plain English, the evidence behind it, and the step to take — and the step is a button that
// performs the work, not a link to where the work could be arranged. A chart with no reading and
// no recommendation is a data puke; this module refuses to emit one.
//
// The rule that keeps it honest: **a card with insufficient evidence is suppressed, never
// padded**. Each builder below states its own minimum sample, returns null under it, and the
// analytics surface renders whatever survives. An empty result is a legitimate outcome and the
// UI says "not enough history yet" rather than inventing a finding.
import type { DayLog, DrillDayResult, PatternId, Question, QuestionProgress } from '@/types';
import { format, parseISO } from 'date-fns';
import { PATTERNS } from '@/data/patterns';
import { addDays, diffDays } from '@/utils/dates';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';
import type { PatternStat } from '@/utils/engine/stats';
import { paceSamples } from '@/utils/engine/timeEstimate';

export type InsightTone = 'attention' | 'steady' | 'strength';

export interface Insight {
  id: string;
  /** The reading, in the learner's language. A claim, not a metric name. */
  headline: string;
  /** The numbers the headline rests on. Each string is one line of support. */
  evidence: string[];
  /** What to do about it. Imperative, specific, and sized. */
  recommendation: string;
  action: { label: string; href: string };
  tone: InsightTone;
}

// --- thresholds, all in one place so the honesty budget is auditable ---------------------
const MIN_DRILLS = 3;              // recognition signal needs a few recorded days
// The implementation figure is passes/attempts, so its resolution is 1/attempts. At 6 attempts
// that is ±17pp — coarser than the 15pp threshold it is compared against, i.e. the gap could be
// entirely quantization. 10 attempts puts the resolution (10pp) inside the threshold.
const MIN_REVISION_ATTEMPTS = 10;
const RECOGNITION_GAP_PP = 15;     // percentage points before "recognition is the bottleneck"
// A drill prompt is 4-option multiple choice, so pure guessing scores ~25% while a graded recall
// floors at 0%. Comparing the raw rates is a category error biased toward "implementation gap".
// Both are rescaled to "share of the above-chance range actually earned" before differencing.
const DRILL_OPTIONS = 4;
const DRILL_CHANCE = 1 / DRILL_OPTIONS;

function aboveChance(rate: number): number {
  return Math.max(0, (rate - DRILL_CHANCE) / (1 - DRILL_CHANCE));
}
const MIN_PATTERN_SOLVES = 4;      // before naming a pattern weak
const WEAK_PASS_RATE = 0.7;
const MIN_PACE_SAMPLES = 8;        // above timeEstimate's MIN_SAMPLES — a claim about *you* is stronger
const PACE_DEVIATION = 0.15;       // 15% off the book estimate before it is worth saying
const OVERLOAD_FACTOR = 1.5;       // a future day is "heavy" at 1.5x the daily budget
const UNTESTED_RATIO = 0.4;        // share of solves never recalled before it is worth flagging
const MIN_SOLVED_FOR_UNTESTED = 12;
const MIN_CONSISTENCY_DAYS = 4;    // active days across the two compared weeks

const pct = (n: number) => `${Math.round(n * 100)}%`;
const patternName = (id: PatternId) => PATTERNS.find((p) => p.id === id)?.name ?? id;

export interface InsightInput {
  today: string;
  all: Question[];
  byId: Record<number, QuestionProgress>;
  dayLogs: Record<string, DayLog>;
  drills: Record<string, DrillDayResult>;
  patternStats: PatternStat[];
  /** Upcoming review load per date, from the predictor. */
  forecast: { date: string; count: number }[];
  /** Minutes the learner has said they can give a day. */
  capacityMin: number;
  /** Minutes the plan budgets for one revision, so forecast load converts to time. */
  revisionMinutes: number;
}

// 1. Recognition vs implementation ---------------------------------------------------------
// The single most useful thing this dataset can tell a learner: whether they fail at *seeing*
// which technique applies, or at *writing* it once seen. Drills measure the first; graded
// recalls measure the second. Comparing them is only meaningful when both have real samples.
function recognitionGap(input: InsightInput): Insight | null {
  const drillDays = Object.values(input.drills);
  if (drillDays.length < MIN_DRILLS) return null;

  const drillCorrect = drillDays.reduce((s, d) => s + d.correct, 0);
  const drillTotal = drillDays.reduce((s, d) => s + d.total, 0);
  if (drillTotal === 0) return null;

  let passes = 0;
  let attempts = 0;
  for (const p of Object.values(input.byId)) {
    for (const ev of p.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }
  if (attempts < MIN_REVISION_ATTEMPTS) return null;

  const recognition = drillCorrect / drillTotal;
  const implementation = passes / attempts;
  // Compared on the chance-corrected scale; reported to the learner as the raw rates they can
  // actually see on the drill and revision screens.
  const gapPp = Math.round((aboveChance(implementation) - aboveChance(recognition)) * 100);

  const evidence = [
    `Recognition (drills): ${pct(recognition)} over ${drillTotal} prompts across ${drillDays.length} days, against ${pct(DRILL_CHANCE)} for guessing.`,
    `Implementation (graded recalls): ${pct(implementation)} over ${attempts} attempts.`,
  ];

  if (gapPp >= RECOGNITION_GAP_PP) {
    return {
      id: 'recognition-gap',
      headline: 'Naming the pattern is your bottleneck, not writing it.',
      evidence,
      recommendation:
        `You solve what you recognize — you are ${gapPp} points weaker at spotting it. ` +
        'Run the recognition drill before adding harder problems.',
      action: { label: 'Start a drill', href: '/drills' },
      tone: 'attention',
    };
  }
  if (gapPp <= -RECOGNITION_GAP_PP) {
    return {
      id: 'implementation-gap',
      headline: 'You spot the pattern; the code is where it breaks down.',
      evidence,
      recommendation:
        `Recognition leads implementation by ${Math.abs(gapPp)} points. ` +
        'Re-derive due questions in full rather than skimming — the gap is in writing, not seeing.',
      action: { label: 'Open revisions', href: '/revision' },
      tone: 'attention',
    };
  }
  return {
    id: 'recognition-balanced',
    headline: 'Recognition and implementation are moving together.',
    evidence,
    recommendation: 'Nothing to correct here — keep the current mix and push difficulty instead.',
    action: { label: 'Open the roadmap', href: '/roadmap' },
    tone: 'strength',
  };
}

// 2. Weakest pattern ------------------------------------------------------------------------
function weakestPattern(input: InsightInput): Insight | null {
  const candidates = input.patternStats
    .filter((s) => s.solved >= MIN_PATTERN_SOLVES && s.revisionPassRate !== null)
    .filter((s) => s.revisionPassRate! < WEAK_PASS_RATE)
    .sort((a, b) => a.revisionPassRate! - b.revisionPassRate!);

  const worst = candidates[0];
  if (!worst) return null;

  const drillMisses = Object.values(input.drills)
    .flatMap((d) => d.missedPatterns)
    .filter((p) => p === worst.pattern).length;

  const evidence = [
    `${patternName(worst.pattern)}: ${pct(worst.revisionPassRate!)} of recalls passed, against ${worst.solved} solved.`,
    drillMisses > 0
      ? `${drillMisses} drill ${drillMisses === 1 ? 'miss' : 'misses'} landed in this pattern.`
      : 'No drill misses recorded here — the weakness shows up in recall, not recognition.',
  ];

  return {
    id: `weak-pattern-${worst.pattern}`,
    headline: `${patternName(worst.pattern)} is not holding between reviews.`,
    evidence,
    recommendation:
      `Re-derive the ${patternName(worst.pattern)} questions already on your ladder before taking new ones. ` +
      'Adding volume on a pattern that is not sticking buys nothing.',
    action: { label: `Open ${patternName(worst.pattern)}`, href: `/patterns/${worst.pattern}` },
    tone: 'attention',
  };
}

// 3. Schedule risk --------------------------------------------------------------------------
// Forward-looking and fixable: the point is to rebalance BEFORE a heavy day arrives, which is
// the alternative to letting it become a wall of overdue work.
function scheduleRisk(input: InsightInput): Insight | null {
  if (input.capacityMin <= 0) return null;
  const threshold = (input.capacityMin * OVERLOAD_FACTOR) / input.revisionMinutes;

  const heaviest = [...input.forecast].sort((a, b) => b.count - a.count)[0];
  if (!heaviest || heaviest.count < threshold) return null;

  const minutes = Math.round(heaviest.count * input.revisionMinutes);
  const daysOut = diffDays(heaviest.date, input.today);

  return {
    id: 'schedule-risk',
    headline: `${format(parseISO(heaviest.date), 'EEEE MMM d')} is carrying more review than a normal day fits.`,
    evidence: [
      `${heaviest.count} reviews land that day — about ${minutes} minutes.`,
      `Your stated capacity is ${input.capacityMin} minutes a day.`,
      `It is ${daysOut} ${daysOut === 1 ? 'day' : 'days'} out, so it is still cheap to smooth.`,
    ],
    recommendation:
      'Pull a few of those reviews forward this week. Reviewing early is allowed and costs you ' +
      'nothing on the ladder — arriving to a day you cannot finish does.',
    action: { label: 'Open revisions', href: '/revision' },
    tone: 'attention',
  };
}

// 4. Pace -----------------------------------------------------------------------------------
function pace(input: InsightInput): Insight | null {
  const samples = paceSamples(input.all, input.byId);
  if (samples.length < MIN_PACE_SAMPLES) return null;

  const ratios = samples.map((s) => s.ratio).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const ratio = ratios.length % 2 === 0 ? (ratios[mid - 1]! + ratios[mid]!) / 2 : ratios[mid]!;
  if (Math.abs(ratio - 1) < PACE_DEVIATION) return null;

  const faster = ratio < 1;
  const deltaPct = Math.round(Math.abs(1 - ratio) * 100);

  return {
    id: 'pace',
    headline: faster
      ? `You finish problems about ${deltaPct}% faster than the book estimate.`
      : `Problems are taking you about ${deltaPct}% longer than the book estimate.`,
    evidence: [
      `Measured over ${samples.length} timed solves.`,
      'Based on focus-session minutes attributed to each question.',
    ],
    recommendation: faster
      ? 'Your daily plan is under-filled. Raise your capacity or reach for harder variants — the estimates are now personalized to your pace.'
      : 'Plan fewer items rather than rushing them. Your capacity setting is the honest lever; the estimates already account for your pace.',
    action: { label: 'Adjust capacity', href: '/settings' },
    tone: faster ? 'strength' : 'steady',
  };
}

// 5. Untested solves ------------------------------------------------------------------------
function untestedSolves(input: InsightInput): Insight | null {
  const solved = Object.values(input.byId).filter((p) => p.status === 'solved');
  if (solved.length < MIN_SOLVED_FOR_UNTESTED) return null;

  const untested = solved.filter((p) => p.revisionHistory.length === 0 && p.revisionStage < MASTERED_STAGE);
  const ratio = untested.length / solved.length;
  if (ratio < UNTESTED_RATIO) return null;

  return {
    id: 'untested-solves',
    headline: 'Most of what you have solved has never been tested.',
    evidence: [
      `${untested.length} of ${solved.length} solved questions have no recall attempt yet.`,
      'Solving once and recalling later are different skills, and only the second one is measured.',
    ],
    recommendation:
      'Clear the review queue as it comes up rather than taking new questions. A solve you cannot ' +
      'reproduce in a week has not finished being learned.',
    action: { label: 'Open revisions', href: '/revision' },
    tone: 'steady',
  };
}

// 6. Weekly consistency ---------------------------------------------------------------------
// Deliberately weekly, not a streak: the headline unit is "how many days out of seven", which
// survives a missed day intact. There is no failure state here, only a comparison.
function weeklyConsistency(input: InsightInput, extraActiveDates: ReadonlySet<string>): Insight | null {
  // Both windows END YESTERDAY. Including today in the current week compares a day that is still
  // in progress against seven finished ones: a learner with perfect attendance who opens this
  // page before doing anything would be told they are showing up less often than last week —
  // a wrong, guilt-shaped card produced by an off-by-one, on the one surface that promises no
  // failure state.
  const activeIn = (startOffset: number) => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(input.today, -(startOffset + i));
      const log = input.dayLogs[date];
      const active =
        (log && (log.solvedIds.length > 0 || log.revisionsPassed.length > 0 || log.revisionsFailed.length > 0)) ||
        extraActiveDates.has(date);
      if (active) count += 1;
    }
    return count;
  };

  const thisWeek = activeIn(1);  // today-1 … today-7
  const lastWeek = activeIn(8);  // today-8 … today-14

  // Same suppression discipline as every other builder: a comparison needs two weeks with
  // something in them. One active day out of fourteen is not a cadence.
  if (thisWeek + lastWeek < MIN_CONSISTENCY_DAYS) return null;

  const delta = thisWeek - lastWeek;
  const evidence = [
    `Active on ${thisWeek} of the 7 days up to yesterday.`,
    `The 7 days before that: ${lastWeek}.`,
  ];

  if (delta < 0) {
    return {
      id: 'consistency',
      headline: 'You are showing up less often than the week before.',
      evidence,
      recommendation:
        'Shrink the daily commitment rather than skipping days — one review beats a planned hour ' +
        'that does not happen. Set a smaller capacity and let the plan cut itself to fit.',
      action: { label: 'Adjust capacity', href: '/settings' },
      tone: 'steady',
    };
  }
  return {
    id: 'consistency',
    headline: delta > 0 ? 'You are showing up more often than last week.' : 'Your cadence is holding steady.',
    evidence,
    recommendation:
      'Cadence is the input that compounds — keep the same commitment size rather than raising it.',
    action: { label: 'Open today', href: '/today' },
    tone: 'strength',
  };
}

/**
 * Every finding the evidence currently supports, most actionable first.
 *
 * `extraActiveDates` carries course activity (session stamps and review grades), which is
 * derived rather than logged — the same rule the streak and heatmap follow.
 */
export function buildInsights(input: InsightInput, extraActiveDates: ReadonlySet<string> = new Set()): Insight[] {
  const candidates = [
    recognitionGap(input),
    weakestPattern(input),
    scheduleRisk(input),
    untestedSolves(input),
    pace(input),
    weeklyConsistency(input, extraActiveDates),
  ];

  const order: Record<InsightTone, number> = { attention: 0, steady: 1, strength: 2 };
  return candidates
    .filter((c): c is Insight => c !== null)
    .sort((a, b) => order[a.tone] - order[b.tone]);
}
