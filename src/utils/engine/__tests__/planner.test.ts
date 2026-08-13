import {
  formatMinutes,
  MAX_REVISION_MINUTES,
  MIN_REVISION_MINUTES,
  revisionMinutes,
} from '@/utils/engine/planner';
import type { Question } from '@/types';
import { QF } from '@/test/questionFixture';

const q = (estimatedTime: number): Question => ({
  id: 1, title: 'Q1', pattern: 'two-pointers', difficulty: 'medium', estimatedTime, ...QF,
});

describe('revisionMinutes', () => {
  test("scales with the question's own estimate rather than a flat constant", () => {
    // A re-derive is roughly a third of the first attempt, so a 40-minute hard question costs
    // more to revise than a 25-minute medium one. That difference is why this function exists.
    expect(revisionMinutes(q(40))).toBe(14);
    expect(revisionMinutes(q(25))).toBe(9);
    expect(revisionMinutes(q(20))).toBe(7);
  });

  test('clamps at both ends so the arithmetic cannot produce a useless estimate', () => {
    expect(revisionMinutes(q(8))).toBe(MIN_REVISION_MINUTES); // would round to 3
    expect(revisionMinutes(q(60))).toBe(MAX_REVISION_MINUTES); // would round to 21
  });

  test('is monotonic in the underlying estimate', () => {
    const values = [8, 12, 20, 25, 35, 40, 60].map((m) => revisionMinutes(q(m)));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

describe('formatMinutes', () => {
  test('minutes under an hour, exact hours, and mixed', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(125)).toBe('2h 05m');
  });
});
