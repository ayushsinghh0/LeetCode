import type { PatternId, Question } from '@/types';
import { seededRandomQuestion } from '@/utils/engine/recommendations';
import { QF } from '@/test/questionFixture';

// NOTE: the `weakestPatterns` and `HeuristicRecommender` tests were removed with the code itself.
// Both were superseded rather than merely unused: `engine/weakness.ts` (via `selectPatternWeakness`)
// is the one weakness model, and `engine/nextAction.ts` `rankWork()` is the one prioritizer. See the
// note at the top of recommendations.ts and the invariants in CLAUDE.md.

// ---------------------------------------------------------------------------
// seededRandomQuestion
// ---------------------------------------------------------------------------

const pool: Question[] = Array.from({ length: 26 }, (_, i) => ({
  id: i + 1, title: `Q${i + 1}`, pattern: 'two-pointers' as PatternId, difficulty: 'easy' as const, estimatedTime: 20, ...QF,
}));

test('seededRandomQuestion: deterministic for the same seed', () => {
  const a = seededRandomQuestion(pool, '2026-07-30');
  const b = seededRandomQuestion(pool, '2026-07-30');
  expect(a).toEqual(b);
  expect(a.id).toBe(b.id);
});

test('seededRandomQuestion: different seeds can produce different questions', () => {
  const seeds = ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03'];
  const ids = new Set(seeds.map((s) => seededRandomQuestion(pool, s).id));
  expect(ids.size).toBeGreaterThan(1);
});

test('seededRandomQuestion: always returns a question from the given pool', () => {
  for (const seed of ['a', 'b', 'c', 'today', '2026-01-01']) {
    const q = seededRandomQuestion(pool, seed);
    expect(pool).toContainEqual(q);
  }
});
