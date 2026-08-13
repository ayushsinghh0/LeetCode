import { PATTERNS } from '@/data/patterns';
import type { DayLog, Question, QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import {
  consistency, difficultyStats, goalRate, overallRevisionPassRate, patternStats,
  productivityScore, solvedPerDaySeries,
} from '@/utils/engine/stats';
import { QF } from '@/test/questionFixture';

// 6 questions across 2 patterns x 3 difficulties.
// two-pointers: q1 easy, q2 medium, q3 hard
// sliding-window: q4 easy, q5 medium, q6 hard
const questions: Question[] = [
  { id: 1, title: 'Q1', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 2, title: 'Q2', pattern: 'two-pointers', difficulty: 'medium', estimatedTime: 25, ...QF },
  { id: 3, title: 'Q3', pattern: 'two-pointers', difficulty: 'hard', estimatedTime: 30, ...QF },
  { id: 4, title: 'Q4', pattern: 'sliding-window', difficulty: 'easy', estimatedTime: 20, ...QF },
  { id: 5, title: 'Q5', pattern: 'sliding-window', difficulty: 'medium', estimatedTime: 25, ...QF },
  { id: 6, title: 'Q6', pattern: 'sliding-window', difficulty: 'hard', estimatedTime: 30, ...QF },
];

function buildById(): Record<number, QuestionProgress> {
  const T = '2026-07-01';

  // q1: solved, 2 passes + 1 fail (3 attempts), confidence 4. Never reaches mastery.
  let p1 = applySolve(initialProgress(), T);
  p1 = applyRevision(p1, '2026-07-02', true);
  p1 = applyRevision(p1, '2026-07-05', true);
  p1 = applyRevision(p1, '2026-07-12', false);
  p1 = { ...p1, confidence: 4 };

  // q2: solved, mastered via 5 consecutive passing revisions, confidence 5.
  let p2 = applySolve(initialProgress(), T);
  let day = p2.nextRevision!;
  for (let pass = 0; pass < 5; pass++) {
    p2 = applyRevision(p2, day, true);
    if (p2.nextRevision) day = p2.nextRevision;
  }
  p2 = { ...p2, confidence: 5 };

  // q3, q4, q5, q6: untouched (unsolved, no revision history)
  return {
    1: p1, 2: p2, 3: initialProgress(),
    4: initialProgress(), 5: initialProgress(), 6: initialProgress(),
  };
}

test('patternStats: one entry per PATTERNS entry, in order, with correct aggregates', () => {
  const byId = buildById();
  const stats = patternStats(questions, byId);

  expect(stats).toHaveLength(PATTERNS.length);
  expect(stats.map((s) => s.pattern)).toEqual(PATTERNS.map((p) => p.id));

  const tp = stats.find((s) => s.pattern === 'two-pointers')!;
  expect(tp.total).toBe(3);
  expect(tp.solved).toBe(2);        // q1, q2
  expect(tp.mastered).toBe(1);      // q2
  expect(tp.inRevision).toBe(1);    // q1: solved, not mastered
  expect(tp.remaining).toBe(1);     // q3
  expect(tp.pct).toBe(67);          // round(2/3 * 100)
  expect(tp.avgConfidence).toBe(4.5); // mean of q1(4) and q2(5)
  expect(tp.revisionPassRate).toBeCloseTo(7 / 8); // (2+5) passes / (3+5) attempts

  const sw = stats.find((s) => s.pattern === 'sliding-window')!;
  expect(sw.total).toBe(3);
  expect(sw.solved).toBe(0);
  expect(sw.mastered).toBe(0);
  expect(sw.inRevision).toBe(0);
  expect(sw.remaining).toBe(3);
  expect(sw.pct).toBe(0);
  expect(sw.avgConfidence).toBeNull();
  expect(sw.revisionPassRate).toBeNull();

  // Patterns absent from the fixture dataset must still appear (total 0, no NaN).
  const other = stats.find((s) => s.pattern === 'graphs')!;
  expect(other).toEqual({
    pattern: 'graphs', total: 0, solved: 0, mastered: 0, inRevision: 0,
    remaining: 0, pct: 0, avgConfidence: null, revisionPassRate: null,
  });
});

test('difficultyStats: per-difficulty solved counts and pass rates', () => {
  const byId = buildById();
  const stats = difficultyStats(questions, byId);
  expect(stats.map((s) => s.difficulty)).toEqual(['easy', 'medium', 'hard']);

  const easy = stats.find((s) => s.difficulty === 'easy')!;
  expect(easy.total).toBe(2);   // q1, q4
  expect(easy.solved).toBe(1); // q1
  expect(easy.pct).toBe(50);
  expect(easy.revisionPassRate).toBeCloseTo(2 / 3); // only q1's history: 2 pass / 3 attempts

  const medium = stats.find((s) => s.difficulty === 'medium')!;
  expect(medium.total).toBe(2); // q2, q5
  expect(medium.solved).toBe(1); // q2
  expect(medium.pct).toBe(50);
  expect(medium.revisionPassRate).toBe(1); // q2's history: 5/5 passes

  const hard = stats.find((s) => s.difficulty === 'hard')!;
  expect(hard.total).toBe(2); // q3, q6
  expect(hard.solved).toBe(0);
  expect(hard.pct).toBe(0);
  expect(hard.revisionPassRate).toBeNull(); // zero attempts
});

test('overallRevisionPassRate aggregates all histories; null with zero attempts', () => {
  const byId = buildById();
  expect(overallRevisionPassRate(Object.values(byId))).toBeCloseTo(7 / 8);
  expect(overallRevisionPassRate([])).toBeNull();
});

test('consistency: activeDays / windowDays over the trailing window', () => {
  const today = '2026-07-30';
  const logs: Record<string, DayLog> = {};
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    logs[date] = {
      date, solvedIds: i < 7 ? [1] : [], // 7 active days, 7 inactive
      revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
    };
  }
  expect(consistency(logs, today)).toBe(0.5);
  expect(consistency({}, today)).toBe(0);
});

