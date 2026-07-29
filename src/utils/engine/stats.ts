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

function revisionPassRateOver(
  questions: Question[], byId: Record<number, QuestionProgress>
): number | null {
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
  return attempts === 0 ? null : passes / attempts;
}

interface GroupAggregate {
  total: number; solved: number; mastered: number; inRevision: number;
  remaining: number; pct: number; avgConfidence: number | null;
  revisionPassRate: number | null;
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
  const revisionPassRate = revisionPassRateOver(questions, byId);

  return { total, solved, mastered, inRevision, remaining, pct, avgConfidence, revisionPassRate };
}

export interface PatternStat {
  pattern: PatternId; total: number; solved: number; mastered: number;
  inRevision: number;          // solved, not mastered
  remaining: number; pct: number;              // solved/total * 100, rounded
  avgConfidence: number | null;                // over solved with confidence set
  revisionPassRate: number | null;             // passes / attempts across histories
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
}

export function difficultyStats(
  all: Question[], byId: Record<number, QuestionProgress>
): DifficultyStat[] {
  return DIFFICULTIES.map((difficulty) => {
    const questions = all.filter((q) => q.difficulty === difficulty);
    const { total, solved, pct, revisionPassRate } = aggregate(questions, byId);
    return { difficulty, total, solved, pct, revisionPassRate };
  });
}

export function overallRevisionPassRate(byId: Record<number, QuestionProgress>): number | null {
  let passes = 0;
  let attempts = 0;
  for (const p of Object.values(byId)) {
    for (const ev of p.revisionHistory) {
      attempts += 1;
      if (ev.passed) passes += 1;
    }
  }
  return attempts === 0 ? null : passes / attempts;
}

export function consistency(
  dayLogs: Record<string, DayLog>, today: string, windowDays = DEFAULT_WINDOW_DAYS
): number {
  let activeDays = 0;
  for (const log of Object.values(dayLogs)) {
    if (inWindow(log.date, today, windowDays) && hasActivity(log)) activeDays += 1;
  }
  return activeDays / windowDays;
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
  const passRate = overallRevisionPassRate(byId);
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
