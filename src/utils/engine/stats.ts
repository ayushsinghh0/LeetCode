import { PATTERNS } from '@/data/patterns';
import type { DayLog, Difficulty, PatternId, Question, QuestionProgress } from '@/types';
import { addDays, diffDays } from '@/utils/dates';
import { isMastered } from '@/utils/engine/spacedRepetition';
import { hasActivity, isPerfectDay } from '@/utils/engine/streak';

const DEFAULT_WINDOW_DAYS = 14;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function inWindow(date: string, today: string, windowDays: number): boolean {
  const delta = diffDays(today, date); // today - date
  return delta >= 0 && delta < windowDays;
}

/**
 * How many graded recalls a pass rate must rest on before this app prints it as a percentage.
 *
 * passes/attempts has resolution 1/attempts, so at one attempt the only readings are 0% and
 * 100%: "Pass rate 0%" off a single failed review is indistinguishable from 0% over forty. Five
 * is the app's existing floor for any personal figure (engine/timeEstimate.ts `MIN_SAMPLES`) and
 * the point at which one review moves the number by 20 points rather than by all of it.
 * engine/insights.ts holds a stricter floor of 10, but that one is the account-wide rate being
 * *compared* against a 15-point threshold; a per-pattern figure withheld until ten reviews land
 * inside a single pattern would be silence long past the point of usefulness.
 *
 * Every surface that reports or acts on a pass rate reads this one threshold — two surfaces
 * disagreeing about whether recall has been measured is the failure it exists to prevent.
 */
export const MIN_PASS_RATE_ATTEMPTS = 5;

/** Whether a pass rate has enough behind it to be stated as a figure rather than as a dash. */
export function isPassRateReportable(attempts: number): boolean {
  return attempts >= MIN_PASS_RATE_ATTEMPTS;
}

