import { describe, expect, it } from 'vitest';
import {
  analyzeContest,
  contestDurationMin,
  type Contest,
  type ContestAttempt,
  type ContestQuestionLike,
} from '@/utils/engine/contest';

// The V13 slice-5 widening: `analyzeContest` accepts a structural supertype of `Question`, so a
// contest-library problem — no authored teaching line, possibly no AICM mapping — flows through
// the ONE analysis. These tests pin the two honest absences; everything about full Questions is
// pinned by the pre-existing contest suite, which passed unmodified after the widening.

const q = (over: Partial<ContestQuestionLike> = {}): ContestQuestionLike => ({
  id: -1,
  title: 'Library Problem',
  difficulty: 'medium',
  ...over,
});

const contest = (questions: ContestQuestionLike[], target = 20): Contest => ({
  id: 'seed',
  shape: questions.map(() => 'medium' as const),
  problems: questions.map((question, i) => ({ question, order: i + 1, targetMinutes: target })),
  durationMin: contestDurationMin(questions.map(() => target)),
});

const stall = (questionId: number, minutesSpent = 15): ContestAttempt => ({
  questionId,
  solved: false,
  minutesSpent,
});

describe('analyzeContest over library-shaped problems', () => {
  it('a stall on an unmapped problem is informative but claims no pattern', () => {
    const analysis = analyzeContest(
      contest([q({ id: -1 }), q({ id: -2, pattern: 'graphs' })]),
      [stall(-1), stall(-2)],
    );
    expect(analysis.inconclusive).toBe(false);
    // Both stalls are real evidence about the sitting…
    expect(analysis.stalledQuestionIds).toEqual([-1, -2]);
    // …but only the mapped problem may put a pattern in the gap list.
    expect(analysis.patternGaps).toEqual(['graphs']);
    expect(analysis.next?.pattern).toBe('graphs');
  });

  it('a wholly unmapped stalled set produces readings and no pattern claim at all', () => {
    const analysis = analyzeContest(contest([q({ id: -1 }), q({ id: -2 })]), [
      stall(-1),
      stall(-2),
    ]);
    expect(analysis.inconclusive).toBe(false);
    expect(analysis.patternGaps).toEqual([]);
    expect(analysis.next).toBeNull();
  });

  it('a reading for a problem with no authored teaching line ends cleanly', () => {
    const analysis = analyzeContest(contest([q({ id: -1 }), q({ id: -2 })]), [
      stall(-1),
      stall(-2),
    ]);
    for (const reading of analysis.readings) {
      expect(reading.reading).not.toContain('undefined');
      expect(reading.reading).toMatch(/\.$/); // no dangling separator where `tests` used to go
    }
  });

  it('contestDurationMin applies the one pace rule Full Contest always used', () => {
    // 4 problems × 20 min = 80, × 1.1 slack = 88.
    expect(contestDurationMin([20, 20, 20, 20])).toBe(88);
  });
});
