import type { PatternId, Question, QuestionProgress } from '@/types';
import { applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import {
  HeuristicRecommender, seededRandomQuestion, type WeakPattern,
} from '@/utils/engine/recommendations';
import { QF } from '@/test/questionFixture';

// NOTE: the `weakestPatterns` tests were removed with the function itself — it was the product's
// second weakness formula and `engine/weakness.ts` is now the only one. See the note in
// recommendations.ts and the weakness invariant in CLAUDE.md.

// ---------------------------------------------------------------------------
// HeuristicRecommender
// ---------------------------------------------------------------------------

// 5 questions in 'two-pointers' (id5 solved, 1-4 unsolved) + 2 in 'sliding-window'.
const questions: Question[] = [
  { id: 1, title: 'Q1', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 2, title: 'Q2', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 3, title: 'Q3', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 4, title: 'Q4', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 5, title: 'Q5', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 6, title: 'Q6', pattern: 'sliding-window', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 7, title: 'Q7', pattern: 'sliding-window', difficulty: 'easy', estimatedTime: 20, ...QF },
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

  expect(recs[0]!.questionIds).toEqual(due);
  expect(recs[0]!.reason.length).toBeGreaterThan(0);
  expect(recs[0]!.reason).toContain(String(due.length));
  expect(recs[0]!.reason).toMatch(/due|overdue/i);

  // up to 3 unsolved ids from the single weakest pattern (two-pointers); id5 already solved
  expect(recs[1]!.questionIds).toEqual([1, 2, 3]);
  expect(recs[1]!.reason.length).toBeGreaterThan(0);
  expect(recs[1]!.reason).toContain('two-pointers');

  expect(recs[2]!.questionIds).toEqual(todaysNew);
  expect(recs[2]!.reason.length).toBeGreaterThan(0);
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

test('HeuristicRecommender: due course reviews rank right after due question revisions', () => {
  const recs = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [10], todaysNew: [20],
    weakest: [{ pattern: 'two-pointers', score: 0.1 }],
    course: { dueReviewWeekIds: ['w02', 'w05'], nextSessionWeekId: 'w07' },
  });

  // Cap of 3 holds: course-review displaces 'new' and course-session on a full day.
  expect(recs.map((r) => r.kind)).toEqual(['revision', 'course-review', 'weak-pattern']);
  expect(recs[1]!.weekIds).toEqual(['w02', 'w05']);
  expect(recs[1]!.questionIds).toEqual([]);
  expect(recs[1]!.reason).toContain('2');
  expect(recs[1]!.reason).toMatch(/review/i);
});

test('HeuristicRecommender: next course session surfaces last, only when the day has room', () => {
  // Light day: no due work, no weak patterns — the session recommendation fits.
  const light = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [], todaysNew: [20], weakest: [],
    course: { dueReviewWeekIds: [], nextSessionWeekId: 'w03' },
  });
  expect(light.map((r) => r.kind)).toEqual(['new', 'course-session']);
  expect(light[1]!.weekIds).toEqual(['w03']);

  // Full day: three question recommendations already fill the cap.
  const full = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [10], todaysNew: [20],
    weakest: [{ pattern: 'two-pointers', score: 0.1 }],
    course: { dueReviewWeekIds: [], nextSessionWeekId: 'w03' },
  });
  expect(full.map((r) => r.kind)).toEqual(['revision', 'weak-pattern', 'new']);
});

test('HeuristicRecommender: no course arg (or a finished course) emits no course recommendations', () => {
  const withoutArg = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [], todaysNew: [20], weakest: [],
  });
  expect(withoutArg.map((r) => r.kind)).toEqual(['new']);

  const finished = new HeuristicRecommender().recommend({
    all: questions, byId: {}, due: [], todaysNew: [20], weakest: [],
    course: { dueReviewWeekIds: [], nextSessionWeekId: null },
  });
  expect(finished.map((r) => r.kind)).toEqual(['new']);
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