test('goalRate: perfectDays / windowDays', () => {
  const today = '2026-07-30';
  const perDay = 8;
  const logs: Record<string, DayLog> = {};
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    logs[date] = {
      date, solvedIds: Array.from({ length: i < 7 ? perDay : 0 }, (_, k) => k + 1), // 7 perfect days
      revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
    };
  }
  expect(goalRate(logs, today, perDay)).toBe(0.5);
  expect(goalRate({}, today, perDay)).toBe(0);
});

test('productivityScore: 100% consistency + goalRate + passRate -> 100', () => {
  const today = '2026-07-30';
  const perDay = 1;
  const logs: Record<string, DayLog> = {};
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    logs[date] = {
      date, solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
    };
  }
  let p = applySolve(initialProgress(), today);
  p = applyRevision(p, addDays(today, 1), true); // 1 pass, 0 fails -> passRate 1
  const byId = { 1: p };

  expect(productivityScore(logs, byId, perDay, today)).toBe(100);
});

test('productivityScore: all-empty logs and no revision history -> 0', () => {
  expect(productivityScore({}, {}, 8, '2026-07-30')).toBe(0);
});

test('productivityScore: solve activity but zero revision attempts substitutes 0.5 for the pass-rate term', () => {
  const today = '2026-07-30';
  const perDay = 8;
  const logs: Record<string, DayLog> = {};
  for (let i = 0; i < 7; i++) { // 7 of 14 days active, none perfect (perDay=8, solved=1)
    const date = addDays(today, -i);
    logs[date] = {
      date, solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
    };
  }
  // consistency = 7/14 = 0.5, goalRate = 0/14 = 0, no revision attempts but solve activity exists -> passRateTerm = 0.5
  // round(100 * (0.40*0.5 + 0.35*0 + 0.25*0.5)) = round(32.5) = 33
  expect(productivityScore(logs, {}, perDay, today)).toBe(33);
});

test('solvedPerDaySeries: chronological, zero-filled, exact length', () => {
  const today = '2026-07-30';
  const logs: Record<string, DayLog> = {
    '2026-07-30': {
      date: '2026-07-30', solvedIds: [1, 2], revisionsPassed: [10], revisionsFailed: [11],
      xpEarned: 0, focusMinutes: 0,
    },
    '2026-07-28': {
      date: '2026-07-28', solvedIds: [3, 4, 5], revisionsPassed: [], revisionsFailed: [],
      xpEarned: 0, focusMinutes: 0,
    },
  };

  const series = solvedPerDaySeries(logs, today, 5);
  expect(series).toHaveLength(5);
  expect(series.map((s) => s.date)).toEqual([
    '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30',
  ]);
  expect(series[0]).toEqual({ date: '2026-07-26', solved: 0, revisions: 0 }); // zero-filled
  expect(series[1]).toEqual({ date: '2026-07-27', solved: 0, revisions: 0 }); // zero-filled
  expect(series[2]).toEqual({ date: '2026-07-28', solved: 3, revisions: 0 });
  expect(series[3]).toEqual({ date: '2026-07-29', solved: 0, revisions: 0 }); // zero-filled
  expect(series[4]).toEqual({ date: '2026-07-30', solved: 2, revisions: 2 }); // 1 pass + 1 fail
});
