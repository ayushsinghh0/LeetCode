import { describe, expect, test } from 'vitest';
import { QF } from '@/test/questionFixture';
import * as interviewEngine from '@/utils/engine/interview';
import {
  FIRST_STAGE,
  LAST_STAGE,
  MAX_FOLLOW_UPS,
  REVEALS,
  DRAW_BASIS_NOTE,
  FOLLOW_UP_OUTCOMES,
  FOLLOW_UP_OUTCOME_LABEL,
  SELF_ASSESSMENT,
  SELF_ASSESSMENT_SCALE,
  STAGES,
  followUpsFor,
  interviewDraws,
  formatElapsed,
  isRevealed,
  isSelfAssessmentValue,
  isStageReached,
  nextStage,
  paceNote,
  paceReading,
  revealById,
  stageById,
  stageIndex,
  type FollowUpAxis,
  type RevealId,
  type StageId,
} from '@/utils/engine/interview';
import type { ProblemFamily, Question } from '@/types';

function q(over: Partial<Question> = {}): Question {
  return {
    id: 1,
    title: 'Fixture problem',
    pattern: 'hash-maps',
    difficulty: 'medium',
    estimatedTime: 25,
    ...QF,
    ...over,
  };
}

function fam(over: Partial<ProblemFamily> = {}): ProblemFamily {
  return {
    id: 'fixture-family',
    pattern: 'hash-maps',
    name: 'Fixture family',
    idea: 'Keep a map from value to index so the second half of each pair is a lookup.',
    signals: ['asks for a pair summing to a target', 'the answer is a pair of indices'],
    trap: 'Sorting first, which destroys the indices the answer is stated in.',
    members: [],
    ...over,
  };
}

function axes(question: Question, family?: ProblemFamily): FollowUpAxis[] {
  return followUpsFor(question, family).map((f) => f.axis);
}

describe('the stage model', () => {
  test('runs understand -> clarify -> approach -> ... -> follow-up, in that order', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'understand',
      'clarify',
      'approach',
      'brute-force',
      'optimize',
      'invariant',
      'implement',
      'test',
      'complexity',
      'follow-up',
    ]);
    expect(FIRST_STAGE).toBe('understand');
    expect(LAST_STAGE).toBe('follow-up');
  });

  test('every stage carries the four things the UI needs from it', () => {
    for (const stage of STAGES) {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.prompt.length).toBeGreaterThan(0);
      // The self-report is a question about the learner, not about the problem.
      expect(stage.reports.length).toBeGreaterThan(0);
      expect(stage.advance.length).toBeGreaterThan(0);
      expect(stage.check.length).toBeGreaterThan(0);
    }
  });

  test('nextStage walks the whole list once and then stops', () => {
    const walked: StageId[] = [FIRST_STAGE];
    let current: StageId | null = FIRST_STAGE;
    while ((current = nextStage(current)) !== null) walked.push(current);
    expect(walked).toEqual(STAGES.map((s) => s.id));
    expect(nextStage(LAST_STAGE)).toBeNull();
  });

  test('stageIndex and isStageReached agree with the list order', () => {
    expect(stageIndex('understand')).toBe(0);
    expect(stageIndex('follow-up')).toBe(STAGES.length - 1);
    expect(isStageReached('approach', 'invariant')).toBe(true);
    expect(isStageReached('invariant', 'approach')).toBe(false);
    expect(isStageReached('approach', 'approach')).toBe(true);
  });

  test('the spec register survives — the controls are the transitions, not the destinations', () => {
    // "I'm ready to code" leaves the invariant stage; naming it on `implement` would put the
    // button one stage after the moment the learner presses it.
    expect(stageById.invariant.advance).toBe("I'm ready to code");
    expect(stageById.approach.advance).toBe('I have an approach');
    expect(stageById['follow-up'].advance).toBe("I'm done");
  });
});

