import {
  activityLoad,
  buildRevisionSession,
  depthMinutes,
  HEAVY_LOAD,
  REFLECT_MINUTES,
  sessionProgress,
  shapeFor,
  type RevisionCandidate,
  type SessionInput,
} from '@/utils/engine/session';
import { revisionMinutes } from '@/utils/engine/planner';
import type { Difficulty, PatternId, Question } from '@/types';
import { QF } from '@/test/questionFixture';

const q = (
  id: number,
  overrides: Partial<Question> = {},
): Question => ({
  id,
  title: `Q${id}`,
  pattern: 'two-pointers',
  difficulty: 'medium',
  estimatedTime: 25,
  ...QF,
  ...overrides,
});

const candidate = (
  id: number,
  overrides: Partial<RevisionCandidate> = {},
  question: Partial<Question> = {},
): RevisionCandidate => ({
  question: q(id, question),
  overdueDays: 0,
  intervalDays: 3,
  stage: 2,
  failures: 0,
  confidence: null,
  daysSinceSeen: 3,
  hintReliant: false,
  ...overrides,
});

const base: SessionInput = {
  budgetMin: 30,
  candidates: [],
  transfer: [],
  courseReviews: [],
  weakPatterns: [],
  drill: null,
};

describe('shapeFor — time chooses the depth', () => {
  test('a short session is retrieval only; there is no honest way to re-implement in 15 minutes', () => {
    const shape = shapeFor(15);
    expect(shape.id).toBe('quick');
    expect(shape.mix.recall).toBe(1);
    expect(shape.mix.deep).toBe(0);
  });

  test('an hour buys reasoning and one piece of real implementation', () => {
    const shape = shapeFor(60);
    expect(shape.id).toBe('focused');
    expect(shape.mix.deep).toBeGreaterThan(0);
    expect(shape.mix.transfer).toBe(0);
  });

  test('transfer only earns a slot once the budget is long enough to afford it', () => {
    expect(shapeFor(75).mix.transfer).toBe(0);
    expect(shapeFor(90).mix.transfer).toBeGreaterThan(0);
    expect(shapeFor(180).id).toBe('extended');
  });
});

describe('depthMinutes — cost derived from the question, not a flat constant', () => {
  test('the same question costs different amounts at different depths', () => {
    const hard = q(1, { estimatedTime: 50, difficulty: 'hard' });
    expect(depthMinutes(hard, 'recall')).toBeLessThan(depthMinutes(hard, 'review'));
    expect(depthMinutes(hard, 'review')).toBeLessThan(depthMinutes(hard, 'deep'));
    expect(depthMinutes(hard, 'deep')).toBeLessThan(depthMinutes(hard, 'transfer'));
  });

  test('review reuses the one existing revision figure rather than inventing a second one', () => {
    const question = q(1, { estimatedTime: 34 });
    expect(depthMinutes(question, 'review')).toBe(revisionMinutes(question));
  });

  test('a quick recall stays quick however long the underlying problem is', () => {
    expect(depthMinutes(q(1, { estimatedTime: 60 }), 'recall')).toBeLessThanOrEqual(5);
    expect(depthMinutes(q(2, { estimatedTime: 8 }), 'recall')).toBeGreaterThanOrEqual(3);
  });
});

describe('buildRevisionSession — the session fits the time', () => {
  const many = Array.from({ length: 12 }, (_, i) => candidate(i + 1, { overdueDays: i }));

  test('never plans more minutes than the learner said they had', () => {
    for (const budget of [15, 30, 60, 90, 120, 180]) {
      const session = buildRevisionSession({ ...base, budgetMin: budget, candidates: many });
      expect(session.totalMinutes).toBeLessThanOrEqual(budget);
    }
  });

  test('a 15-minute session is entirely recall — no re-implementation is offered', () => {
    const session = buildRevisionSession({ ...base, budgetMin: 15, candidates: many });

    expect(session.activities.length).toBeGreaterThan(0);
    expect(session.activities.every((a) => a.kind === 'recall')).toBe(true);
    expect(session.shape.label).toBe('Quick recall');
  });

  test('a long session spans recall through transfer, in that order', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 180,
      candidates: many,
      transfer: [{ question: q(99, { estimatedTime: 30 }), familyName: 'Interval merging', fromTitle: 'Merge Intervals' }],
    });

    const kinds = session.activities.map((a) => a.kind);
    expect(kinds).toContain('recall');
    expect(kinds).toContain('review');
    expect(kinds).toContain('deep');
    expect(kinds).toContain('transfer');
    // The arc: transfer is the stretch at the end, never the opener.
    expect(kinds.indexOf('transfer')).toBeGreaterThan(kinds.indexOf('recall'));
    expect(kinds[kinds.length - 1]).toBe('reflect');
  });

  test('a short session gets no reflection step — three minutes of fifteen is not a good trade', () => {
    const short = buildRevisionSession({ ...base, budgetMin: 15, candidates: many });
    expect(short.activities.some((a) => a.kind === 'reflect')).toBe(false);

    const long = buildRevisionSession({ ...base, budgetMin: 60, candidates: many });
    const reflect = long.activities.find((a) => a.kind === 'reflect');
    expect(reflect?.minutes).toBe(REFLECT_MINUTES);
  });

  test('an empty queue produces an empty session rather than an invented one', () => {
    const session = buildRevisionSession({ ...base, budgetMin: 60 });
    expect(session.activities).toEqual([]);
    expect(session.totalMinutes).toBe(0);
  });
});

