// Coverage and practice sets, at the two boundaries the company surface actually leans on:
// the no-mapped-patterns majority (most entries carry none), and the "why is this question
// here?" attribution the UI is required to render on every practice row.
//
// The shipped-dataset invariants (evidence tiers gate `patterns`, quotes are verbatim, ids are
// real) live in insights.test.ts and are not restated here.
import {
  STRONG_PCT,
  STRONG_PASS_RATE,
  WEAK_PCT,
  companyCoverage,
  companyPracticeSet,
  practicePicks,
  practiceSetMinutes,
} from '@/utils/engine/companies';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import { patternStats } from '@/utils/engine/stats';
import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';
import { QF } from '@/test/questionFixture';

const q = (
  id: number,
  pattern: PatternId,
  difficulty: Difficulty = 'medium',
  estimatedTime = 20,
): Question => ({ id, title: `Q${id}`, pattern, difficulty, estimatedTime, ...QF });

function solvedWithReviews(passes: boolean[]): QuestionProgress {
  let p = applySolve(initialProgress(), '2026-07-01');
  passes.forEach((passed, i) => {
    p = applyRevision(p, `2026-07-${String(2 + i).padStart(2, '0')}`, passed);
  });
  return p;
}

const coverageOf = (
  patterns: PatternId[],
  all: Question[],
  byId: Record<number, QuestionProgress>,
) => companyCoverage(patterns, patternStats(all, byId), all, byId);

describe('companyCoverage — the no-mapped-patterns majority', () => {
  // Most entries in the dataset are `categories` or `avoids-puzzles` and carry no patterns at
  // all. That path has to produce a clean zero rather than a NaN percentage.
  test('an empty pattern list yields zeros, not a division by zero', () => {
    const all = [q(1, 'graphs'), q(2, 'hash-maps')];
    const coverage = coverageOf([], all, {});

    expect(coverage.patterns).toEqual([]);
    expect(coverage.solved).toBe(0);
    expect(coverage.total).toBe(0);
    expect(coverage.pct).toBe(0);
    expect(coverage.strong).toEqual([]);
    expect(coverage.gaps).toEqual([]);
    // No mapped pattern means no company-specific workload — not "everything is remaining".
    expect(coverage.remainingMinutes).toBe(0);
  });

  test('a mapped pattern with no questions at all reports 0/0 rather than throwing', () => {
    const coverage = coverageOf(['graphs'], [], {});
    expect(coverage.patterns).toEqual([
      { pattern: 'graphs', solved: 0, total: 0, pct: 0, passRate: null, standing: 'gap' },
    ]);
  });
});

describe('companyCoverage — standings and workload', () => {
  test('remaining minutes count only unsolved questions inside the mapped patterns', () => {
    const all = [
      q(1, 'graphs', 'medium', 30),
      q(2, 'graphs', 'medium', 30),
      q(3, 'two-pointers', 'medium', 45), // outside the mapping — must not be counted
    ];
    const coverage = coverageOf(['graphs'], all, { 1: solvedWithReviews([]) });
    expect(coverage.remainingMinutes).toBe(30);
  });

  test('a well-solved pattern that keeps failing reviews is not reported as holding', () => {
    // 100% solved, so the percentage gate passes; the pass rate is what disqualifies it.
    const all = Array.from({ length: 4 }, (_, i) => q(i + 1, 'graphs'));
    const byId: Record<number, QuestionProgress> = {
      1: solvedWithReviews([false, false]),
      2: solvedWithReviews([false, false]),
      3: solvedWithReviews([true]),
      4: solvedWithReviews([false]),
    };

    const coverage = coverageOf(['graphs'], all, byId);
    const row = coverage.patterns[0]!;

    expect(row.pct).toBeGreaterThanOrEqual(STRONG_PCT);
    expect(row.passRate).toBeLessThan(STRONG_PASS_RATE);
    expect(row.standing).toBe('developing');
    expect(coverage.strong).toEqual([]);
  });

  test('an untouched pattern is a gap, and a partly-solved one is developing', () => {
    // 10 questions each: graphs untouched (0%, gap), hash-maps at 40% (between WEAK and STRONG).
    const all = [
      ...Array.from({ length: 10 }, (_, i) => q(i + 1, 'graphs')),
      ...Array.from({ length: 10 }, (_, i) => q(i + 20, 'hash-maps')),
    ];
    const byId: Record<number, QuestionProgress> = Object.fromEntries(
      [20, 21, 22, 23].map((id) => [id, solvedWithReviews([])]),
    );

    const coverage = coverageOf(['graphs', 'hash-maps'], all, byId);
    const [graphs, hashMaps] = coverage.patterns;

    expect(graphs!.pct).toBeLessThan(WEAK_PCT);
    expect(graphs!.standing).toBe('gap');
    expect(hashMaps!.pct).toBe(40);
    expect(hashMaps!.standing).toBe('developing');
    expect(coverage.pct).toBe(20);
  });
});

describe('practicePicks — why each question is in the set', () => {
  const all = [
    q(1, 'graphs', 'easy'),
    q(2, 'graphs', 'hard'),
    q(3, 'hash-maps', 'medium'),
    q(4, 'two-pointers', 'easy'), // outside the mapping entirely
  ];

  test('each pick carries the mapped pattern and the learner\'s standing in it', () => {
    // hash-maps is fully solved and passing, graphs is untouched.
    const byId: Record<number, QuestionProgress> = { 3: solvedWithReviews([true, true]) };
    const coverage = coverageOf(['graphs', 'hash-maps'], all, byId);
    const picks = practicePicks(coverage, all, byId);

    expect(picks.map((p) => p.question.id)).toEqual([1, 2]);
    expect(picks.every((p) => p.pattern === 'graphs')).toBe(true);
    expect(picks.every((p) => p.standing === 'gap')).toBe(true);
  });

  test('gap patterns come first, easiest first inside a pattern', () => {
    const byId: Record<number, QuestionProgress> = {};
    const coverage = coverageOf(['graphs', 'hash-maps'], all, byId);
    const picks = practicePicks(coverage, all, byId);

    // Every mapped pattern is a gap here, so difficulty then id decides — and the two-pointers
    // question never appears, because no company topic mapped to it.
    expect(picks.map((p) => p.question.id)).toEqual([1, 3, 2]);
    expect(picks.some((p) => p.pattern === 'two-pointers')).toBe(false);
  });

  test('solved questions are never offered, and the limit is respected', () => {
    const byId: Record<number, QuestionProgress> = { 1: solvedWithReviews([]) };
    const coverage = coverageOf(['graphs', 'hash-maps'], all, byId);

    const picks = practicePicks(coverage, all, byId, 1);
    expect(picks).toHaveLength(1);
    expect(picks[0]!.question.id).not.toBe(1);
  });

  test('companyPracticeSet is the same set with the attribution stripped', () => {
    const byId: Record<number, QuestionProgress> = {};
    const coverage = coverageOf(['graphs', 'hash-maps'], all, byId);

    expect(companyPracticeSet(coverage, all, byId)).toEqual(
      practicePicks(coverage, all, byId).map((p) => p.question),
    );
  });
});

describe('practiceSetMinutes', () => {
  test('sums the questions\' own authored estimates', () => {
    expect(practiceSetMinutes([q(1, 'graphs', 'easy', 12), q(2, 'graphs', 'hard', 48)])).toBe(60);
    expect(practiceSetMinutes([])).toBe(0);
  });
});