describe('progressive reveal', () => {
  const ALL: RevealId[] = ['hints', 'pattern', 'family', 'tests', 'complexity', 'follow-ups'];

  test('every reveal is claimed by exactly one stage, and REVEALS matches STAGES', () => {
    const claimed = STAGES.flatMap((s) => s.reveals);
    expect([...claimed].sort()).toEqual([...ALL].sort());
    expect(REVEALS.map((r) => r.id).sort()).toEqual([...ALL].sort());
    for (const reveal of REVEALS) {
      expect(stageById[reveal.revealAt].reveals).toContain(reveal.id);
      // The locked line has to name the gate without naming the content behind it.
      expect(reveal.locked.length).toBeGreaterThan(0);
    }
  });

  test('the opening stage reveals nothing at all', () => {
    for (const id of ALL) expect(isRevealed(id, FIRST_STAGE)).toBe(false);
    expect(stageById.understand.reveals).toEqual([]);
    expect(stageById.clarify.reveals).toEqual([]);
  });

  test('the pattern waits until the learner has committed to an approach', () => {
    expect(revealById.pattern.revealAt).toBe('brute-force');
    expect(isRevealed('pattern', 'approach')).toBe(false);
    expect(isRevealed('pattern', 'brute-force')).toBe(true);
    expect(isRevealed('pattern', 'implement')).toBe(true);
  });

  test('hints arrive when the learner is first asked to produce something', () => {
    expect(revealById.hints.revealAt).toBe('approach');
    expect(isRevealed('hints', 'clarify')).toBe(false);
    expect(isRevealed('hints', 'approach')).toBe(true);
  });

  test('the intended bounds stay shut while the learner is being asked for their own', () => {
    // Revealing at the `complexity` stage would hand over the answer to that stage's question.
    expect(revealById.complexity.revealAt).toBe('follow-up');
    expect(isRevealed('complexity', 'complexity')).toBe(false);
    expect(isRevealed('complexity', 'follow-up')).toBe(true);
  });

  test('the family and the capability sentence land after the learner has been asked for them', () => {
    expect(revealById.family.revealAt).toBe('invariant');
    expect(isRevealed('family', 'optimize')).toBe(false);
    expect(revealById.tests.revealAt).toBe('implement');
    expect(isRevealed('tests', 'test')).toBe(true);
  });

  test('an ended attempt reveals everything, however early it ended', () => {
    for (const id of ALL) expect(isRevealed(id, FIRST_STAGE, true)).toBe(true);
  });
});

describe('follow-ups are derived, never authored', () => {
  test('a family contributes the changed-constraint round, quoting its own trap', () => {
    const family = fam();
    const found = followUpsFor(q({ complexity: { time: 'O(n)', space: 'O(n)' } }), family);
    const constraints = found.find((f) => f.axis === 'constraints');
    expect(constraints).toBeDefined();
    expect(constraints!.because).toContain(family.trap);
  });

  test('without a family the round is shorter, and nothing is invented to fill it', () => {
    const question = q({ complexity: { time: 'O(n)', space: 'O(n)' } });
    const withFamily = followUpsFor(question, fam());
    const without = followUpsFor(question, undefined);

    expect(without.length).toBeLessThan(withFamily.length);
    expect(axes(question)).not.toContain('constraints');
    // Everything still present is grounded in the question's own record.
    for (const followUp of without) expect(followUp.because.length).toBeGreaterThan(0);
  });

  test('a variant earns the changed-constraint round on its own, family or not', () => {
    // `variant` is defined as "one changed constraint breaks the standard solution" — the axis is
    // that definition, so the type alone is evidence.
    expect(axes(q({ type: 'variant' }))).toContain('constraints');
    expect(axes(q({ type: 'foundation' }))).not.toContain('constraints');
  });

  test('memory reduction is offered only where the intended solution actually allocates', () => {
    expect(axes(q({ complexity: { time: 'O(n)', space: 'O(n)' } }))).toContain('memory');
    expect(axes(q({ complexity: { time: 'O(n)', space: 'O(1)' } }))).not.toContain('memory');
    // No recorded bounds is no evidence — the axis is dropped rather than guessed at.
    expect(axes(q())).not.toContain('memory');
  });

  test('the larger-input round follows the recorded time bound, and logs are not exponents', () => {
    expect(axes(q({ complexity: { time: 'O(n^2)', space: 'O(1)' } }))).toContain('scale');
    expect(axes(q({ complexity: { time: 'O(2^n)', space: 'O(1)' } }))).toContain('scale');
    expect(axes(q({ complexity: { time: 'O(n log n)', space: 'O(1)' } }))).not.toContain('scale');
    // O((log n)^2) carries a caret and is still logarithmic.
    expect(axes(q({ complexity: { time: 'O((log n)^2)', space: 'O(1)' } }))).not.toContain('scale');
  });

  test('streaming is asked only of techniques that need the whole input in hand', () => {
    expect(axes(q({ pattern: 'two-pointers' }))).toContain('streaming');
    expect(axes(q({ pattern: 'modified-binary-search' }))).toContain('streaming');
    // A running heap already handles a stream; asking would be asking nothing.
    expect(axes(q({ pattern: 'top-k-elements' }))).not.toContain('streaming');
  });

  test('dynamic updates follow design problems and structure-building techniques', () => {
    expect(axes(q({ type: 'design' }))).toContain('dynamic');
    expect(axes(q({ pattern: 'trie' }))).toContain('dynamic');
    expect(axes(q({ pattern: 'sliding-window', type: 'foundation' }))).not.toContain('dynamic');
  });

  test('a design problem is never asked to handle many queries — it already does', () => {
    const query = q({ type: 'design', complexity: { time: 'O(log n)', space: 'O(n)' } });
    expect(axes(query)).not.toContain('queries');
    expect(axes(q({ type: 'foundation', complexity: { time: 'O(log n)', space: 'O(n)' } }))).toContain(
      'queries',
    );
    // An O(1) answer gains nothing from precomputation.
    expect(axes(q({ complexity: { time: 'O(1)', space: 'O(1)' } }))).not.toContain('queries');
  });

  test('duplicates are asked where the family leans on distinctness, or the pattern invites it', () => {
    const distinct = fam({ idea: 'Every value is distinct, so an index can be derived from a value.' });
    expect(axes(q(), distinct)).toContain('duplicates');
    expect(axes(q(), fam())).not.toContain('duplicates');
    expect(axes(q({ pattern: 'subsets' }))).toContain('duplicates');
  });

  test('the round is capped and deterministically ordered', () => {
    // A question that lights up every axis it can: family, allocating, exponential, whole-input.
    const heavy = q({
      pattern: 'subsets',
      type: 'variant',
      complexity: { time: 'O(n * 2^n)', space: 'O(n)' },
    });
    const found = followUpsFor(heavy, fam({ pattern: 'subsets' }));
    expect(found.length).toBe(MAX_FOLLOW_UPS);
    // Family-grounded axes lead, so the cap bites on the generic ones.
    expect(found.map((f) => f.axis)).toEqual(['constraints', 'duplicates', 'memory', 'scale']);
    // Pure: the same inputs give the same round.
    expect(followUpsFor(heavy, fam({ pattern: 'subsets' }))).toEqual(found);
  });

  test('every follow-up is a question with a stated reason behind it', () => {
    for (const followUp of followUpsFor(q({ complexity: { time: 'O(n^2)', space: 'O(n)' } }), fam())) {
      expect(followUp.question).toMatch(/\?/);
      expect(followUp.label.length).toBeGreaterThan(0);
      expect(followUp.because.length).toBeGreaterThan(0);
    }
  });
});