describe('buildRevisionSession — cognitive load, not just minutes', () => {
  // Four hard problems coming due together is a fact about the ladder. Making them all one
  // evening's work is a choice, and it is the choice that makes people stop revising.
  const fourHard = Array.from({ length: 4 }, (_, i) =>
    candidate(i + 1, { overdueDays: 4 - i }, { difficulty: 'hard', estimatedTime: 45 }),
  );

  test('load is not proportional to minutes', () => {
    expect(activityLoad('hard', 'recall')).toBeLessThan(activityLoad('easy', 'deep'));
  });

  test('a short session refuses to stack every hard problem that happens to be due', () => {
    const session = buildRevisionSession({ ...base, budgetMin: 30, candidates: fourHard });

    const heavy = session.activities.filter((a) => a.load >= HEAVY_LOAD);
    expect(heavy.length).toBeLessThanOrEqual(1);
    // The rest are not lost — they are reported as deferred.
    expect(session.deferred.length).toBeGreaterThan(0);
  });

  test('the number of demanding items scales with the session, at every length', () => {
    const eightHard = Array.from({ length: 8 }, (_, i) =>
      candidate(i + 1, { overdueDays: 8 - i }, { difficulty: 'hard', estimatedTime: 45 }),
    );

    for (const budget of [15, 30, 60, 90, 120, 180]) {
      const session = buildRevisionSession({ ...base, budgetMin: budget, candidates: eightHard });
      const heavy = session.activities.filter((a) => a.load >= HEAVY_LOAD);
      expect(heavy.length).toBeLessThanOrEqual(Math.ceil(budget / 45));
    }
  });

  test('two heavy items never sit next to each other', () => {
    const mixed = [
      ...Array.from({ length: 4 }, (_, i) =>
        candidate(i + 1, { overdueDays: 8 - i }, { difficulty: 'hard', estimatedTime: 40 }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        candidate(i + 10, { overdueDays: 4 - i }, { difficulty: 'easy', estimatedTime: 12 }),
      ),
    ];
    const session = buildRevisionSession({ ...base, budgetMin: 180, candidates: mixed });

    for (let i = 1; i < session.activities.length; i++) {
      const prev = session.activities[i - 1]!;
      const curr = session.activities[i]!;
      expect(prev.load >= HEAVY_LOAD && curr.load >= HEAVY_LOAD).toBe(false);
    }
  });
});

describe('buildRevisionSession — priority and its explanation', () => {
  test('the most overdue item leads, and its reason names the elapsed step', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 30,
      candidates: [
        candidate(1, { overdueDays: 0, intervalDays: 3 }),
        candidate(2, { overdueDays: 9, intervalDays: 7 }),
      ],
    });

    const lead = session.activities[0]!;
    expect(lead.title).toBe('Q2');
    expect(lead.why).toContain('9 days past its 7-day step');
  });

  test('a repeatedly-missed question outranks a merely-due one, and says so', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 30,
      candidates: [candidate(1), candidate(2, { failures: 3 })],
    });

    expect(session.activities[0]!.title).toBe('Q2');
    expect(session.activities[0]!.why).toContain('3 reviews');
  });

  test('a weak pattern raises an item and the reason names the pattern, not a score', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 30,
      candidates: [candidate(1), candidate(2, {}, { pattern: 'graphs' })],
      weakPatterns: [{ id: 'graphs' as PatternId, name: 'Graphs', score: 1 }],
    });

    const lead = session.activities[0]!;
    expect(lead.title).toBe('Q2');
    expect(lead.why).toContain('Graphs');
    expect(lead.why).not.toMatch(/score|0\.\d/);
  });

  test('a hint-reliant item takes the deep slot — reconstruction is the treatment (V7)', () => {
    // 60m focused: plan budget 57 after the reflect reserve, deep allowance 14 — a 20-minute
    // question's deep treatment costs 12, so exactly one of these two fits the deep band, and
    // the assertion below fails honestly if that footing ever moves (0 or 2 would both fail).
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: [
        candidate(1, {}, { estimatedTime: 20 }),
        candidate(2, { hintReliant: true }, { estimatedTime: 20 }),
      ],
    });

    const deep = session.activities.filter((a) => a.kind === 'deep');
    expect(deep.map((a) => a.questionId)).toEqual([2]);
    const why = deep[0]!.why;
    expect(why).toMatch(/hint/i);
    expect(why).toMatch(/unaided|re-deriv/i);
    // Copy rule: a support feature must never read as a penalty.
    expect(why).not.toMatch(/penalt|because you needed|had to|crutch|dependen/i);
  });

  test('an actually-failed review outranks hint reliance — a real miss is stronger evidence', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: [
        candidate(1, { failures: 2 }, { estimatedTime: 20 }),
        candidate(2, { hintReliant: true }, { estimatedTime: 20 }),
      ],
    });

    const deep = session.activities.filter((a) => a.kind === 'deep');
    expect(deep.map((a) => a.questionId)).toEqual([1]);
  });

  test('no reason ever uses loss, blame, or streak language', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 120,
      candidates: [
        candidate(1, { overdueDays: 30, failures: 3, confidence: 1 }),
        candidate(2, { overdueDays: 5, stage: 0 }),
        candidate(3, { overdueDays: -4 }),
      ],
    });

    for (const activity of session.activities) {
      expect(activity.why).not.toMatch(/lose|lost|forget|fail(ing|ed)?\b|behind|streak|should have/i);
    }
  });
});

