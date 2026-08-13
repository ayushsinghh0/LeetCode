import { buildSession, rankWork, type WorkInput } from '@/utils/engine/nextAction';
import type { DailyTask, Question } from '@/types';
import { QF } from '@/test/questionFixture';

const q = (id: number, estimatedTime: number, overrides: Partial<Question> = {}): Question => ({
  id, title: `Q${id}`, pattern: 'two-pointers', difficulty: 'medium', estimatedTime, ...QF, ...overrides,
});

const task = (id: string, estMinutes: number | null = null): DailyTask => ({
  id, title: `Task ${id}`, category: 'project', date: '2026-07-30', done: false,
  completedOn: null, estMinutes, notes: '',
});

const base: WorkInput = {
  revisions: [],
  newQuestions: [],
  drill: { eligible: true, doneToday: true, missedMostPatternName: null, minutes: 6 },
  course: { dueReviews: [], nextSession: null },
  openTasks: [],
  taskDefaultMinutes: 15,
};

describe('rankWork ordering', () => {
  test('retention outranks acquisition: a due revision beats a new question', () => {
    const items = rankWork({
      ...base,
      revisions: [{ question: q(1, 25), overdueDays: 0, intervalDays: 3, minutes: 9, topUp: false }],
      newQuestions: [{ question: q(2, 25), minutes: 25 }],
    });

    expect(items.map((i) => i.kind)).toEqual(['revision', 'new-question']);
  });

  test('the most overdue revision leads, and its reason names the elapsed step', () => {
    const items = rankWork({
      ...base,
      revisions: [
        { question: q(1, 25), overdueDays: 1, intervalDays: 3, minutes: 9, topUp: false },
        { question: q(2, 25), overdueDays: 6, intervalDays: 7, minutes: 9, topUp: false },
      ],
    });

    expect(items[0]!.title).toBe('Q2');
    expect(items[0]!.why).toContain('Waiting 6 days past its 7-day step');
    // Factual framing only — no loss or failure language anywhere in the reason.
    expect(items[0]!.why).not.toMatch(/lose|lost|fail|behind|streak/i);
  });

  test('a weekly top-up is not described as due, and ranks below work that actually is', () => {
    const items = rankWork({
      ...base,
      revisions: [
        // Pulled forward from a future date by the weekly-revision-day top-up.
        { question: q(9, 25), overdueDays: 0, intervalDays: 15, minutes: 9, topUp: true },
        { question: q(1, 25), overdueDays: 0, intervalDays: 3, minutes: 9, topUp: false },
      ],
    });

    expect(items[0]!.title).toBe('Q1');
    expect(items[1]!.title).toBe('Q9');
    // The top-up must not assert a ladder step that has not arrived.
    expect(items[1]!.why).toContain('not due yet');
    expect(items[1]!.why).not.toContain('15-day step');
  });

  test('a revision due today names the step rather than reading as overdue', () => {
    const items = rankWork({
      ...base,
      revisions: [{ question: q(1, 25), overdueDays: 0, intervalDays: 15, minutes: 9, topUp: false }],
    });

    expect(items[0]!.why).toContain('Today is the 15-day step');
  });

  test('a new question carries its authored capability sentence as the reason', () => {
    const question = q(3, 25, { tests: 'Whether you can trade a nested scan for a single pass.' });
    const items = rankWork({ ...base, newQuestions: [{ question, minutes: 25 }] });

    expect(items[0]!.why).toBe('Whether you can trade a nested scan for a single pass.');
  });

  test('the drill is withheld until it is eligible, then ranks above new material', () => {
    const ineligible = rankWork({
      ...base,
      drill: { ...base.drill, eligible: false, doneToday: false },
      newQuestions: [{ question: q(1, 25), minutes: 25 }],
    });
    expect(ineligible.map((i) => i.kind)).toEqual(['new-question']);

    const eligible = rankWork({
      ...base,
      drill: { ...base.drill, eligible: true, doneToday: false },
      newQuestions: [{ question: q(1, 25), minutes: 25 }],
    });
    expect(eligible.map((i) => i.kind)).toEqual(['drill', 'new-question']);
  });

  test('a drill already taken today is not offered again', () => {
    const items = rankWork({ ...base, drill: { ...base.drill, eligible: true, doneToday: true } });
    expect(items).toEqual([]);
  });

  test('the drill names its own basis — the most-missed drill pattern — and claims nothing wider', () => {
    const items = rankWork({
      ...base,
      drill: { eligible: true, doneToday: false, missedMostPatternName: 'Sliding Window', minutes: 6 },
    });
    expect(items[0]!.why).toContain('Sliding Window');
    // The drill is weighted by raw cumulative drill misses, which carry no recency decay and are
    // NOT the product's weakness model (`selectPatternWeakness` is, and it is the only one). This
    // sentence used to read "where your recent answers have been shakiest" — a weakness claim,
    // worded identically to the one `session.ts` emits from that other source, so Today and
    // Revision could name different weakest patterns in the same sitting.
    expect(items[0]!.why).toContain('recognition drills');
    expect(items[0]!.why).not.toMatch(/shakiest|weakest|recent/i);
  });

  test("the learner's own tasks rank last — the ranker does not second-guess their urgency", () => {
    const items = rankWork({
      ...base,
      newQuestions: [{ question: q(1, 25), minutes: 25 }],
      openTasks: [task('t1')],
      course: { dueReviews: [], nextSession: { weekId: 'w01', title: 'Week 1', minutes: 60 } },
    });

    expect(items.map((i) => i.kind)).toEqual(['new-question', 'course-session', 'task']);
  });

  test('a task without an estimate falls back to the plan default', () => {
    const items = rankWork({ ...base, openTasks: [task('t1'), task('t2', 40)] });
    expect(items.map((i) => i.minutes)).toEqual([15, 40]);
  });
});

describe('buildSession — fixed time, variable scope', () => {
  const ranked = rankWork({
    ...base,
    revisions: [{ question: q(1, 25), overdueDays: 2, intervalDays: 3, minutes: 9, topUp: false }],
    drill: { ...base.drill, doneToday: false },
    newQuestions: [{ question: q(2, 30), minutes: 30 }, { question: q(3, 12), minutes: 12 }],
  });

  test('packs the highest-ranked items that fit and reports the remainder', () => {
    const session = buildSession(20, ranked);

    expect(session.items.map((i) => i.kind)).toEqual(['revision', 'drill']);
    expect(session.totalMinutes).toBe(15);
    expect(session.leftoverMin).toBe(5);
    expect(session.skipped).toHaveLength(2);
  });

  test('a lower-ranked item may fill space a larger one could not — but never displaces it', () => {
    const session = buildSession(35, ranked);

    // 9 (revision) + 6 (drill) = 15; the 30m question does not fit in the remaining 20, so the
    // 12m one takes the slot. The bigger item is skipped, not the more valuable one.
    expect(session.items.map((i) => i.title)).toEqual(['Q1', 'Recognition drill', 'Q3']);
    expect(session.skipped.map((i) => i.title)).toEqual(['Q2']);
  });

  test('a budget too small for anything yields an empty plan rather than an over-budget one', () => {
    const session = buildSession(3, ranked);

    expect(session.items).toEqual([]);
    expect(session.totalMinutes).toBe(0);
    expect(session.skipped).toHaveLength(ranked.length);
  });

  test('a generous budget takes everything and reports the spare time honestly', () => {
    const session = buildSession(600, ranked);

    expect(session.items).toHaveLength(ranked.length);
    expect(session.skipped).toEqual([]);
    expect(session.leftoverMin).toBe(600 - session.totalMinutes);
  });
});
