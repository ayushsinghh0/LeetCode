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
//
// The same rule governs the measurement functions in the second half of the file. They exist
// because the analytics page has to answer five questions in order — am I showing up, am I
// getting faster, am I getting more accurate, can I solve unfamiliar problems, what next — and
// each of those is a claim that can be made too early. Every one of them returns `null` below a
// stated floor so the page can say "not measurable yet, here is what it would take" instead of
// printing a confident number over four data points.
import type {
  CourseWeekProgress,
  DayLog,
  DrillDayResult,
  Question,
  QuestionProgress,
} from '@/types';
import { addDays, diffDays } from '@/utils/dates';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';
import { MIN_SAMPLES, paceSamples } from '@/utils/engine/timeEstimate';
import type { PatternWeakness } from '@/utils/engine/weakness';

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
export const MIN_DRILLS = 3;       // recognition signal needs a few recorded days
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
// The weakness model already refuses to score a pattern without repeated evidence, so this floor
// is not a second evidence gate — it is an editorial one. Below it the model has enough to break
// a tie in the session planner and not enough to make the page's headline finding.
const WEAK_SCORE_FLOOR = 0.3;
const MIN_PACE_SAMPLES = 8;        // above timeEstimate's MIN_SAMPLES — a claim about *you* is stronger
const PACE_DEVIATION = 0.15;       // 15% off the book estimate before it is worth saying
const OVERLOAD_FACTOR = 1.5;       // a future day is "heavy" at 1.5x the daily budget
const UNTESTED_RATIO = 0.4;        // share of solves never recalled before it is worth flagging
const MIN_SOLVED_FOR_UNTESTED = 12;
const MIN_CONSISTENCY_DAYS = 4;    // active days across the two compared weeks

const pct = (n: number) => `${Math.round(n * 100)}%`;

export interface InsightInput {
  today: string;
  all: Question[];
  byId: Record<number, QuestionProgress>;
  dayLogs: Record<string, DayLog>;
  drills: Record<string, DrillDayResult>;
  /** The one weakness model (engine/weakness.ts), weakest first. Never a second ranking. */
  weakness: PatternWeakness[];
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
  const drill = recognitionRecord(input.drills);
  if (!drill) return null;