describe('the timer', () => {
  test('reads elapsed against the question\'s own estimate, and counts up', () => {
    const inside = paceReading(10 * 60, 25);
    expect(inside.elapsedMin).toBe(10);
    expect(inside.recommendedMin).toBe(25);
    expect(inside.over).toBe(false);
    expect(inside.overByMin).toBe(0);
  });

  test('says nothing at all while inside the recommendation', () => {
    expect(paceNote(paceReading(0, 25))).toBeNull();
    expect(paceNote(paceReading(24 * 60 + 59, 25))).toBeNull();
  });

  test('past the recommendation it states a fact, not a verdict', () => {
    const note = paceNote(paceReading(31 * 60, 25));
    expect(note).toContain('6 minutes past the ~25 min recommendation');
    expect(note).toContain('information, not a failure');
    // Never a countdown and never an alarm.
    expect(note).not.toMatch(/remaining|left|out of time|hurry/i);
  });

  test('the moment the recommendation lands is marked without over-counting', () => {
    const reading = paceReading(25 * 60, 25);
    expect(reading.over).toBe(true);
    expect(reading.overByMin).toBe(0);
    expect(paceNote(reading)).toContain('at the ~25 min mark');
  });

  test('formats as m:ss, and only grows an hour field when it needs one', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9)).toBe('0:09');
    expect(formatElapsed(605)).toBe('10:05');
    expect(formatElapsed(3_725)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

describe('self-assessment', () => {
  test('collects the five dimensions the spec names', () => {
    expect(SELF_ASSESSMENT.map((p) => p.id)).toEqual([
      'clarity',
      'complexity',
      'edge-cases',
      'confidence',
      'follow-ups',
    ]);
    for (const prompt of SELF_ASSESSMENT) {
      expect(prompt.question).toMatch(/\?/);
      // Anchors, so a 3 means the same thing on the next attempt as it did on this one.
      expect(prompt.low.length).toBeGreaterThan(0);
      expect(prompt.high.length).toBeGreaterThan(0);
    }
  });

  test('the scale is 1..5 and nothing outside it is accepted', () => {
    expect([...SELF_ASSESSMENT_SCALE]).toEqual([1, 2, 3, 4, 5]);
    expect(isSelfAssessmentValue(1)).toBe(true);
    expect(isSelfAssessmentValue(5)).toBe(true);
    expect(isSelfAssessmentValue(0)).toBe(false);
    expect(isSelfAssessmentValue(6)).toBe(false);
    expect(isSelfAssessmentValue(3.5)).toBe(false);
  });

  test('follow-up outcomes are the learner’s own three-way call, never a mark', () => {
    expect(FOLLOW_UP_OUTCOMES).toEqual(['held', 'partly', 'missed']);
    // "Missed" describes the answer, not the person, and nothing converts these into a figure.
    expect(Object.values(FOLLOW_UP_OUTCOME_LABEL).join(' ')).not.toMatch(/fail|wrong|bad/i);
  });

  test('exports no aggregate — there is no judge here and a total would look like one', () => {
    // Guards the design decision, not an implementation detail: any function that folds five
    // self-reports into one number would be the app inventing an assessment it never observed.
    const suspicious = Object.keys(interviewEngine).filter((key) =>
      /score|grade|total|verdict|rating$/i.test(key),
    );
    expect(suspicious).toEqual([]);
  });
});

describe('interviewDraws — which problem, and on what grounds', () => {
  const pool: Question[] = [
    q({ id: 1, pattern: 'hash-maps', familyId: 'fam-a' }),
    q({ id: 2, pattern: 'graphs', familyId: 'fam-b' }),
    q({ id: 3, pattern: 'greedy', familyId: 'fam-c' }),
    q({ id: 4, pattern: 'stacks' }),
    q({ id: 5, pattern: 'trie' }),
  ];
  const draw = (over = {}) =>
    interviewDraws({
      pool,
      seed: 'interview:2026-07-30',
      stalledQuestionIds: [],
      weakPatterns: [],
      hintReliantFamilyIds: [],
      ...over,
    });

  test('a problem that stalled under a contest clock comes first — the interview is the re-serve', () => {
    const order = draw({ stalledQuestionIds: [3], weakPatterns: ['graphs'] });

    expect(order[0]!.question.id).toBe(3);
    expect(order[0]!.basis).toBe('contest-stall');
  });

  test('then problems in the areas the one weakness model marked shaky', () => {
    const order = draw({ weakPatterns: ['graphs'] });

    expect(order[0]!.question.id).toBe(2);
    expect(order[0]!.basis).toBe('weak-pattern');
  });

  test('then problems whose family holds something the hint ladder had to carry', () => {
    const order = draw({ hintReliantFamilyIds: ['fam-c'] });

    expect(order[0]!.question.id).toBe(3);
    expect(order[0]!.basis).toBe('hint-reliant-family');
  });

  test('every problem in the pool is offered exactly once — a reroll can always walk on', () => {
    const order = draw({ stalledQuestionIds: [3], weakPatterns: ['graphs'], hintReliantFamilyIds: ['fam-a'] });

    expect(order).toHaveLength(pool.length);
    expect(new Set(order.map((d) => d.question.id)).size).toBe(pool.length);
  });

  test('the same seed draws the same order — a reload is not a reshuffle', () => {
    const a = draw({ weakPatterns: ['graphs'] });
    const b = draw({ weakPatterns: ['graphs'] });
    const c = interviewDraws({
      pool,
      seed: 'interview:2026-07-31',
      stalledQuestionIds: [],
      weakPatterns: [],
      hintReliantFamilyIds: [],
    });

    expect(a.map((d) => d.question.id)).toEqual(b.map((d) => d.question.id));
    expect(a.map((d) => d.question.id)).not.toEqual(c.map((d) => d.question.id));
  });

  test('with no evidence at all it is still a draw, and it claims nothing', () => {
    const order = draw();

    expect(order).toHaveLength(pool.length);
    expect(order.every((d) => d.basis === 'open-ground')).toBe(true);
    expect(DRAW_BASIS_NOTE['open-ground']).toBeNull();
  });

  test('no basis note names a pattern — the landing must not leak what it is testing', () => {
    for (const note of Object.values(DRAW_BASIS_NOTE)) {
      if (note === null) continue;
      expect(note).not.toMatch(/graphs|hash map|sliding window|greedy|stack/i);
      // And none of them grades the learner for having been drawn there.
      expect(note).not.toMatch(/weak at|bad at|struggling|poor/i);
    }
  });
});