describe('buildRevisionSession — overflow and surplus', () => {
  test('work that does not fit is deferred, never silently dropped', () => {
    const many = Array.from({ length: 20 }, (_, i) => candidate(i + 1, { overdueDays: 20 - i }));
    const session = buildRevisionSession({ ...base, budgetMin: 30, candidates: many });

    const planned = new Set(session.activities.map((a) => a.questionId));
    expect(session.deferred.length).toBeGreaterThan(0);
    for (const item of session.deferred) {
      expect(planned.has(item.question.id)).toBe(false);
    }
    expect(session.activities.length + session.deferred.length).toBeLessThanOrEqual(many.length + 1);
  });

  test('spare time pulls tomorrow forward rather than padding, and is labelled as not due', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 90,
      candidates: [candidate(1), candidate(2, { overdueDays: -2 }), candidate(3, { overdueDays: -5 })],
    });

    // The pull-forward is asserted on the plan itself — the not-due item is IN the session —
    // not on a flag about it. (`usedSurplus` was such a flag; nothing consumed it.)
    const pulled = session.activities.find((a) => a.questionId === 2);
    expect(pulled).toBeDefined();
    expect(pulled!.why).toContain('Not due yet');
    expect(pulled!.why).not.toContain('3-day step');
  });

  test('a not-due item never outranks one whose date has actually arrived', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: [candidate(1, { overdueDays: -1 }), candidate(2, { overdueDays: 0 })],
    });

    const due = session.activities.findIndex((a) => a.questionId === 2);
    const notDue = session.activities.findIndex((a) => a.questionId === 1);
    expect(due).toBeLessThan(notDue);
  });
});