  let passes = 0;
  let attempts = 0;
  for (const p of Object.values(input.byId)) {
    for (const ev of p.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }
  if (attempts < MIN_REVISION_ATTEMPTS) return null;

  const implementation = passes / attempts;
  // Compared on the chance-corrected scale; reported to the learner as the raw rates they can
  // actually see on the drill and revision screens.
  const gapPp = Math.round((aboveChance(implementation) - drill.aboveChance) * 100);

  const evidence = [
    `Recognition (drills): ${pct(drill.rate)} over ${drill.total} prompts across ${drill.days} days, against ${pct(DRILL_CHANCE)} for guessing.`,
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
// Reads the one weakness model. There is deliberately no scoring here: a card that ranked
// patterns by its own formula would be a second weakness model, and two of those disagreeing
// about the same learner is the failure engine/weakness.ts exists to prevent.
function weakestPattern(input: InsightInput): Insight | null {
  const worst = input.weakness[0];
  if (!worst || worst.score < WEAK_SCORE_FLOOR) return null;

  return {
    id: `weak-pattern-${worst.id}`,
    headline: `${worst.name} is the pattern your record says to work on.`,
    // The model's own explanation, verbatim. Every line carries its numbers.
    evidence: worst.signals.slice(0, 3).map((s) => s.detail),
    recommendation:
      `Re-derive the ${worst.name} questions already on your ladder before taking new ones. ` +
      'Adding volume on a pattern that is not sticking buys nothing.',
    action: { label: `Open ${worst.name}`, href: `/patterns/${worst.id}` },
    tone: 'attention',
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Thursday Aug 20" — date-fns 'EEEE MMM d', hand-rolled. This is the engine's only date
// formatting, and importing date-fns for it dragged the format machinery into the main chunk
// (insights is eagerly reachable through selectors.ts).
function weekdayMonthDay(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${MONTHS[m - 1]} ${d}`;
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
    headline: `${weekdayMonthDay(heaviest.date)} is carrying more review than a normal day fits.`,
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
  const figure = paceAgainstEstimate(paceSamples(input.all, input.byId));
  // The figure appears on the page at the estimator's own floor; a *headline claim* about the
  // learner's pace waits for more than that.
  if (!figure || figure.samples < MIN_PACE_SAMPLES) return null;

  const { ratio, samples } = figure;
  if (Math.abs(ratio - 1) < PACE_DEVIATION) return null;

  const faster = ratio < 1;
  const deltaPct = Math.round(Math.abs(1 - ratio) * 100);

  return {
    id: 'pace',
    headline: faster
      ? `You finish problems about ${deltaPct}% faster than the book estimate.`
      : `Problems are taking you about ${deltaPct}% longer than the book estimate.`,
    evidence: [
      `Measured over ${samples} timed solves.`,
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
  const coverage = solveCoverage(input.byId);
  if (coverage.solved < MIN_SOLVED_FOR_UNTESTED) return null;

  const ratio = coverage.untested / coverage.solved;
  if (ratio < UNTESTED_RATIO) return null;

  return {
    id: 'untested-solves',
    headline: 'Most of what you have solved has never been tested.',
    evidence: [
      `${coverage.untested} of ${coverage.solved} solved questions have no recall attempt yet.`,
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

// 7. Confidence calibration -----------------------------------------------------------------
// Whether the learner's own prediction is worth anything. This is the finding most likely to
// change behaviour and the one most easily faked: a calibration claim from four observations
// reads authoritative and means nothing, so it is floored hard and says so when suppressed.
function calibration(input: InsightInput): Insight | null {
  const report = confidenceCalibration(input.byId);
  if (!report) return null;

  if (report.verdict === 'overconfident' && report.high) {
    return {
      id: 'calibration',
      headline: 'Your "I have this" rating is not predicting the recall.',
      evidence: [
        `Solves you rated ${HIGH_CONFIDENCE} or ${HIGH_CONFIDENCE + 1} passed their first recall ${pct(report.high.passRate)} of the time, over ${report.high.observations} of them.`,
        report.low
          ? `Solves you rated ${LOW_CONFIDENCE} or below passed ${pct(report.low.passRate)} of the time, over ${report.low.observations}.`
          : 'Measured against the first graded recall after each solve — the one the rating was predicting.',
      ],
      recommendation:
        'Rate lower, or review the confident ones anyway. The rating is an input to what gets ' +
        'reviewed first, so an optimistic one quietly removes work you needed.',
      action: { label: 'Open revisions', href: '/revision' },
      tone: 'attention',
    };
  }

  if (report.verdict === 'underconfident' && report.low) {
    return {
      id: 'calibration',
      headline: 'You know more than you are giving yourself credit for.',
      evidence: [
        `Solves you rated ${LOW_CONFIDENCE} or below still passed their first recall ${pct(report.low.passRate)} of the time, over ${report.low.observations} of them.`,
        report.high
          ? `Solves you rated ${HIGH_CONFIDENCE} or above passed ${pct(report.high.passRate)} of the time.`
          : 'Measured against the first graded recall after each solve — the one the rating was predicting.',
      ],
      recommendation:
        'Trust the ladder over the feeling. Rating everything low front-loads reviews you do not ' +
        'need and crowds out the new questions you could be taking.',
      action: { label: 'Open the roadmap', href: '/roadmap' },
      tone: 'steady',
    };
  }

  return null;
}

/**
 * Every finding the evidence currently supports, most actionable first. `[0]` is the page's
 * primary insight — the one thing worth reading before any figure on the page.
 *
 * `extraActiveDates` carries course activity (session stamps and review grades), which is
 * derived rather than logged — the same rule the streak and heatmap follow.
 */
export function buildInsights(input: InsightInput, extraActiveDates: ReadonlySet<string> = new Set()): Insight[] {
  const candidates = [
    recognitionGap(input),
    weakestPattern(input),
    scheduleRisk(input),
    calibration(input),
    untestedSolves(input),
    pace(input),
    weeklyConsistency(input, extraActiveDates),
  ];

  const order: Record<InsightTone, number> = { attention: 0, steady: 1, strength: 2 };
  return candidates
    .filter((c): c is Insight => c !== null)
    .sort((a, b) => order[a.tone] - order[b.tone]);
}

/* ============================================================================================ */
/* Measurements                                                                                 */
/*                                                                                              */
/* The figures the analytics page reads directly. Same discipline as the builders above: each   */
/* states its floor, returns null under it, and reports what it was measured over.              */
/* ============================================================================================ */

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/* --- Am I showing up? ---------------------------------------------------------------------- */

export interface StudyTime {
  /** Focus-timer minutes over the window. DayLog.focusMinutes is the canonical time ledger. */
  minutes: number;
  solves: number;
  reviews: number;
  /** Days in the window with any DSA activity logged. */
  activeDays: number;
  windowDays: number;
}

/**
 * What the study time bought, next to the time itself.
 *
 * §33's rule: a bare total is not a metric. "You spent 6 hours" answers nothing; "6 hours, 14
 * solves and 22 recalls" is a rate the learner can act on. Per-question minutes
 * (QuestionProgress.timeSpentMin) are a breakdown of these same minutes and are deliberately not
 * added to them — see the time-attribution invariant in CLAUDE.md.
 */
export function studyTime(
  dayLogs: Record<string, DayLog>,
  today: string,
  windowDays: number,
): StudyTime {
  let minutes = 0;
  let solves = 0;
  let reviews = 0;
  let activeDays = 0;
  for (let i = 0; i < windowDays; i++) {
    const log = dayLogs[addDays(today, -i)];
    if (!log) continue;
    minutes += log.focusMinutes;
    solves += log.solvedIds.length;
    reviews += log.revisionsPassed.length + log.revisionsFailed.length;
    if (log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length > 0) {
      activeDays += 1;
    }
  }
  return { minutes, solves, reviews, activeDays, windowDays };
}

/* --- Am I getting faster? ------------------------------------------------------------------ */

export interface PaceAgainstEstimate {
  /** Median actual/estimated. Below 1 is faster than the dataset's authored figure. */
  ratio: number;
  samples: number;
}

/**
 * How this learner's minutes relate to the authored estimates, at the same floor
 * engine/timeEstimate.ts uses before it will personalize anything (MIN_SAMPLES). Below it there
 * is a dataset estimate and an honest silence — never an average over two solves.
 */
export function paceAgainstEstimate(samples: { ratio: number }[]): PaceAgainstEstimate | null {
  if (samples.length < MIN_SAMPLES) return null;
  return { ratio: median(samples.map((s) => s.ratio)), samples: samples.length };
}

/**
 * Each half of the comparison must independently clear the floor engine/timeEstimate.ts requires
 * for any personal pace claim at all, plus one — so neither half's median is a single
 * observation wearing a trend line.
 */
export const MIN_PACE_TREND_SAMPLES = MIN_SAMPLES + 1;

/** Medians move on rounding; below this the two halves are the same number. */
const PACE_TREND_BAND = 0.1;

export interface PaceTrend {
  /** Median actual/estimated over the most recent half of timed solves. */
  recent: number;
  prior: number;
  /** Positive = getting faster. Percentage points of the ratio. */
  deltaPct: number;
  verdict: 'faster' | 'slower' | 'steady';
  samples: number;
}

/**
 * Mirrors the measurement engine/timeEstimate.ts makes (`timeSpentMin / estimatedTime`, same
 * implausible-sample guard), carrying the solve date. The estimator deliberately returns undated
 * samples — an *estimate* has no use for when the solve happened — but a *trend* is nothing
 * without it. If the guard there changes, change it here.
 */
const MAX_PLAUSIBLE_RATIO = 6;

function datedPaceSamples(
  all: Question[],
  byId: Record<number, QuestionProgress>,
): { date: string; ratio: number }[] {
  const out: { date: string; ratio: number }[] = [];
  for (const q of all) {
    const p = byId[q.id];
    if (!p || p.status !== 'solved' || p.timeSpentMin <= 0 || q.estimatedTime <= 0) continue;
    if (p.completedAt === null) continue;
    const ratio = p.timeSpentMin / q.estimatedTime;
    if (ratio > MAX_PLAUSIBLE_RATIO) continue;
    out.push({ date: p.completedAt, ratio });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function paceTrend(all: Question[], byId: Record<number, QuestionProgress>): PaceTrend | null {
  const samples = datedPaceSamples(all, byId);
  if (samples.length < MIN_PACE_TREND_SAMPLES * 2) return null;

  const split = Math.floor(samples.length / 2);
  const prior = median(samples.slice(0, split).map((s) => s.ratio));
  const recent = median(samples.slice(split).map((s) => s.ratio));
  const delta = prior - recent; // positive = the ratio came down = faster

  return {
    recent,
    prior,
    deltaPct: Math.round(delta * 100),
    verdict: Math.abs(delta) < PACE_TREND_BAND ? 'steady' : delta > 0 ? 'faster' : 'slower',
    samples: samples.length,
  };
}

/* --- Am I getting more accurate? ----------------------------------------------------------- */

/**
 * Ten graded recalls per half.
 *
 * Each half's pass rate resolves to 1/n, so at ten a single recall moves it ten points. The
 * verdict threshold below is derived from that resolution rather than fixed, which means the
 * claim tightens on its own as the record grows instead of staying at whatever number looked
 * reasonable on the day it was written.
 */
export const MIN_TREND_ATTEMPTS = 10;

export interface AccuracyTrend {
  recent: { passRate: number; attempts: number };
  prior: { passRate: number; attempts: number };
  deltaPp: number;
  /** The delta the sample sizes can actually resolve. Anything inside it reads as steady. */
  noiseFloorPp: number;
  verdict: 'improving' | 'declining' | 'steady';
}

/**
 * Graded recalls over time, both tracks. Question revisions and course-week reviews climb the
 * same ladder and share the `revisionHistory` shape, so they blend into one accuracy record —
 * the same blending the pass-rate figure on this page already does.
 */
export function accuracyTrend(
  byId: Record<number, QuestionProgress>,
  courseByWeekId: Record<string, CourseWeekProgress> = {},
): AccuracyTrend | null {
  const events: { date: string; passed: boolean }[] = [];
  for (const p of [...Object.values(byId), ...Object.values(courseByWeekId)]) {
    for (const ev of p.revisionHistory) events.push(ev);
  }
  if (events.length < MIN_TREND_ATTEMPTS * 2) return null;

  events.sort((a, b) => a.date.localeCompare(b.date));
  const split = Math.floor(events.length / 2);
  const rate = (rows: { passed: boolean }[]) => rows.filter((r) => r.passed).length / rows.length;

  const priorRows = events.slice(0, split);
  const recentRows = events.slice(split);
  const prior = { passRate: rate(priorRows), attempts: priorRows.length };
  const recent = { passRate: rate(recentRows), attempts: recentRows.length };

  const deltaPp = Math.round((recent.passRate - prior.passRate) * 100);
  const noiseFloorPp = Math.ceil((1 / recent.attempts + 1 / prior.attempts) * 100);

  return {
    recent,
    prior,
    deltaPp,
    noiseFloorPp,
    verdict:
      Math.abs(deltaPp) <= noiseFloorPp ? 'steady' : deltaPp > 0 ? 'improving' : 'declining',
  };
}

/**
 * Eight observations in the bucket being reported on.
 *
 * The report is a pass rate, whose resolution is 1/n — at eight that is 12.5 percentage points,
 * comfortably inside the 25-point miscalibration thresholds it is compared against. Below eight
 * the headline could flip on a single recall, and "your confidence is not predicting anything" is
 * exactly the kind of claim that sounds authoritative while resting on nothing. Each bucket is
 * floored separately because each verdict rests on one bucket, not on the pooled total.
 */
export const MIN_CALIBRATION_SAMPLES = 8;

/** Confidence at or above this is a prediction of "I have this". */
export const HIGH_CONFIDENCE = 4;
/** At or below this the learner is saying they do not. */
export const LOW_CONFIDENCE = 2;

/** A quarter of the confident solves failing is a rating that is not carrying information. */
const OVERCONFIDENT_FAIL_RATE = 0.25;
/** Three quarters of the shaky ones passing is the same problem pointing the other way. */
const UNDERCONFIDENT_PASS_RATE = 0.75;

export interface CalibrationBucket {
  observations: number;
  passRate: number;
}

export interface CalibrationReport {
  /** Every confidence-rated solve that has since been graded once. */
  observations: number;
  /** Null below MIN_CALIBRATION_SAMPLES — the bucket exists but cannot be quoted yet. */
  high: CalibrationBucket | null;
  low: CalibrationBucket | null;
  /** Raw bucket sizes, so the UI can say how far off measurability the learner is. */
  highCount: number;
  lowCount: number;
  verdict: 'overconfident' | 'underconfident' | 'calibrated' | 'unmeasured';
}

/**
 * Does the learner's own prediction match what happened?
 *
 * One observation per question: the confidence rating is recorded at the solve, so the FIRST
 * graded recall after it is the thing that rating was predicting. Later recalls test a state the
 * prediction never described, and counting them would weight much-revised questions into the
 * verdict several times over.
 *
 * Returns null only when nothing has been rated and graded at all; otherwise it returns a report
 * whose `verdict` may be `unmeasured`, so the page can say "6 of 8" rather than nothing.
 */
export function confidenceCalibration(
  byId: Record<number, QuestionProgress>,
): CalibrationReport | null {
  let highTotal = 0;
  let highPassed = 0;
  let lowTotal = 0;
  let lowPassed = 0;
  let observations = 0;

  for (const p of Object.values(byId)) {
    if (p.status !== 'solved' || p.confidence === null) continue;
    const first = p.revisionHistory[0];
    if (!first) continue;
    observations += 1;
    if (p.confidence >= HIGH_CONFIDENCE) {
      highTotal += 1;
      if (first.passed) highPassed += 1;
    } else if (p.confidence <= LOW_CONFIDENCE) {
      lowTotal += 1;
      if (first.passed) lowPassed += 1;
    }
    // A rating of 3 is "not sure either way" and predicts nothing, so it is counted as an
    // observation and excluded from both buckets rather than pushed into one of them.
  }

  if (observations === 0) return null;

  const high =
    highTotal >= MIN_CALIBRATION_SAMPLES
      ? { observations: highTotal, passRate: highPassed / highTotal }
      : null;
  const low =
    lowTotal >= MIN_CALIBRATION_SAMPLES
      ? { observations: lowTotal, passRate: lowPassed / lowTotal }
      : null;

  const overshoot = high ? OVERCONFIDENT_FAIL_RATE - (1 - high.passRate) : 1;
  const undershoot = low ? low.passRate - UNDERCONFIDENT_PASS_RATE : -1;

  let verdict: CalibrationReport['verdict'] = 'unmeasured';
  if (high || low) {
    verdict = 'calibrated';
    // Both can be true at once; the larger deviation from its own threshold wins the headline,
    // and the report carries both buckets so the UI can show the other one as evidence.
    if (overshoot < 0 && -overshoot >= Math.max(undershoot, 0)) verdict = 'overconfident';
    else if (undershoot >= 0) verdict = 'underconfident';
  }

  return { observations, high, low, highCount: highTotal, lowCount: lowTotal, verdict };
}

/* --- Can I solve unfamiliar problems? ------------------------------------------------------ */

export interface RecognitionRecord {
  correct: number;
  total: number;
  days: number;
  rate: number;
  /** Share of the above-guessing range actually earned. A 4-option prompt floors at 25%. */
  aboveChance: number;
  chance: number;
}

/** Recognition on a cold read. Null under MIN_DRILLS recorded days — three days is the floor. */
export function recognitionRecord(drills: Record<string, DrillDayResult>): RecognitionRecord | null {
  const days = Object.values(drills);
  if (days.length < MIN_DRILLS) return null;
  const correct = days.reduce((s, d) => s + d.correct, 0);
  const total = days.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;
  const rate = correct / total;
  return { correct, total, days: days.length, rate, aboveChance: aboveChance(rate), chance: DRILL_CHANCE };
}

export interface SolveCoverage {
  solved: number;
  /** Solved and graded at least once. */
  tested: number;
  /** Solved, still on the ladder, never recalled. */
  untested: number;
  mastered: number;
  /** Solved without opening the hint ladder. A signal, never a penalty (see CLAUDE.md). */
  unaided: number;
}

/** Counts, not a claim — no floor, because "you have solved 3 questions" is simply true. */
export function solveCoverage(byId: Record<number, QuestionProgress>): SolveCoverage {
  let solved = 0;
  let tested = 0;
  let untested = 0;
  let mastered = 0;
  let unaided = 0;
  for (const p of Object.values(byId)) {
    if (p.status !== 'solved') continue;
    solved += 1;
    if (p.revisionHistory.length > 0) tested += 1;
    else if (p.revisionStage < MASTERED_STAGE) untested += 1;
    if (p.revisionStage >= MASTERED_STAGE) mastered += 1;
    if ((p.hintLevelUsed ?? 0) === 0) unaided += 1;
  }
  return { solved, tested, untested, mastered, unaided };
}

/* --- The other track ----------------------------------------------------------------------- */

export interface CourseRetention {
  /** Weeks cleared and therefore on the review ladder. */
  onLadder: number;
  /** Weeks that reached the top of the ladder. */
  retained: number;
  /** Cleared, on the ladder, and never once reviewed. */
  neverReviewed: number;
  attempts: number;
  passRate: number | null;
}

/**
 * The ML track measured the way the DSA track is measured.
 *
 * §32's rule: this must not be a decorative progress bar. Sessions completed says how much of the
 * syllabus was *attended*; only the ladder says how much of it is still there. `neverReviewed` is
 * the number that changes behaviour — a cleared week nobody has recalled is a week that has not
 * finished being learned.
 */
export function courseRetention(
  byWeekId: Record<string, CourseWeekProgress>,
): CourseRetention {
  let onLadder = 0;
  let retained = 0;
  let neverReviewed = 0;
  let attempts = 0;
  let passes = 0;

  for (const week of Object.values(byWeekId)) {
    const cleared = week.nextRevision !== null || week.revisionHistory.length > 0 || week.revisionStage >= MASTERED_STAGE;
    if (!cleared) continue;
    onLadder += 1;
    if (week.revisionStage >= MASTERED_STAGE) retained += 1;
    if (week.revisionHistory.length === 0) neverReviewed += 1;
    for (const ev of week.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }

  return { onLadder, retained, neverReviewed, attempts, passRate: attempts === 0 ? null : passes / attempts };
}
