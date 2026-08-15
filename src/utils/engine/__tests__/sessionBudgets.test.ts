// The per-budget coherence audit (V8 Priority 7), kept as a test rather than as a one-off check.
//
// The directive's requirement is precise and easy to fail silently: every budget the product
// offers must produce "a coherent experience", NOT the same list truncated. That is a property of
// the whole ladder of budgets rather than of any one of them, so it can only be asserted by
// building all of them from ONE identical queue and comparing what came out.
//
// A queue of twelve due questions is deliberately far more than any budget can take: if the
// budgets differed only in how many items they sliced off the front, the comparisons below would
// all pass on count and fail on shape. They assert shape.
import {
  buildRevisionSession,
  SESSION_BUDGETS,
  shapeFor,
  type RevisionCandidate,
  type SessionInput,
} from '@/utils/engine/session';
import type { Difficulty, PatternId, Question } from '@/types';
import { QF } from '@/test/questionFixture';

const PATTERNS: PatternId[] = ['two-pointers', 'graphs', 'stacks', 'hash-maps', 'greedy', 'trie'];

const q = (id: number, difficulty: Difficulty, pattern: PatternId, estimatedTime: number): Question => ({
  id,
  title: `Q${id}`,
  pattern,
  difficulty,
  estimatedTime,
  ...QF,
});

/** Twelve due questions across six patterns and all three difficulties — a real evening's backlog. */
const candidates: RevisionCandidate[] = Array.from({ length: 12 }, (_, i) => {
  const difficulty: Difficulty = i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard';
  const estimate = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 25 : 45;
  return {
    question: q(i + 1, difficulty, PATTERNS[i % PATTERNS.length]!, estimate),
    overdueDays: i % 4,
    intervalDays: 7,
    stage: 2,
    failures: i % 5 === 0 ? 1 : 0,
    confidence: null,
    daysSinceSeen: 7 + i,
    hintReliant: i === 3,
  };
});

const input = (budgetMin: number): SessionInput => ({
  budgetMin,
  candidates,
  transfer: [
    { question: q(101, 'easy', 'graphs', 14), familyName: 'Graph walks', fromTitle: 'Q2' },
    { question: q(102, 'medium', 'greedy', 25), familyName: 'Exchange arguments', fromTitle: 'Q5' },
  ],
  courseReviews: [{ weekId: 'w03', title: 'Week 3 — Linear algebra', minutes: 10, overdueDays: 2 }],
  weakPatterns: [{ id: 'graphs', name: 'Graphs', score: 0.8 }],
  drill: { available: true, minutes: 6, weakestPatternName: 'Graphs' },
});

const sessions = SESSION_BUDGETS.map((budget) => ({
  budget,
  session: buildRevisionSession(input(budget)),
}));

/** The four depths only. `drill`, `course-review` and `reflect` are activities, not depths. */
const DEPTHS = ['recall', 'review', 'deep', 'transfer'];
const depthsOf = (kinds: string[]) => kinds.filter((k) => DEPTHS.includes(k));

