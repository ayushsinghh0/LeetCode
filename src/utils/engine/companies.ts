// Coverage of a company's published topics by the learner's actual practice.
//
// The claim this module is allowed to make is narrow and it holds it exactly: "of the roadmap
// patterns that correspond to the topics this company's own prep page names, here is how much
// you have covered." It is a statement about the learner's practice, cross-referenced against a
// quoted source — never a prediction, never a readiness score, and never a claim about which
// problems anyone will be asked.
import type { PatternId, Question, QuestionProgress } from '@/types';
import type { PatternStat } from '@/utils/engine/stats';
import { isPassRateReportable } from '@/utils/engine/stats';
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
  /** Graded recalls behind `passRate` — the reason `standing` can tell measured from untested. */
  reviews: number;
  standing: 'strong' | 'unreviewed' | 'developing' | 'gap';
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

/**
 * Where the learner stands in one mapped pattern.
 *
 * `strong` is the only *positive* claim in the set — the surface renders it as "Holding · 60%+
 * solved, reviews passing" — so it is the only one that needs evidence for both halves. It used
 * to accept `passRate === null`, which meant a pattern solved this morning and never once
 * recalled was counted as reviews passing: an assertion about recall performance on a pattern
 * whose recall had never been tested. Solving is not remembering, and this module is not allowed
 * to claim the second from the first.
 *
 * So: nothing recalled yet is `unreviewed` — said plainly rather than folded into either the
 * good or the bad bucket. A rate too thin to report (`isPassRateReportable`) cannot promote a
 * pattern either, but it does NOT read as unreviewed, because reviews happened and some of them
 * may have failed; those patterns sit in the neutral middle where no claim is made at all.
 */
function standingOf(
  pct: number, passRate: number | null, reviews: number,
): CompanyPatternCoverage['standing'] {
  if (pct >= STRONG_PCT) {
    if (reviews === 0) return 'unreviewed';
    if (passRate !== null && isPassRateReportable(reviews) && passRate >= STRONG_PASS_RATE) {
      return 'strong';
    }
  }
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
    const reviews = stat?.revisionAttempts ?? 0;
    return {
      pattern, solved, total, pct, passRate, reviews,
      standing: standingOf(pct, passRate, reviews),
    };
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
 * One question in a company practice set, carrying the only honest answer to "why is this here?".
 *
 * The reason is never "this company asks it" — it is "this question sits in a roadmap pattern
 * that was mapped from a topic this company's own page names", plus "you are weakest there".
 * Both halves are returned so the UI can say it rather than imply it.
 */
export interface PracticePick {
  question: Question;
  /** The mapped pattern this question belongs to. */
  pattern: PatternId;
  /** The learner's standing in that pattern — which is also why the set is ordered as it is. */
  standing: CompanyPatternCoverage['standing'];
}

/**
 * A practice set for one company: unsolved questions in its named patterns, gap patterns first,
 * easiest first inside a pattern so the set has an on-ramp rather than a wall.
 *
 * Explicitly NOT "questions this company asks". It is the roadmap's own material, filtered by
 * topics the company published, ordered by where this learner is weakest.
 */
export function practicePicks(
  coverage: CompanyCoverage,
  all: Question[],
  byId: Record<number, QuestionProgress>,
  limit = 8,
): PracticePick[] {
  // Weakest first. `unreviewed` sits above `developing`: a pattern that is 60%+ solved needs
  // recall work more than it needs more solving, and this set only offers unsolved questions.
  const rank: Record<CompanyPatternCoverage['standing'], number> = {
    gap: 0, developing: 1, unreviewed: 2, strong: 3,
  };
  const standingByPattern = new Map(coverage.patterns.map((r) => [r.pattern, r.standing]));
  const difficultyRank = { easy: 0, medium: 1, hard: 2 } as const;
  const orderOf = (q: Question) => rank[standingByPattern.get(q.pattern)!];

  return all
    .filter(
      (q) => standingByPattern.has(q.pattern) && (byId[q.id]?.status ?? 'unsolved') === 'unsolved',
    )
    .sort((a, b) => {
      const byStanding = orderOf(a) - orderOf(b);
      if (byStanding !== 0) return byStanding;
      const byDifficulty = difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
      if (byDifficulty !== 0) return byDifficulty;
      return a.id - b.id;
    })
    .slice(0, limit)
    .map((question) => ({
      question,
      pattern: question.pattern,
      standing: standingByPattern.get(question.pattern)!,
    }));
}

/** The same set, questions only — for callers that do not need the attribution. */
export function companyPracticeSet(
  coverage: CompanyCoverage,
  all: Question[],
  byId: Record<number, QuestionProgress>,
  limit = 8,
): Question[] {
  return practicePicks(coverage, all, byId, limit).map((p) => p.question);
}

/**
 * Minutes a practice set would take, at the questions' own authored estimates.
 *
 * Deliberately NOT personalised: `engine/timeEstimate.ts` only reports a personal figure at five
 * comparable measurements, and a set of eight questions the learner has never attempted has no
 * such sample. The UI writes `~` in front of this for the same reason.
 */
export function practiceSetMinutes(set: Question[]): number {
  return set.reduce((sum, q) => sum + q.estimatedTime, 0);
}

/** Re-exported so the company surface and the daily plan cost a review identically. */
export { revisionMinutes };
