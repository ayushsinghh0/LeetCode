import type { PatternId, Question, QuestionProgress } from '@/types';
import { applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import type { PatternStat } from '@/utils/engine/stats';
import {
  HeuristicRecommender, seededRandomQuestion, weakestPatterns, type WeakPattern,
} from '@/utils/engine/recommendations';

function mkStat(
  pattern: PatternId,
  o: { solved: number; revisionPassRate: number | null; avgConfidence: number | null; pct: number },
): PatternStat {
  return {
    pattern, total: o.solved, solved: o.solved, mastered: 0, inRevision: o.solved,
    remaining: 0, pct: o.pct, avgConfidence: o.avgConfidence, revisionPassRate: o.revisionPassRate,
  };
}

// ---------------------------------------------------------------------------
// weakestPatterns
// ---------------------------------------------------------------------------

test('weakestPatterns: filters by eligibility, scores correctly, sorts ascending (weakest first)', () => {
  const stats: PatternStat[] = [
    mkStat('two-pointers', { solved: 5, revisionPassRate: 0.5, avgConfidence: 3, pct: 50 }),
    // eligible via solved>=3; score = 0.4*0.5 + 0.4*(3/5) + 0.2*(50/100) = 0.2+0.24+0.1 = 0.54
    mkStat('sliding-window', { solved: 1, revisionPassRate: 0.2, avgConfidence: 2, pct: 20 }),
    // eligible via revisionPassRate!==null (has an attempt); score = 0.4*0.2+0.4*(2/5)+0.2*(20/100) = 0.08+0.16+0.04 = 0.28
    mkStat('graphs', { solved: 1, revisionPassRate: null, avgConfidence: null, pct: 10 }),
    // NOT eligible: solved(1) < minAttempts(3) AND no recorded attempts (revisionPassRate null)
    mkStat('intervals', { solved: 4, revisionPassRate: null, avgConfidence: null, pct: 80 }),
    // eligible via solved>=3; score = 0.4*(null??1=1) + 0.4*(null??3=3)/5 + 0.2*(80/100) = 0.4+0.24+0.16 = 0.8
  ];

  const result = weakestPatterns(stats);

  expect(result.map((r) => r.pattern)).toEqual(['sliding-window', 'two-pointers', 'intervals']);
  expect(result.find((r) => r.pattern === 'graphs')).toBeUndefined();
  expect(result[0].score).toBeCloseTo(0.28);
  expect(result[1].score).toBeCloseTo(0.54);
  expect(result[2].score).toBeCloseTo(0.8);
});

test('weakestPatterns: custom minAttempts raises the solved-count eligibility bar', () => {
  const stats: PatternStat[] = [
    mkStat('two-pointers', { solved: 4, revisionPassRate: null, avgConfidence: null, pct: 80 }),
    mkStat('graphs', { solved: 6, revisionPassRate: null, avgConfidence: null, pct: 90 }),
  ];

  // default minAttempts=3: both qualify via solved>=3
  expect(weakestPatterns(stats).map((r) => r.pattern).sort()).toEqual(['graphs', 'two-pointers']);

  // minAttempts=5: two-pointers (solved=4, no revision attempts) is excluded; graphs (solved=6) remains
  expect(weakestPatterns(stats, 5).map((r) => r.pattern)).toEqual(['graphs']);
});

test('weakestPatterns: a pattern with revision attempts but < minAttempts solved is still eligible', () => {
  const stats: PatternStat[] = [
    mkStat('two-pointers', { solved: 1, revisionPassRate: 0.75, avgConfidence: 4, pct: 20 }),
  ];
  expect(weakestPatterns(stats, 3).map((r) => r.pattern)).toEqual(['two-pointers']);
});

test('weakestPatterns: ties are broken by pattern id ascending', () => {
  const stats: PatternStat[] = [
    mkStat('hash-maps', { solved: 3, revisionPassRate: 0.5, avgConfidence: 3, pct: 50 }),
    mkStat('graphs', { solved: 3, revisionPassRate: 0.5, avgConfidence: 3, pct: 50 }),
  ];
  const result = weakestPatterns(stats);
  expect(result.map((r) => r.pattern)).toEqual(['graphs', 'hash-maps']);
  expect(result[0].score).toBeCloseTo(result[1].score);
});

// ---------------------------------------------------------------------------
// HeuristicRecommender
// ---------------------------------------------------------------------------

// 5 questions in 'two-pointers' (id5 solved, 1-4 unsolved) + 2 in 'sliding-window'.
const questions: Question[] = [
  { id: 1, title: 'Q1', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20 },
  { id: 2, title: 'Q2', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20 },
  { id: 3, title: 'Q3', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20 },
  { id: 4, title: 'Q4', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20 },
  { id: 5, title: 'Q5', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20 },
  { id: 6, title: 'Q6', pattern: 'sliding-window', difficulty: 'easy', estimatedTime: 20 },
  { id: 7, title: 'Q7', pattern: 'sliding-window', difficulty: 'easy', estimatedTime: 20 },
];

test('HeuristicRecommender: emits revision, weak-pattern, new — in that order — with non-empty reasons', () => {
  const byId: Record<number, QuestionProgress> = {
    5: applySolve(initialProgress(), '2026-07-01'),
  };
  const due = [10, 11];
  const todaysNew = [20, 21];
  const weakest: WeakPattern[] = [
    { pattern: 'two-pointers', score: 0.1 },
    { pattern: 'sliding-window', score: 0.9 },
  ];

  const recs = new HeuristicRecommender().recommend({ all: questions, byId, due, todaysNew, weakest });

  expect(recs.map((r) => r.kind)).toEqual(['revision', 'weak-pattern', 'new']);

  expect(recs[0].questionIds).toEqual(due);
  expect(recs[0].reason.length).toBeGreaterThan(0);
  expect(recs[0].reason).toContain(String(due.length));
  expect(recs[0].reason).toMatch(/due|overdue/i);

  // up to 3 unsolved ids from the single weakest pattern (two-pointers); id5 already solved
  expect(recs[1].questionIds).toEqual([1, 2, 3]);
  expect(recs[1].reason.length).toBeGreaterThan(0);
  expect(recs[1].reason).toContain('two-pointers');

  expect(recs[2].questionIds).toEqual(todaysNew);
  expect(recs[2].reason.length).toBeGreaterThan(0);
});

test('HeuristicRecommender: skips empty sections without leaving gaps or reordering', () => {
  const noDue = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [], todaysNew: [20],
    weakest: [{ pattern: 'two-pointers', score: 0.1 }],
  });
  expect(noDue.map((r) => r.kind)).toEqual(['weak-pattern', 'new']);

  const noWeak = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [10], todaysNew: [20], weakest: [],
  });
  expect(noWeak.map((r) => r.kind)).toEqual(['revision', 'new']);

  const noNew = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [10], todaysNew: [],
    weakest: [{ pattern: 'two-pointers', score: 0.1 }],
  });
  expect(noNew.map((r) => r.kind)).toEqual(['revision', 'weak-pattern']);

  const allEmpty = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [], todaysNew: [], weakest: [],
  });
  expect(allEmpty).toEqual([]);
});