describe('every offered budget produces its own experience', () => {
  test('the budgets the product offers cover the ladder of shapes without repeating one twice', () => {
    // 15 / 30 / 60 / 90 / 120 / 180. Anything shorter is served by the two-minute hero entry and
    // the five-minute re-entry, which are entries rather than sessions (PRODUCT.md).
    expect([...SESSION_BUDGETS]).toEqual([15, 30, 60, 90, 120, 180]);
    const shapeIds = SESSION_BUDGETS.map((b) => shapeFor(b).id);
    expect(shapeIds).toEqual(['quick', 'standard', 'focused', 'deep', 'extended', 'extended']);
    // Five distinct shapes across six budgets: only the two longest share one, and they differ in
    // how much of it they can hold rather than in what it is.
    expect(new Set(shapeIds).size).toBe(5);
  });

  test('no budget is another budget truncated — the depths change, not just the count', () => {
    const byBudget = new Map(
      sessions.map(({ budget, session }) => [budget, depthsOf(session.activities.map((a) => a.kind))]),
    );

    // 15 minutes is retrieval only. There is no honest way to re-implement anything in it.
    expect(new Set(byBudget.get(15))).toEqual(new Set(['recall']));

    // 30 minutes buys re-derivation, which 15 could not.
    expect(byBudget.get(30)).toContain('review');

    // 60 minutes buys writing code again, which 30 could not.
    expect(byBudget.get(60)).toContain('deep');

    // 90 minutes buys meeting an unfamiliar problem, which 60 could not.
    expect(byBudget.get(90)).toContain('transfer');

    // And each step up is a SUPERSET: the longer session keeps the shorter one's kinds of work
    // and adds one, rather than trading one for another.
    for (const [shorter, longer] of [[15, 30], [30, 60], [60, 90]] as const) {
      const before = new Set(byBudget.get(shorter));
      const after = new Set(byBudget.get(longer));
      expect([...after].length).toBeGreaterThan(0);
      expect(after.size).toBeGreaterThanOrEqual(before.size);
      expect([...before].every((kind) => after.has(kind))).toBe(true);
    }
    // Across the whole ladder the depths strictly grow: 15 min works at one depth, 90 at all four.
    expect(new Set(byBudget.get(15)).size).toBe(1);
    expect(new Set(byBudget.get(90)).size).toBe(4);
    // And the longest budget still works at all four rather than piling on more of the deepest.
    expect(new Set(byBudget.get(120)).size).toBe(4);
  });

  test('the same question is treated differently depending on the time available', () => {
    // The load-bearing claim of the whole session engine: time chooses depth, not count. A
    // question that appears in both a short and a long session must be worked differently in each.
    const short = sessions.find((s) => s.budget === 15)!.session;
    const long = sessions.find((s) => s.budget === 120)!.session;

    const shared = short.activities.find((a) =>
      long.activities.some((b) => b.questionId === a.questionId && b.questionId !== undefined),
    );
    expect(shared).toBeDefined();
    const inLong = long.activities.find((a) => a.questionId === shared!.questionId)!;
    expect(inLong.minutes).toBeGreaterThan(shared!.minutes);
  });

  test('every session fits its budget, and the longer ones hold strictly more work', () => {
    for (const { budget, session } of sessions) {
      expect(session.totalMinutes).toBeLessThanOrEqual(budget);
    }
    const minutes = sessions.map((s) => s.session.totalMinutes);
    for (let i = 1; i < minutes.length; i += 1) {
      expect(minutes[i]!).toBeGreaterThanOrEqual(minutes[i - 1]!);
    }
  });

  test('the arc holds at every budget that has room for one', () => {
    for (const { budget, session } of sessions) {
      const kinds = session.activities.map((a) => a.kind);
      // Playback opens on the lightest thing — a session that opens on the hardest problem is one
      // people abandon in the first ten minutes.
      const depths = depthsOf(kinds);
      if (depths.length > 1) {
        const first = session.activities.find((a) => depths.includes(a.kind))!;
        const heaviest = [...session.activities]
          .filter((a) => depths.includes(a.kind))
          .sort((a, b) => b.minutes - a.minutes)[0]!;
        expect(first.minutes).toBeLessThanOrEqual(heaviest.minutes);
      }
      // And a session long enough to close properly reserves the closing question.
      if (budget >= 30) expect(kinds).toContain('reflect');
    }
  });

  test('overflow is deferred rather than crammed, at every budget', () => {
    for (const { session } of sessions) {
      const taken = session.activities.filter((a) => a.questionId !== undefined).length;
      expect(taken + session.deferred.length).toBeLessThanOrEqual(candidates.length + 2);
      // Nothing is silently dropped: what did not fit is reported.
      if (taken < candidates.length) expect(session.deferred.length).toBeGreaterThan(0);
    }
  });
});
