import { addDays } from '@/utils/dates';
import {
  applyRevision, applySolve, dueIds, initialProgress, isDue, isMastered,
  MASTERED_STAGE, REVISION_INTERVALS,
} from '@/utils/engine/spacedRepetition';

const T = '2026-07-30';

test('intervals match spec', () => {
  expect([...REVISION_INTERVALS]).toEqual([1, 3, 7, 15, 30]);
});

test('initialProgress is a clean unsolved record', () => {
  const p = initialProgress();
  expect(p).toEqual({
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0,
  });
});

test('solve schedules first revision for next day', () => {
  const p = applySolve(initialProgress(), T);
  expect(p.status).toBe('solved');
  expect(p.completedAt).toBe(T);
  expect(p.revisionStage).toBe(0);
  expect(p.nextRevision).toBe('2026-07-31');
});

test('passing walks the full ladder 1→3→7→15→30 then masters', () => {
  let p = applySolve(initialProgress(), T);
  const gaps = [3, 7, 15, 30]; // gap AFTER passing stages 1..4
  let day = p.nextRevision!;
  for (let pass = 0; pass < 5; pass++) {
    p = applyRevision(p, day, true);
    if (pass < 4) {
      expect(p.revisionStage).toBe(pass + 1);
      expect(p.nextRevision).toBe(
        // next due = review day + gap for the new stage
        addDays(day, gaps[pass]!)
      );
      day = p.nextRevision!;
    }
  }
  expect(p.revisionStage).toBe(MASTERED_STAGE);
  expect(p.nextRevision).toBeNull();
  expect(isMastered(p)).toBe(true);
});

test('failing resets to stage 0, due tomorrow, and records history', () => {
  let p = applySolve(initialProgress(), T);
  p = applyRevision(p, '2026-07-31', true);   // stage 1
  p = applyRevision(p, '2026-08-03', false);  // fail
  expect(p.revisionStage).toBe(0);
  expect(p.nextRevision).toBe('2026-08-04');
  expect(p.revisionHistory).toEqual([
    { date: '2026-07-31', passed: true },
    { date: '2026-08-03', passed: false },
  ]);
  expect(p.lastReviewed).toBe('2026-08-03');
});

test('isDue: overdue counts, unsolved and mastered never due', () => {
  const solved = applySolve(initialProgress(), T);
  expect(isDue(solved, '2026-07-30')).toBe(false); // due tomorrow, not today
  expect(isDue(solved, '2026-07-31')).toBe(true);
  expect(isDue(solved, '2026-09-01')).toBe(true);  // overdue still due
  expect(isDue(initialProgress(), '2026-09-01')).toBe(false);
});

test('dueIds sorts oldest-first with id tiebreak', () => {
  const a = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02
  const b = { ...applySolve(initialProgress(), '2026-07-10') };   // due 07-11
  const c = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02
  expect(dueIds({ 7: b, 3: a, 5: c }, '2026-07-20')).toEqual([3, 5, 7]);
});

test('dueIds uses numeric id tiebreak, not lexicographic', () => {
  const x = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02
  const y = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02 (same as x)
  // ids 2 and 10 have same nextRevision; numeric order [2, 10], lexicographic would be [10, 2]
  expect(dueIds({ 10: y, 2: x }, '2026-07-20')).toEqual([2, 10]);
});

test('applySolve/applyRevision do not mutate their input', () => {
  const p0 = initialProgress();
  applySolve(p0, T);
  expect(p0.status).toBe('unsolved');

  // Test applyRevision immutability
  const p1 = applySolve(initialProgress(), T);
  const originalStage = p1.revisionStage;
  const originalNextRevision = p1.nextRevision;
  const originalHistory = p1.revisionHistory;
  const originalHistoryLength = originalHistory.length;

  applyRevision(p1, '2026-07-31', true);
  expect(p1.revisionStage).toBe(originalStage);
  expect(p1.nextRevision).toBe(originalNextRevision);
  expect(p1.revisionHistory).toBe(originalHistory);
  expect(p1.revisionHistory.length).toBe(originalHistoryLength);
});