// Passes and attempts are returned together: the rate alone cannot say whether it is evidence,
// and every caller that shows the rate also has to show what it was measured over.
function revisionTally(
  questions: Question[], byId: Record<number, QuestionProgress>
): { passes: number; attempts: number } {
  let passes = 0;
  let attempts = 0;
  for (const q of questions) {
    const p = byId[q.id];
    if (!p) continue;
    for (const ev of p.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }
  return { passes, attempts };
}

interface GroupAggregate {
  total: number; solved: number; mastered: number; inRevision: number;
  remaining: number; pct: number; avgConfidence: number | null;
  revisionPassRate: number | null; revisionAttempts: number;
}

function aggregate(questions: Question[], byId: Record<number, QuestionProgress>): GroupAggregate {
  const total = questions.length;
  let solved = 0;
  let mastered = 0;
  let confSum = 0;
  let confCount = 0;

  for (const q of questions) {
    const p = byId[q.id];
    if (!p || p.status !== 'solved') continue;
    solved += 1;
    if (isMastered(p)) mastered += 1;
    if (p.confidence != null) {
      confSum += p.confidence;
      confCount += 1;
    }
  }

  const inRevision = solved - mastered;
  const remaining = total - solved;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  const avgConfidence = confCount === 0 ? null : confSum / confCount;
  const { passes, attempts } = revisionTally(questions, byId);
  const revisionPassRate = attempts === 0 ? null : passes / attempts;

  return {
    total, solved, mastered, inRevision, remaining, pct, avgConfidence,
    revisionPassRate, revisionAttempts: attempts,
  };
}

export interface PatternStat {
  pattern: PatternId; total: number; solved: number; mastered: number;
  inRevision: number;          // solved, not mastered
  remaining: number; pct: number;              // solved/total * 100, rounded
  avgConfidence: number | null;                // over solved with confidence set
  revisionPassRate: number | null;             // passes / attempts across histories
  revisionAttempts: number;                    // the denominator; never report the rate without it
}

export function patternStats(
  all: Question[], byId: Record<number, QuestionProgress>
): PatternStat[] {
  return PATTERNS.map(({ id }) => {
    const questions = all.filter((q) => q.pattern === id);
    return { pattern: id, ...aggregate(questions, byId) };
  });
}

export interface DifficultyStat {
  difficulty: Difficulty; total: number; solved: number; pct: number;
  revisionPassRate: number | null;
  revisionAttempts: number;                    // the denominator; never report the rate without it
}

export function difficultyStats(
  all: Question[], byId: Record<number, QuestionProgress>
): DifficultyStat[] {
  return DIFFICULTIES.map((difficulty) => {
    const questions = all.filter((q) => q.difficulty === difficulty);
    const { total, solved, pct, revisionPassRate, revisionAttempts } = aggregate(questions, byId);
    return { difficulty, total, solved, pct, revisionPassRate, revisionAttempts };
  });
}

// Accepts any ladder-bearing records — question progress and course-week progress share the
// revisionHistory shape, so a caller can blend both tracks into one rate.
export function overallRevisionPassRate(
  items: Iterable<{ revisionHistory: { date: string; passed: boolean }[] }>,
): number | null {
  let passes = 0;
  let attempts = 0;
  for (const p of items) {
    for (const ev of p.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }
  return attempts === 0 ? null : passes / attempts;
}

// `extraActiveDates` mirrors computeStreaks: activity outside dayLogs (course sessions and
// reviews) counts toward a day being active. productivityScore deliberately omits it — that
// formula is locked DSA spec.
export function consistency(
  dayLogs: Record<string, DayLog>, today: string, windowDays = DEFAULT_WINDOW_DAYS,
  extraActiveDates?: ReadonlySet<string>,
): number {
  const activeDates = new Set<string>();
  for (const log of Object.values(dayLogs)) {
    if (inWindow(log.date, today, windowDays) && hasActivity(log)) activeDates.add(log.date);
  }
  for (const date of extraActiveDates ?? []) {
    if (inWindow(date, today, windowDays)) activeDates.add(date);
  }
  return activeDates.size / windowDays;
}

export function goalRate(
  dayLogs: Record<string, DayLog>, today: string, perDay: number, windowDays = DEFAULT_WINDOW_DAYS
): number {
  let perfectDays = 0;
  for (const log of Object.values(dayLogs)) {
    if (inWindow(log.date, today, windowDays) && isPerfectDay(log, perDay)) perfectDays += 1;
  }
  return perfectDays / windowDays;
}

function hasSolveActivityInWindow(
  dayLogs: Record<string, DayLog>, today: string, windowDays: number
): boolean {
  for (const log of Object.values(dayLogs)) {
    if (inWindow(log.date, today, windowDays) && log.solvedIds.length > 0) return true;
  }
  return false;
}

export function productivityScore(
  dayLogs: Record<string, DayLog>, byId: Record<number, QuestionProgress>, perDay: number, today: string
): number {
  const consistency14 = consistency(dayLogs, today, DEFAULT_WINDOW_DAYS);
  const goalRate14 = goalRate(dayLogs, today, perDay, DEFAULT_WINDOW_DAYS);
  const passRate = overallRevisionPassRate(Object.values(byId));
  const passRateTerm = passRate !== null
    ? passRate
    : hasSolveActivityInWindow(dayLogs, today, DEFAULT_WINDOW_DAYS) ? 0.5 : 0;

  return Math.round(100 * (0.40 * consistency14 + 0.35 * goalRate14 + 0.25 * passRateTerm));
}

export function solvedPerDaySeries(
  dayLogs: Record<string, DayLog>, today: string, days: number
): { date: string; solved: number; revisions: number }[] {
  const series: { date: string; solved: number; revisions: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const log = dayLogs[date];
    series.push({
      date,
      solved: log ? log.solvedIds.length : 0,
      revisions: log ? log.revisionsPassed.length + log.revisionsFailed.length : 0,
    });
  }
  return series;
}