describe('buildRevisionSession — the other track and the diagnostic', () => {
  test('course reviews join the session but may not crowd out question revision', () => {
    const courseReviews = Array.from({ length: 6 }, (_, i) => ({
      weekId: `w0${i + 1}`,
      title: `Week ${i + 1}`,
      minutes: 10,
      overdueDays: i,
    }));
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: Array.from({ length: 6 }, (_, i) => candidate(i + 1, { overdueDays: i })),
      courseReviews,
    });

    const course = session.activities.filter((a) => a.kind === 'course-review');
    const questions = session.activities.filter((a) => a.questionId !== undefined);
    expect(course.length).toBeGreaterThan(0);
    expect(questions.length).toBeGreaterThan(0);
    expect(session.rationale.retention).toBe(course.length);

    // Placed and deferred partition the due course reviews: nothing counted twice, nothing lost.
    expect(course.length + session.deferredCourseReviews.length).toBe(courseReviews.length);
    const placedIds = new Set(course.map((a) => a.weekId));
    for (const left of session.deferredCourseReviews) {
      expect(placedIds.has(left.weekId)).toBe(false);
    }
  });

  test('the short budgets cannot place a course recall at all — and report the ones they left', () => {
    // A course recall is a flat ten minutes; there is no shallower version of one. Half the
    // review band of a 30-minute session is nine, and a 15-minute session has no review band at
    // all — so at both lengths every due course review is left behind. That is a real property of
    // the shapes rather than an accident of this fixture, and the thing being pinned is that the
    // session SAYS so instead of dropping them on the floor.
    const courseReviews = [
      { weekId: 'w01', title: 'Week 1', minutes: 10, overdueDays: 3 },
      { weekId: 'w02', title: 'Week 2', minutes: 10, overdueDays: 1 },
    ];

    for (const budgetMin of [15, 30]) {
      const session = buildRevisionSession({
        ...base,
        budgetMin,
        candidates: [candidate(1, { overdueDays: 2 })],
        courseReviews,
      });

      expect(session.activities.filter((a) => a.kind === 'course-review')).toHaveLength(0);
      expect(session.rationale.retention).toBe(0);
      expect(session.deferredCourseReviews.map((r) => r.weekId)).toEqual(['w01', 'w02']);
    }
  });

  test('an hour places what it can and defers the rest, on both tracks at once', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      // Three due course weeks against a 15-minute course allowance: one fits, two wait.
      courseReviews: Array.from({ length: 3 }, (_, i) => ({
        weekId: `w0${i + 1}`,
        title: `Week ${i + 1}`,
        minutes: 10,
        overdueDays: 3 - i,
      })),
      candidates: [candidate(1, { overdueDays: 4 })],
    });

    expect(session.rationale.retention).toBe(1);
    expect(session.deferredCourseReviews).toHaveLength(2);
  });

  test('a session that placed every due course review reports nothing left on that track', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 180,
      candidates: [candidate(1)],
      courseReviews: [{ weekId: 'w01', title: 'Week 1', minutes: 10, overdueDays: 2 }],
    });

    expect(session.rationale.retention).toBe(1);
    expect(session.deferredCourseReviews).toEqual([]);
  });

  test('the drill opens the session when it is available', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: [candidate(1)],
      drill: { available: true, minutes: 6, weakestPatternName: 'Graphs' },
    });

    expect(session.activities[0]!.kind).toBe('drill');
    expect(session.activities[0]!.why).toContain('Graphs');
  });

  test('an unavailable drill is simply absent', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: [candidate(1)],
      drill: { available: false, minutes: 6, weakestPatternName: null },
    });

    expect(session.activities.some((a) => a.kind === 'drill')).toBe(false);
  });

  test('transfer opens on the weakest pattern, because that is where an unfamiliar problem pays', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 180,
      candidates: [candidate(1)],
      weakPatterns: [{ id: 'graphs' as PatternId, name: 'Graphs', score: 1 }],
      transfer: [
        { question: q(50, { pattern: 'stacks' }), familyName: 'Monotonic stack', fromTitle: 'Daily Temperatures' },
        { question: q(51, { pattern: 'graphs' }), familyName: 'Grid traversal', fromTitle: 'Number of Islands' },
      ],
    });

    const transfers = session.activities.filter((a) => a.kind === 'transfer');
    expect(transfers[0]!.questionId).toBe(51);
    expect(transfers[0]!.why).toContain('Number of Islands');
  });
});

describe('sessionProgress — minutes as well as count', () => {
  test('reports how much of the evening is actually gone, not just how many rows are ticked', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 60,
      candidates: Array.from({ length: 5 }, (_, i) => candidate(i + 1, { overdueDays: 5 - i })),
    });

    const first = session.activities[0]!;
    const progress = sessionProgress(session, [first.id]);

    expect(progress.doneCount).toBe(1);
    expect(progress.totalCount).toBe(session.activities.length);
    expect(progress.doneMinutes).toBe(first.minutes);
    expect(progress.totalMinutes).toBe(session.totalMinutes);
  });

  test('an unknown id contributes nothing rather than throwing', () => {
    const session = buildRevisionSession({ ...base, budgetMin: 60, candidates: [candidate(1)] });
    expect(sessionProgress(session, ['nope']).doneCount).toBe(0);
  });
});

describe('focus and rationale — what the preview tells the learner', () => {
  test('focus lists the distinct patterns the session touches', () => {
    const patterns: Difficulty[] = [];
    void patterns;
    const session = buildRevisionSession({
      ...base,
      budgetMin: 120,
      candidates: [
        candidate(1, { overdueDays: 3 }, { pattern: 'graphs' }),
        candidate(2, { overdueDays: 2 }, { pattern: 'graphs' }),
        candidate(3, { overdueDays: 1 }, { pattern: 'sliding-window' }),
      ],
    });

    expect(new Set(session.focus)).toEqual(new Set(['graphs', 'sliding-window']));
  });

  test('the rationale separates work that is due from work that is overdue', () => {
    const session = buildRevisionSession({
      ...base,
      budgetMin: 120,
      candidates: [candidate(1, { overdueDays: 0 }), candidate(2, { overdueDays: 6 })],
    });

    expect(session.rationale.due).toBe(1);
    expect(session.rationale.overdue).toBe(1);
  });
});
