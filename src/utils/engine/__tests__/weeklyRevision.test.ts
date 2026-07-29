import type { Question, QuestionProgress } from '@/types';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import { weeklyTopUp } from '@/utils/engine/weeklyRevision';

const TODAY = '2026-07-30';

// Fixture: 10 questions.
//   1  = solved & mastered              -> excluded (mastered)
//   2  = never solved                   -> excluded (unsolved)
//   3  = solved, non-mastered           -> pool candidate (used to test `due` exclusion)
//   4  = solved, non-mastered, confidence=2, fail=0, lastReviewed=2026-07-20
//   5  = solved, non-mastered, confidence=2, fail=1, lastReviewed=2026-07-15
//   6  = solved, non-mastered, confidence=null(->2.5), fail=0, lastReviewed=2026-07-01
//   7  = solved, non-mastered, confidence=3, fail=0, lastReviewed=null, completedAt=2026-07-10
//   8  = solved, non-mastered, confidence=3, fail=0, lastReviewed=null, completedAt=2026-07-05
//   9  = solved, non-mastered, confidence=3, fail=0, lastReviewed=null, completedAt=2026-07-05 (ties id 8)
//   10 = in_progress (not solved)        -> excluded
function buildFixture(): { all: Question[]; byId: Record<number, QuestionProgress> } {
  let mastered = applySolve(initialProgress(), '2026-07-01');
  let day = mastered.nextRevision!;
  for (let i = 0; i < 5; i++) {
    mastered = applyRevision(mastered, day, true);
    if (mastered.nextRevision) day = mastered.nextRevision;
  }

  const byId: Record<number, QuestionProgress> = {
    1: mastered,
    2: initialProgress(),
    3: applySolve(initialProgress(), '2026-07-01'),
    4: { ...applySolve(initialProgress(), '2026-07-01'), confidence: 2, lastReviewed: '2026-07-20' },
    5: {
      ...applySolve(initialProgress(), '2026-07-01'), confidence: 2, lastReviewed: '2026-07-15',
      revisionHistory: [{ date: '2026-07-14', passed: false }],
    },
    6: { ...applySolve(initialProgress(), '2026-07-01'), confidence: null, lastReviewed: '2026-07-01' },
    7: { ...applySolve(initialProgress(), '2026-07-10'), confidence: 3 },
    8: { ...applySolve(initialProgress(), '2026-07-05'), confidence: 3 },
    9: { ...applySolve(initialProgress(), '2026-07-05'), confidence: 3 },
    10: { ...initialProgress(), status: 'in_progress' },
  };

  const all: Question[] = Object.keys(byId).map((k) => ({
    id: Number(k), title: `Q${k}`, pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20,
  }));

  return { all, byId };
}

test('weeklyTopUp: ranks by confidence asc -> fail desc -> lastReviewed asc (null=completedAt) -> id asc, excluding due/mastered/unsolved', () => {
  const { all, byId } = buildFixture();
  const due = [3]; // exclude id3 explicitly even though it is solved & non-mastered
  const result = weeklyTopUp(all, byId, due, TODAY, 7, 7); // target = min(7-1, 7-1) = 6 = full remaining pool

  // Full expected order:
  //  id5 (conf2, fail1) < id4 (conf2, fail0) < id6 (conf2.5) < id8 (conf3, completedAt 07-05) <
  //  id9 (conf3, completedAt 07-05, id9>id8) < id7 (conf3, completedAt 07-10)
  expect(result).toEqual([5, 4, 6, 8, 9, 7]);

  expect(result).not.toContain(1);  // mastered
  expect(result).not.toContain(2);  // never solved
  expect(result).not.toContain(3);  // in `due`
  expect(result).not.toContain(10); // in_progress, not solved
});

test('weeklyTopUp: returns [] when due already meets min, regardless of how far below max', () => {
  const { all, byId } = buildFixture();

  // due.length === min (15) with default max (20)
  const dueAtMin = Array.from({ length: 15 }, (_, i) => 9000 + i);
  expect(weeklyTopUp(all, byId, dueAtMin, TODAY)).toEqual([]);

  // due.length === max (20)
  const dueAtMax = Array.from({ length: 20 }, (_, i) => 9000 + i);
  expect(weeklyTopUp(all, byId, dueAtMax, TODAY)).toEqual([]);

  // Governing-rule case: due.length (17) is between min(15) and max(20).
  // Resolution: extras = 0 whenever due.length >= min, even though the total is still below max —
  // weeklyTopUp only tops up a shortfall against `min`, it never pads further just to approach `max`.
  const dueBetween = Array.from({ length: 17 }, (_, i) => 9000 + i);
  expect(weeklyTopUp(all, byId, dueBetween, TODAY)).toEqual([]);
});

test('weeklyTopUp: extras are capped by pool size when the pool cannot fill the target', () => {
  const { all, byId } = buildFixture();
  const due = [3]; // pool = {4,5,6,7,8,9} = 6 candidates
  // min=100,max=200 -> target = min(100-0... wait due.length=1) -> min(100-1,200-1)=99, capped to pool size 6
  const result = weeklyTopUp(all, byId, due, TODAY, 100, 200);
  expect(result).toEqual([5, 4, 6, 8, 9, 7]); // same full ranked order as the 6-item pool
});

test('weeklyTopUp: default min=15/max=20 drives the target on a small pool, capped by pool size', () => {
  const smallAll: Question[] = [501, 502, 503].map((id) => ({
    id, title: `Q${id}`, pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20,
  }));
  const smallById: Record<number, QuestionProgress> = {
    501: applySolve(initialProgress(), '2026-07-01'),
    502: applySolve(initialProgress(), '2026-07-02'),
    503: applySolve(initialProgress(), '2026-07-03'),
  };
  const due = Array.from({ length: 10 }, (_, i) => 9000 + i); // 10 unrelated due ids
  // target = min(15-10, 20-10) = 5, but pool only has 3 candidates
  const result = weeklyTopUp(smallAll, smallById, due, TODAY);
  expect(result).toEqual([501, 502, 503]); // ties on confidence/fail -> lastReviewed(=completedAt) ascending
});

test('weeklyTopUp: partial shortfall returns exactly the weakest N extras', () => {
  const { all, byId } = buildFixture();
  const due = [3]; // pool = {4,5,6,7,8,9}, min=3,max=5 -> target = min(3-1, 5-1) = 2
  const result = weeklyTopUp(all, byId, due, TODAY, 3, 5);
  expect(result).toEqual([5, 4]); // two weakest by the ranking rule
});

test('weeklyTopUp: does not mutate its inputs', () => {
  const { all, byId } = buildFixture();
  const due = [3];
  const snapshot = JSON.parse(JSON.stringify({ all, byId, due }));
  weeklyTopUp(all, byId, due, TODAY, 7, 7);
  expect({ all, byId, due }).toEqual(snapshot);
});