test('HeuristicRecommender: skips weak-pattern when the weakest pattern has no unsolved questions', () => {
  const byId: Record<number, QuestionProgress> = {
    1: applySolve(initialProgress(), '2026-07-01'),
    2: applySolve(initialProgress(), '2026-07-01'),
    3: applySolve(initialProgress(), '2026-07-01'),
    4: applySolve(initialProgress(), '2026-07-01'),
    5: applySolve(initialProgress(), '2026-07-01'),
  };
  const recs = new HeuristicRecommender().recommend({
    all: questions, byId, due: [], todaysNew: [],
    weakest: [{ pattern: 'two-pointers', score: 0.1 }],
  });
  expect(recs).toEqual([]);
});

test('HeuristicRecommender: does not mutate its inputs', () => {
  const byId: Record<number, QuestionProgress> = { 5: applySolve(initialProgress(), '2026-07-01') };
  const due = [10, 11];
  const todaysNew = [20, 21];
  const weakest: WeakPattern[] = [{ pattern: 'two-pointers', score: 0.1 }];
  const snapshot = JSON.parse(JSON.stringify({ byId, due, todaysNew, weakest }));

  new HeuristicRecommender().recommend({ all: questions, byId, due, todaysNew, weakest });

  expect({ byId, due, todaysNew, weakest }).toEqual(snapshot);
});

// ---------------------------------------------------------------------------
// seededRandomQuestion
// ---------------------------------------------------------------------------

const pool: Question[] = Array.from({ length: 26 }, (_, i) => ({
  id: i + 1, title: `Q${i + 1}`, pattern: 'two-pointers' as PatternId, difficulty: 'easy' as const, estimatedTime: 20,
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
