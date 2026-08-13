// Coverage of a company's published topics by the learner's actual practice.
//
// The claim this module is allowed to make is narrow and it holds it exactly: "of the roadmap
// patterns that correspond to the topics this company's own prep page names, here is how much
// you have covered." It is a statement about the learner's practice, cross-referenced against a
// quoted source — never a prediction, never a readiness score, and never a claim about which
// problems anyone will be asked.
import type { PatternId, Question, QuestionProgress } from '@/types';
import type { PatternStat } from '@/utils/engine/stats';
import { revisionMinutes } from '@/utils/engine/planner';

/** Solved share at or above this reads as covered; the pass rate has to hold up too. */
export const STRONG_PCT = 60;
export const STRONG_PASS_RATE = 0.7;
/** Below this, the pattern is worth naming as the gap. */
export const WEAK_PCT = 30;

export interface CompanyPatternCoverage {
  pattern: PatternId;
  solved: number;
  total: number;
  pct: number;
  /** Recall pass rate across this pattern, or null when nothing has been reviewed yet. */
  passRate: number | null;
  standing: 'strong' | 'developing' | 'gap';
}

export interface CompanyCoverage {
  patterns: CompanyPatternCoverage[];
  solved: number;
  total: number;
  pct: number;
  strong: PatternId[];
  gaps: PatternId[];
  /** Rough minutes to finish the unsolved questions in these patterns, at authored estimates. */
  remainingMinutes: number;
}

function standingOf(pct: number, passRate: number | null): CompanyPatternCoverage['standing'] {
  if (pct >= STRONG_PCT && (passRate === null || passRate >= STRONG_PASS_RATE)) return 'strong';
  if (pct < WEAK_PCT) return 'gap';
  return 'developing';
}

export function companyCoverage(
  patterns: PatternId[],
  stats: PatternStat[],
  all: Question[],
  byId: Record<number, QuestionProgress>,
): CompanyCoverage {
  const statByPattern = new Map(stats.map((s) => [s.pattern, s]));

  const rows: CompanyPatternCoverage[] = patterns.map((pattern) => {
    const stat = statByPattern.get(pattern);
    const total = stat?.total ?? 0;
    const solved = stat?.solved ?? 0;
    const pct = stat?.pct ?? 0;
    const passRate = stat?.revisionPassRate ?? null;
    return { pattern, solved, total, pct, passRate, standing: standingOf(pct, passRate) };
  });

  const solved = rows.reduce((sum, r) => sum + r.solved, 0);
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  const patternSet = new Set(patterns);
  const remainingMinutes = all
    .filter((q) => patternSet.has(q.pattern) && (byId[q.id]?.status ?? 'unsolved') !== 'solved')
    .reduce((sum, q) => sum + q.estimatedTime, 0);

  return {
    patterns: rows,
    solved,
    total,
    pct: total > 0 ? Math.round((solved / total) * 100) : 0,
    strong: rows.filter((r) => r.standing === 'strong').map((r) => r.pattern),
    gaps: rows.filter((r) => r.standing === 'gap').map((r) => r.pattern),
    remainingMinutes,
  };
}

/**
 * A practice set for one company: unsolved questions in its named patterns, gap patterns first,
 * easiest first inside a pattern so the set has an on-ramp rather than a wall.
 *
 * Explicitly NOT "questions this company asks". It is the roadmap's own material, filtered by
 * topics the company published, ordered by where this learner is weakest.
 */
export function companyPracticeSet(
  coverage: CompanyCoverage,
  all: Question[],
  byId: Record<number, QuestionProgress>,
  limit = 8,
): Question[] {
  const rank: Record<CompanyPatternCoverage['standing'], number> = { gap: 0, developing: 1, strong: 2 };
  const order = new Map(coverage.patterns.map((r) => [r.pattern, rank[r.standing]]));
  const difficultyRank = { easy: 0, medium: 1, hard: 2 } as const;

  return all
    .filter((q) => order.has(q.pattern) && (byId[q.id]?.status ?? 'unsolved') === 'unsolved')
    .sort((a, b) => {
      const byStanding = order.get(a.pattern)! - order.get(b.pattern)!;
      if (byStanding !== 0) return byStanding;
      const byDifficulty = difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
      if (byDifficulty !== 0) return byDifficulty;
      return a.id - b.id;
    })
    .slice(0, limit);
}

/** Minutes a practice set would take, at the learner's own pace where known. */
export function practiceSetMinutes(set: Question[]): number {
  return set.reduce((sum, q) => sum + q.estimatedTime, 0);
}

/** Re-exported so the company surface and the daily plan cost a review identically. */
export { revisionMinutes };
