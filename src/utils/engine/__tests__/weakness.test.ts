import { vi } from 'vitest';
import {
  MIN_EVIDENCE_WEIGHT,
  MIN_OBSERVATIONS,
  MIN_TRANSFER_OBSERVATIONS,
  patternWeakness,
  RECENCY_HALF_LIFE_DAYS,
  SIGNAL_WEIGHTS,
  transferRecord,
  type PatternWeakness,
  type WeaknessInput,
  type WeaknessSignalId,
} from '@/utils/engine/weakness';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { addDays } from '@/utils/dates';
import type {
  DrillDayResult,
  FamilyRole,
  PatternId,
  ProblemFamily,
  Question,
  QuestionProgress,
  RevisionEvent,
} from '@/types';
import { QF } from '@/test/questionFixture';

/* ------------------------------------------------------------------------------------------ */
/* Fixtures                                                                                     */
/* ------------------------------------------------------------------------------------------ */

// The module takes `today` as a string and reads no clock, so this is data, not a pinned clock.
const TODAY = '2026-07-30';
const ago = (days: number): string => addDays(TODAY, -days);

const q = (id: number, pattern: PatternId = 'graphs', estimatedTime = 20): Question => ({
  id, title: `Q${id}`, pattern, difficulty: 'medium', estimatedTime, ...QF,
});

const p = (over: Partial<QuestionProgress> = {}): QuestionProgress => ({ ...initialProgress(), ...over });

const solved = (date: string, over: Partial<QuestionProgress> = {}): QuestionProgress =>
  p({ status: 'solved', completedAt: date, ...over });

const recalls = (...events: [string, boolean][]): RevisionEvent[] =>
  events.map(([date, passed]) => ({ date, passed }));

const drillDay = (missed: string[]): DrillDayResult => ({
  correct: Math.max(0, 8 - missed.length),
  total: 8,
  missedPatterns: missed,
});

const family = (id: string, questionIds: number[], pattern: PatternId = 'graphs'): ProblemFamily => ({
  id,
  pattern,
  name: `Family ${id}`,
  idea: 'one shared idea',
  signals: ['a signal'],
  trap: 'the tempting wrong turn',
  members: questionIds.map((questionId, i) => ({
    questionId,
    role: (i === 0 ? 'canonical' : 'variant') as FamilyRole,
  })),
});

const run = (over: Partial<WeaknessInput> = {}): PatternWeakness[] =>
  patternWeakness({ today: TODAY, all: [], byId: {}, drills: {}, families: [], ...over });

/** The single expected row, with the "exactly one pattern was named" claim folded in. */
const only = (over: Partial<WeaknessInput> = {}): PatternWeakness => {
  const out = run(over);
  expect(out).toHaveLength(1);
  return out[0]!;
};

const signalOf = (w: PatternWeakness, id: WeaknessSignalId) => w.signals.find((s) => s.id === id);

/* ------------------------------------------------------------------------------------------ */
/* Rule 4 — unmeasured is not zero                                                              */
/* ------------------------------------------------------------------------------------------ */

describe('silence and strength are different findings', () => {
  test('no evidence at all produces no rows — not 28 patterns scored zero', () => {
    expect(run()).toEqual([]);
  });

  test('a spotless record is absent from the list rather than reported as strong', () => {
    const all = [q(1), q(2), q(3)];
    const byId: Record<number, QuestionProgress> = {
      1: solved(ago(10), { confidence: 5, timeSpentMin: 10, revisionHistory: recalls([ago(5), true], [ago(2), true]) }),
      2: solved(ago(9), { confidence: 4, timeSpentMin: 15, revisionHistory: recalls([ago(4), true]) }),
      3: solved(ago(8), { confidence: 5, timeSpentMin: 12 }),
    };

    // Nothing negative happened, so there is nothing to say — the absence IS the answer.
    expect(run({ all, byId })).toEqual([]);
  });

  test('a pattern that never went wrong stays absent even while another pattern is named', () => {
    const all = [q(1, 'graphs'), q(2, 'graphs'), q(3, 'stacks'), q(4, 'stacks')];
    const byId: Record<number, QuestionProgress> = {
      1: solved(ago(10), { revisionHistory: recalls([ago(3), false]) }),
      2: solved(ago(10), { revisionHistory: recalls([ago(3), false]) }),
      3: solved(ago(10), { revisionHistory: recalls([ago(3), true]) }),
      4: solved(ago(10), { revisionHistory: recalls([ago(3), true]) }),
    };

    expect(run({ all, byId }).map((w) => w.id)).toEqual(['graphs']);
  });

  test('an untouched question contributes nothing — byId is sparse and silence is not a miss', () => {
    // Ten questions in the pattern, two of them touched. The rate must be 2 of 2, not 2 of 10:
    // a question never opened is not a recall that was failed.
    const all = Array.from({ length: 10 }, (_, i) => q(i + 1));
    const byId: Record<number, QuestionProgress> = {
      1: solved(ago(10), { revisionHistory: recalls([ago(3), false]) }),
      2: solved(ago(10), { revisionHistory: recalls([ago(2), false]) }),
    };

    const graphs = only({ all, byId });
    expect(signalOf(graphs, 'retention')!.detail).toContain('2 of 2 graded recalls failed');
  });

  test('progress for a question outside the dataset is ignored rather than half-counted', () => {
    const byId: Record<number, QuestionProgress> = {
      999: solved(ago(10), { revisionHistory: recalls([ago(3), false], [ago(2), false]) }),
    };

    expect(run({ all: [], byId })).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Rule 2 — repeated evidence                                                                   */
/* ------------------------------------------------------------------------------------------ */

describe('one bad evening is not a weakness', () => {
  test('MIN_OBSERVATIONS is 2, and one miss of any kind claims nothing', () => {
    expect(MIN_OBSERVATIONS).toBe(2);

    // One failed recall.
    expect(run({
      all: [q(1)],
      byId: { 1: solved(ago(10), { revisionHistory: recalls([ago(2), false]) }) },
    })).toEqual([]);

    // One missed drill prompt.
    expect(run({ drills: { [TODAY]: drillDay(['graphs']) } })).toEqual([]);

    // One low self-rating.
    expect(run({ all: [q(1)], byId: { 1: solved(ago(3), { confidence: 1 }) } })).toEqual([]);

    // One skipped question.
    expect(run({ all: [q(1)], byId: { 1: p({ status: 'skipped' }) } })).toEqual([]);

    // One slow solve.
    expect(run({ all: [q(1)], byId: { 1: solved(ago(3), { timeSpentMin: 60 }) } })).toEqual([]);

    // One solve that needed the full hint ladder.
    expect(run({ all: [q(1)], byId: { 1: solved(ago(3), { hintLevelUsed: 3 }) } })).toEqual([]);
  });

  test('the second observation is what turns a signal on', () => {
    const all = [q(1), q(2)];
    const one: Record<number, QuestionProgress> = {
      1: solved(ago(10), { revisionHistory: recalls([ago(2), false]) }),
      2: solved(ago(10), { revisionHistory: recalls([ago(2), true]) }),
    };
    expect(run({ all, byId: one })).toEqual([]);

    const two = { ...one, 2: solved(ago(10), { revisionHistory: recalls([ago(2), false]) }) };
    expect(run({ all, byId: two }).map((w) => w.id)).toEqual(['graphs']);
  });

  test('the floor counts negative observations, not attempts — 1 miss in 50 stays silent', () => {
    const all = Array.from({ length: 50 }, (_, i) => q(i + 1));
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= 50; i++) {
      byId[i] = solved(ago(20), { revisionHistory: recalls([ago(5), i !== 7]) });
    }

    expect(run({ all, byId })).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Each signal, on its own                                                                      */
/* ------------------------------------------------------------------------------------------ */

describe('recognition — drill misses, the one signal with no denominator', () => {
  test('reads against a saturation point and names the pattern with its own numbers', () => {
    const graphs = only({ drills: { [TODAY]: drillDay(['graphs', 'graphs']) } });

    expect(graphs.id).toBe('graphs');
    expect(graphs.name).toBe('Graphs');
    expect(graphs.signals.map((s) => s.id)).toEqual(['recognition']);

    const recognition = graphs.signals[0]!;
    expect(recognition.label).toBe('Recognition drills');
    expect(recognition.observations).toBe(2);
    // Two recency-weighted misses against DRILL_SATURATION = 4.
    expect(recognition.value).toBeCloseTo(0.5, 10);
    expect(recognition.weight).toBe(SIGNAL_WEIGHTS.recognition);
    // `missedPatterns` holds one entry per wrongly answered PROMPT (duplicates allowed — see
    // store/actions.ts logDrillResult), so both of these misses happened in ONE drill. The copy
    // must therefore count prompts; it used to say "Missed in 2 recognition drills" to a learner
    // who had sat exactly one.
    expect(recognition.detail).toBe('Missed 2 recognition prompts, most recently today.');
  });

  test('DRILL_SATURATION caps the reading — a catastrophic day is not worth three of them', () => {
    const four = only({ drills: { [TODAY]: drillDay(Array(4).fill('graphs')) } });
    const twelve = only({ drills: { [TODAY]: drillDay(Array(12).fill('graphs')) } });

    expect(four.signals[0]!.value).toBe(1);
    expect(twelve.signals[0]!.value).toBe(1);
    expect(twelve.score).toBe(four.score);
    // The honest count still climbs — the cap is on the reading, not on the record.
    expect(twelve.signals[0]!.observations).toBe(12);
  });

  test('an unrecognised pattern id in a drill record is dropped, not scored', () => {
    expect(run({ drills: { [TODAY]: drillDay(['not-a-pattern', 'not-a-pattern']) } })).toEqual([]);
  });

  test('misses accumulate across drill days, each at its own age', () => {
    const graphs = only({
      drills: {
        [TODAY]: drillDay(['graphs']),
        [ago(1)]: drillDay(['graphs']),
        [ago(2)]: drillDay(['stacks']), // a different pattern, and one miss is below the floor
      },
    });

    expect(graphs.signals[0]!.observations).toBe(2);
    expect(graphs.signals[0]!.detail).toContain('most recently today');
  });
});

describe('retention — graded recalls that failed after a gap', () => {
  const all = [q(1), q(2), q(3)];
  const byId: Record<number, QuestionProgress> = {
    1: solved(ago(20), { revisionHistory: recalls([ago(10), false]) }),
    2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
    3: solved(ago(20), { revisionHistory: recalls([ago(2), true]) }),
  };

  test('is a rate over graded attempts, dated by the attempt', () => {
    const graphs = only({ all, byId });
    const retention = signalOf(graphs, 'retention')!;

    expect(graphs.signals.map((s) => s.id)).toEqual(['retention']);
    expect(retention.observations).toBe(2);
    expect(retention.detail).toBe('2 of 3 graded recalls failed. The most recent was 2 days ago.');
    // Recency lives INSIDE the ratio, not beside it: the older of the two failures is discounted
    // against a fresher pass, so the reading sits below the raw 2-of-3 count.
    expect(retention.value).toBeLessThan(2 / 3);
    expect(retention.value).toBeCloseTo(0.6468, 4);
  });

  test('a pattern that only ever passes its recalls never fires the signal', () => {
    const clean: Record<number, QuestionProgress> = {
      1: solved(ago(20), { revisionHistory: recalls([ago(10), true], [ago(5), true]) }),
      2: solved(ago(20), { revisionHistory: recalls([ago(9), true], [ago(4), true]) }),
    };

    expect(run({ all, byId: clean })).toEqual([]);
  });
});

describe('confidence — the learner’s own rating', () => {
  test('only a rating of 2 or below is a negative observation; 3 predicts nothing', () => {
    const all = [q(1), q(2), q(3), q(4)];
    const graphs = only({
      all,
      byId: {
        1: solved(ago(5), { confidence: 1 }),
        2: solved(ago(5), { confidence: 2 }),
        3: solved(ago(5), { confidence: 3 }),
        4: solved(ago(5)), // never rated — not an opportunity at all
      },
    });

    const confidence = signalOf(graphs, 'confidence')!;
    expect(graphs.signals.map((s) => s.id)).toEqual(['confidence']);
    expect(confidence.observations).toBe(2);
    // 3 rated solves, 2 of them low — the unrated solve is not counted as confident.
    expect(confidence.value).toBeCloseTo(2 / 3, 10);
    expect(confidence.detail).toBe('You rated 2 of 3 solves here 2 or below.');
    expect(graphs.score).toBeCloseTo((SIGNAL_WEIGHTS.confidence * (2 / 3)) / MIN_EVIDENCE_WEIGHT, 10);
  });
});

describe('unfinished — questions opened here and not carried through', () => {
  test('skipped and hint-abandoned count; merely open does not, and unsolved is not evidence', () => {
    const all = [q(1), q(2), q(3), q(4)];
    const graphs = only({
      all,
      byId: {
        1: p({ status: 'skipped' }),
        2: p({ status: 'in_progress', hintLevelUsed: 2 }), // opened the ladder, never finished
        3: p({ status: 'in_progress', hintLevelUsed: 0 }), // opening a question is how you read it
        4: p({ status: 'unsolved' }),                      // never engaged: no opportunity at all
      },
    });

    const unfinished = signalOf(graphs, 'unfinished')!;
    expect(graphs.signals.map((s) => s.id)).toEqual(['unfinished']);
    expect(unfinished.observations).toBe(2);
    expect(unfinished.value).toBeCloseTo(2 / 3, 10);
    expect(unfinished.detail).toBe('2 of 3 questions you opened here were skipped or left unfinished.');
    // These records carry no date, so the reading must not claim a "most recently".
    expect(unfinished.detail).not.toContain('most recently');
  });

  test('solved questions are clean opportunities, so a big solved record dilutes two skips', () => {
    const all = Array.from({ length: 22 }, (_, i) => q(i + 1));
    const byId: Record<number, QuestionProgress> = {
      1: p({ status: 'skipped' }),
      2: p({ status: 'skipped' }),
    };
    for (let i = 3; i <= 22; i++) byId[i] = solved(ago(30));

    const graphs = only({ all, byId });
    expect(signalOf(graphs, 'unfinished')!.value).toBeCloseTo(2 / 22, 10);
  });
});

describe('pace — timed solves against the authored estimate', () => {
  test('counts only measured solves, treats 1.5x as slow, and discards the implausible', () => {
    const all = [q(1), q(2), q(3), q(4), q(5)];
    const graphs = only({
      all,
      byId: {
        1: solved(ago(5), { timeSpentMin: 40 }),  // 2.0x — slow
        2: solved(ago(5), { timeSpentMin: 30 }),  // exactly 1.5x — slow
        3: solved(ago(5), { timeSpentMin: 20 }),  // 1.0x — fine
        4: solved(ago(5), { timeSpentMin: 200 }), // 10x — a timer left running, discarded outright
        5: solved(ago(5), { timeSpentMin: 0 }),   // unmeasured is not a measurement of zero
      },
    });

    const pace = signalOf(graphs, 'pace')!;
    expect(graphs.signals.map((s) => s.id)).toEqual(['pace']);
    expect(pace.observations).toBe(2);
    expect(pace.value).toBeCloseTo(2 / 3, 10);
    expect(pace.detail).toBe('2 of 3 timed solves took at least 1.5x the estimate.');
  });

  test('a question with no authored estimate cannot produce a ratio, and does not try', () => {
    const all = [q(1, 'graphs', 0), q(2, 'graphs', 0)];
    const byId = { 1: solved(ago(5), { timeSpentMin: 90 }), 2: solved(ago(5), { timeSpentMin: 90 }) };

    expect(run({ all, byId })).toEqual([]);
  });
});

describe('hints — a record of where support was needed, never a cost', () => {
  const all = [q(1), q(2)];
  const atRung = (rung: number) =>
    only({ all, byId: { 1: solved(ago(5), { hintLevelUsed: rung }), 2: solved(ago(5), { hintLevelUsed: rung }) } });

  test('the rung grades the severity — a nudge is not a walkthrough', () => {
    const nudge = atRung(1);
    const walkthrough = atRung(3);

    expect(signalOf(nudge, 'hints')!.value).toBeCloseTo(1 / 3, 10);
    expect(signalOf(walkthrough, 'hints')!.value).toBe(1);
    expect(walkthrough.score).toBeGreaterThan(nudge.score);
  });

  test('the copy reports support, not punishment', () => {
    const hints = signalOf(atRung(3), 'hints')!;

    expect(hints.detail).toBe('You reached for the hint ladder on 2 of 2 solves here.');
    expect(hints.detail).not.toMatch(/penal|cost|cheat|lost|should have|too many/i);
  });

  test('unaided solves are clean opportunities that pull the reading down', () => {
    const all4 = [q(1), q(2), q(3), q(4)];
    const graphs = only({
      all: all4,
      byId: {
        1: solved(ago(5), { hintLevelUsed: 3 }),
        2: solved(ago(5), { hintLevelUsed: 3 }),
        3: solved(ago(5), { hintLevelUsed: 0 }),
        4: solved(ago(5), { hintLevelUsed: 0 }),
      },
    });

    expect(signalOf(graphs, 'hints')!.value).toBeCloseTo(0.5, 10);
  });
});

describe('transfer — did an idea already met carry to its next disguise?', () => {
  test('the first solve in a family is exempt; later ones are graded on hints and first recall', () => {
    const all = [q(1), q(2), q(3), q(4)];
    const graphs = only({
      all,
      byId: {
        1: solved(ago(60)),                                                // the meeting — exempt
        2: solved(ago(10), { hintLevelUsed: 2 }),                          // needed the technique
        3: solved(ago(10), { revisionHistory: recalls([ago(5), false]) }), // lost it first time
        4: solved(ago(10)),                                                // carried
      },
      families: [family('f1', [1, 2, 3, 4])],
    });

    const transfer = signalOf(graphs, 'transfer')!;
    expect(graphs.signals.map((s) => s.id)).toEqual(['transfer']);
    expect(transfer.observations).toBe(2);
    // 3 opportunities, not 4: the first solve is where the idea was met, so it is not graded.
    expect(transfer.value).toBeCloseTo(2 / 3, 10);
    expect(transfer.detail).toBe(
      '2 of 3 problems in families you had already met did not carry over.',
    );
  });

  test('a family the learner has only met once produces nothing to transfer from', () => {
    const all = [q(1), q(2), q(3)];
    expect(run({
      all,
      byId: { 1: solved(ago(10), { hintLevelUsed: 3, revisionHistory: recalls([ago(5), false]) }) },
      families: [family('f1', [1, 2, 3])],
    })).toEqual([]);
  });

  test('a member not yet reached is not a failure to transfer — it is simply not evidence', () => {
    const all = [q(1), q(2), q(3), q(4), q(5)];
    expect(run({
      all,
      byId: { 1: solved(ago(10)), 2: solved(ago(5)) }, // 3-5 untouched
      families: [family('f1', [1, 2, 3, 4, 5])],
    })).toEqual([]);
  });

  test('a skipped family member is an undated transfer failure, and reads alongside unfinished', () => {
    const all = [q(1), q(2), q(3)];
    const graphs = only({
      all,
      byId: { 1: solved(ago(10)), 2: p({ status: 'skipped' }), 3: p({ status: 'skipped' }) },
      families: [family('f1', [1, 2, 3])],
    });

    expect(graphs.signals.map((s) => s.id)).toEqual(['transfer', 'unfinished']);
    expect(signalOf(graphs, 'transfer')!.value).toBe(1);
    expect(signalOf(graphs, 'unfinished')!.value).toBeCloseTo(2 / 3, 10);
    // Two signals worth 0.24 of the budget, still under the MIN_EVIDENCE_WEIGHT floor.
    expect(graphs.score).toBeCloseTo(
      (SIGNAL_WEIGHTS.transfer * 1 + SIGNAL_WEIGHTS.unfinished * (2 / 3)) / MIN_EVIDENCE_WEIGHT,
      10,
    );
  });

  test('families reach across patterns, and the failure lands on the question’s own pattern', () => {
    // A deliberate transfer link: the idea is met under `graphs` and reappears under `stacks`.
    const all = [q(1, 'graphs'), q(2, 'stacks'), q(3, 'stacks')];
    const out = run({
      all,
      byId: {
        1: solved(ago(30)),
        2: solved(ago(5), { hintLevelUsed: 2 }),
        3: solved(ago(5), { hintLevelUsed: 3 }),
      },
      families: [family('f1', [1, 2, 3], 'graphs')],
    });

    expect(out.map((w) => w.id)).toEqual(['stacks']);
    expect(signalOf(out[0]!, 'transfer')!.observations).toBe(2);
  });

  test('with no families passed in, transfer can never fire', () => {
    const all = [q(1), q(2), q(3)];
    const byId = {
      1: solved(ago(30)),
      2: solved(ago(5), { hintLevelUsed: 2 }),
      3: solved(ago(5), { hintLevelUsed: 2 }),
    };

    expect(signalOf(only({ all, byId }), 'transfer')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Rule 3 — no single signal dominates                                                          */
/* ------------------------------------------------------------------------------------------ */

describe('one metric nominates, corroboration convicts', () => {
  test('no weight exceeds 0.24 and the whole budget sums to 1', () => {
    const weights = Object.values(SIGNAL_WEIGHTS);
    expect(Math.max(...weights)).toBeLessThanOrEqual(0.24);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  test('the heaviest signal alone, reading maximally, still tops out below half strength', () => {
    const all = [q(1), q(2)];
    const graphs = only({
      all,
      byId: {
        1: solved(ago(20), { revisionHistory: recalls([ago(3), false]) }),
        2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
      },
    });

    expect(signalOf(graphs, 'retention')!.value).toBe(1);
    expect(graphs.score).toBeCloseTo(SIGNAL_WEIGHTS.retention / MIN_EVIDENCE_WEIGHT, 10);
    expect(graphs.score).toBeLessThan(0.5);
  });

  test('the same reading corroborated by a second and third signal climbs to full strength', () => {
    const all = [q(1), q(2)];
    const failedRecalls: Record<number, QuestionProgress> = {
      1: solved(ago(20), { revisionHistory: recalls([ago(3), false]) }),
      2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
    };
    const maxedDrills = { [TODAY]: drillDay(Array(4).fill('graphs')) };

    const alone = only({ all, byId: failedRecalls });
    const two = only({ all, byId: failedRecalls, drills: maxedDrills });
    const three = only({
      all,
      byId: {
        1: { ...failedRecalls[1]!, confidence: 1 },
        2: { ...failedRecalls[2]!, confidence: 2 },
      },
      drills: maxedDrills,
    });

    expect(alone.score).toBeCloseTo(0.48, 10);
    // 0.24 + 0.22 = 0.46 of the budget fired — still under the floor, so still divided by 0.5.
    expect(two.score).toBeCloseTo(0.92, 10);
    // 0.56 of the budget fired, all reading 1: a plain weighted mean of what spoke.
    expect(three.score).toBeCloseTo(1, 10);
  });

  test('the score never exceeds 1 even when every signal is firing at once', () => {
    const rich = allSevenSignals();
    expect(rich.score).toBeLessThanOrEqual(1);
  });

  // FLAGGED, not endorsed. Above the MIN_EVIDENCE_WEIGHT floor the score is a weighted *mean*,
  // so a signal reading below the current average drags the score DOWN even though it is fresh
  // evidence of struggle. Here the learner does everything the first case does AND needed the
  // hint ladder on both solves, and the model calls them less weak. See the accompanying report.
  test('a weighted mean is not monotone in evidence: an extra mild signal LOWERS the score', () => {
    const all = [q(1), q(2)];
    const drills = { [TODAY]: drillDay(Array(4).fill('graphs')) };
    const withoutHints: Record<number, QuestionProgress> = {
      1: solved(ago(20), { revisionHistory: recalls([ago(3), false]) }),
      2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
    };
    const withHints: Record<number, QuestionProgress> = {
      1: { ...withoutHints[1]!, hintLevelUsed: 1 },
      2: { ...withoutHints[2]!, hintLevelUsed: 1 },
    };

    const before = only({ all, byId: withoutHints, drills });
    const after = only({ all, byId: withHints, drills });

    expect(signalOf(after, 'hints')).toBeDefined();
    expect(after.score).toBeLessThan(before.score);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Rule 1 — recency                                                                             */
/* ------------------------------------------------------------------------------------------ */

describe('weakness is a claim in the present tense', () => {
  const drillScoreAged = (days: number): number =>
    only({ drills: { [ago(days)]: drillDay(['graphs', 'graphs']) } }).score;

  test('the drill signal halves every RECENCY_HALF_LIFE_DAYS, exactly', () => {
    expect(RECENCY_HALF_LIFE_DAYS).toBe(30);

    const now = drillScoreAged(0);
    const oneHalfLife = drillScoreAged(30);
    const twoHalfLives = drillScoreAged(60);
    const threeHalfLives = drillScoreAged(90);

    expect(now).toBeCloseTo(0.22, 10);
    expect(oneHalfLife).toBeCloseTo(now / 2, 10);
    expect(twoHalfLives).toBeCloseTo(now / 4, 10);
    expect(threeHalfLives).toBeCloseTo(now / 8, 10);
  });

  test('decay is monotone across the whole range, never flat and never rising', () => {
    const ages = [0, 5, 15, 30, 45, 60, 90, 180, 365];
    const scores = ages.map(drillScoreAged);

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
    expect(scores.at(-1)!).toBeGreaterThan(0);
  });

  test('evidence dated in the future is priced as today, not as negative age', () => {
    const future = only({ drills: { [addDays(TODAY, 5)]: drillDay(['graphs', 'graphs']) } });

    expect(future.score).toBe(drillScoreAged(0));
    expect(future.signals[0]!.detail).toContain('most recently today');
  });

  test('inside a rate, recent failures dominate old ones', () => {
    const all = [q(1)];
    const oldPasses = Array.from({ length: 8 }, (_, i) => [ago(300 + i), true] as [string, boolean]);
    const newPasses = Array.from({ length: 8 }, (_, i) => [ago(1 + i), true] as [string, boolean]);

    const failingNow = only({
      all,
      byId: { 1: solved(ago(400), { revisionHistory: recalls([ago(1), false], [ago(2), false], ...oldPasses) }) },
    });
    const failedLongAgo = only({
      all,
      byId: { 1: solved(ago(400), { revisionHistory: recalls([ago(300), false], [ago(301), false], ...newPasses) }) },
    });

    expect(signalOf(failingNow, 'retention')!.value).toBeGreaterThan(0.99);
    expect(signalOf(failedLongAgo, 'retention')!.value).toBeLessThan(0.01);
    expect(failingNow.score).toBeGreaterThan(failedLongAgo.score * 100);
  });

  // A rate signal divides two quantities that decay together, so the ratio itself is invariant to
  // age, and `MIN_OBSERVATIONS` gates on the unweighted count — between them, two failed recalls
  // in 2025 once read exactly like two failures this week. `MIN_LIVE_EVIDENCE` closes that: once
  // the surviving evidence mass falls below MIN_OBSERVATIONS observations aged one half-life, the
  // signal stops claiming rather than claiming quietly. Suppression, not re-weighting — live
  // evidence still scores exactly as it did.
  test('a rate whose evidence has all gone stale stops claiming instead of claiming at full strength', () => {
    const all = [q(1), q(2)];
    const twoFailuresAged = (days: number): Record<number, QuestionProgress> => ({
      1: solved(ago(days + 5), { revisionHistory: recalls([ago(days), false]) }),
      2: solved(ago(days + 5), { revisionHistory: recalls([ago(days + 1), false]) }),
    });

    const fresh = only({ all, byId: twoFailuresAged(2) });
    expect(signalOf(fresh, 'retention')!.value).toBe(1);
    expect(signalOf(fresh, 'retention')!.detail).toContain('The most recent was 2 days ago.');

    // Nothing survives from 400 days ago, so the pattern is simply absent — the same treatment a
    // pattern with no evidence at all gets. It is never reported as "strong".
    expect(run({ all, byId: twoFailuresAged(400) })).toHaveLength(0);
  });

  test('repeated evidence outlives sparse evidence — the floor is on mass, not on age', () => {
    const AGED = 60; // two half-lives: each observation survives at 0.25
    const all = [q(1), q(2), q(3), q(4)];
    const failuresAt = (ids: number[]): Record<number, QuestionProgress> =>
      Object.fromEntries(
        ids.map((id) => [id, solved(ago(AGED + 5), { revisionHistory: recalls([ago(AGED), false]) })]),
      );

    // 2 × 0.25 = 0.5, below the floor — too little left to claim on.
    expect(run({ all, byId: failuresAt([1, 2]) })).toHaveLength(0);
    // 4 × 0.25 = 1.0, at the floor — a repeatedly-evidenced failure still speaks at the same age.
    expect(run({ all, byId: failuresAt([1, 2, 3, 4]) })).toHaveLength(1);
  });

  test('an undated state is priced at exactly one half-life beside dated measurements', () => {
    // Transfer is the one signal that mixes the two: a skipped member carries no date, while a
    // solved one is weighted by when it was solved. The skip must weigh what a measurement taken
    // RECENCY_HALF_LIFE_DAYS ago weighs — no more.
    const all = [q(1), q(2), q(3), q(4), q(5)];
    const families = [family('f1', [1, 2, 3, 4, 5])];
    const shared: Record<number, QuestionProgress> = {
      1: solved(ago(60)),  // the meeting — exempt
      4: solved(TODAY),    // carried, measured today at full weight
      5: solved(TODAY),
    };

    const undated = only({
      all,
      families,
      byId: { ...shared, 2: p({ status: 'skipped' }), 3: p({ status: 'skipped' }) },
    });
    const oneHalfLifeOld = only({
      all,
      families,
      byId: {
        ...shared,
        2: solved(ago(RECENCY_HALF_LIFE_DAYS), { hintLevelUsed: 2 }),
        3: solved(ago(RECENCY_HALF_LIFE_DAYS), { hintLevelUsed: 2 }),
      },
    });

    // Two misses at half weight against two more opportunities at full weight.
    expect(signalOf(undated, 'transfer')!.value).toBeCloseTo(1 / 3, 10);
    expect(signalOf(oneHalfLifeOld, 'transfer')!.value).toBeCloseTo(1 / 3, 10);
    // An unweighted count would have read 2 of 4 — a standing fact does not outrank a measurement.
    expect(signalOf(undated, 'transfer')!.value).toBeLessThan(0.5);
  });

  test('the unfinished signal carries no dates at all, so it never decays', () => {
    // Every unfinished observation — skip, hint-abandonment and clean solve alike — is recorded
    // at UNDATED_WEIGHT, so the weights cancel and the reading is a plain lifetime ratio. A
    // question skipped years ago weighs exactly what one skipped this morning weighs.
    const all = [q(1), q(2), q(3)];
    const skips = { 1: p({ status: 'skipped' }), 2: p({ status: 'skipped' }) };

    const beside = only({ all, byId: { ...skips, 3: solved(TODAY) } });
    const longAfter = only({ all, byId: { ...skips, 3: solved(ago(900)) } });

    expect(signalOf(beside, 'unfinished')!.value).toBeCloseTo(2 / 3, 10);
    expect(signalOf(longAfter, 'unfinished')!.value).toBe(signalOf(beside, 'unfinished')!.value);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Ordering, structure and prose                                                                */
/* ------------------------------------------------------------------------------------------ */

/** A single pattern with all seven signals reading, used by several structural tests. */
function allSevenSignals(): PatternWeakness {
  const all = [q(1), q(2), q(3), q(4), q(5)];
  return only({
    all,
    byId: {
      1: solved(TODAY, { confidence: 1, timeSpentMin: 40, hintLevelUsed: 3, revisionHistory: recalls([ago(5), false]) }),
      2: solved(TODAY, { confidence: 2, timeSpentMin: 40, hintLevelUsed: 3, revisionHistory: recalls([ago(4), false]) }),
      3: p({ status: 'skipped' }),
      4: p({ status: 'skipped' }),
      5: solved(ago(29)), // the family's first solve — exempt from transfer, clean everywhere else
    },
    drills: { [TODAY]: drillDay(Array(4).fill('graphs')) },
    families: [family('f1', [5, 1, 2])],
  });
}

describe('the shape of a claim', () => {
  test('all seven signals report side by side, strongest contributor first', () => {
    const graphs = allSevenSignals();

    // Ties (confidence and pace both at weight 0.1, value 1) break alphabetically, so this
    // ordering is fully determined rather than dependent on iteration order.
    expect(graphs.signals.map((s) => s.id)).toEqual([
      'retention', 'recognition', 'transfer', 'confidence', 'pace', 'hints', 'unfinished',
    ]);
    for (let i = 1; i < graphs.signals.length; i++) {
      expect(graphs.signals[i]!.contribution).toBeLessThanOrEqual(graphs.signals[i - 1]!.contribution);
    }
  });

  test('the signals’ contributions sum to exactly the score they explain', () => {
    const graphs = allSevenSignals();
    const summed = graphs.signals.reduce((total, s) => total + s.contribution, 0);

    expect(summed).toBeCloseTo(graphs.score, 12);
    expect(graphs.score).toBeCloseTo(0.9076, 3);
  });

  test('every emitted number is finite and in range, and every signal carries its evidence', () => {
    const graphs = allSevenSignals();

    expect(Number.isFinite(graphs.score)).toBe(true);
    expect(graphs.score).toBeGreaterThan(0);
    expect(graphs.score).toBeLessThanOrEqual(1);
    for (const s of graphs.signals) {
      expect(Number.isFinite(s.value)).toBe(true);
      expect(s.value).toBeGreaterThan(0);
      expect(s.value).toBeLessThanOrEqual(1);
      expect(s.contribution).toBeGreaterThan(0);
      expect(s.weight).toBe(SIGNAL_WEIGHTS[s.id]);
      expect(s.observations).toBeGreaterThanOrEqual(MIN_OBSERVATIONS);
      expect(s.label.trim()).not.toBe('');
      // Never a bare score: the reading always states its numbers.
      expect(s.detail).toMatch(/\d/);
    }
  });

  test('the weakest pattern ranks first', () => {
    const all = [q(1, 'graphs'), q(2, 'graphs'), q(3, 'stacks'), q(4, 'stacks')];
    const out = run({
      all,
      byId: {
        1: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
        2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
        3: solved(ago(20), { revisionHistory: recalls([ago(2), false], [ago(1), true]) }),
        4: solved(ago(20), { revisionHistory: recalls([ago(2), false], [ago(1), true]) }),
      },
      // Graphs also missed four drill prompts today; stacks missed none.
      drills: { [TODAY]: drillDay(Array(4).fill('graphs')) },
    });

    expect(out.map((w) => w.id)).toEqual(['graphs', 'stacks']);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
  });

  test('exact ties break on pattern id, independent of the order evidence arrived in', () => {
    const forward = run({ drills: { [TODAY]: drillDay(['graphs', 'graphs', 'stacks', 'stacks']) } });
    const reversed = run({ drills: { [TODAY]: drillDay(['stacks', 'stacks', 'graphs', 'graphs']) } });

    expect(forward.map((w) => w.id)).toEqual(['graphs', 'stacks']);
    expect(reversed.map((w) => w.id)).toEqual(['graphs', 'stacks']);
    expect(forward[0]!.score).toBe(forward[1]!.score);
    expect(reversed).toEqual(forward);
  });
});

describe('the summary states the evidence and no more', () => {
  test('a single-signal claim names one thing, with its count', () => {
    const graphs = only({ drills: { [TODAY]: drillDay(['graphs', 'graphs', 'graphs']) } });

    expect(graphs.summary).toBe('you missed 3 recognition prompts');
    expect(graphs.summary).not.toContain(' and ');
  });

  test('a corroborated claim joins exactly the two strongest contributors', () => {
    const graphs = allSevenSignals();

    expect(graphs.summary).toBe('2 of 2 recalls failed and you missed 4 recognition prompts');
    // The because-clause and the signal list agree about which two lead.
    expect(graphs.signals.slice(0, 2).map((s) => s.id)).toEqual(['retention', 'recognition']);
    expect(graphs.summary.split(' and ')).toHaveLength(2);
  });

  test('a summary never mentions a signal that did not fire', () => {
    const all = [q(1), q(2)];
    const graphs = only({
      all,
      byId: {
        1: solved(ago(20), { revisionHistory: recalls([ago(3), false]) }),
        2: solved(ago(20), { revisionHistory: recalls([ago(2), false]) }),
      },
    });

    expect(graphs.summary).toBe('2 of 2 recalls failed');
    expect(graphs.summary).not.toMatch(/drill|hint|rated|unfinished|timed|carry over/);
  });

  test('every scored pattern has a non-empty summary and at least one signal', () => {
    const all = [q(1, 'graphs'), q(2, 'graphs'), q(3, 'stacks'), q(4, 'trie'), q(5, 'trie')];
    const out = run({
      all,
      byId: {
        1: solved(ago(9), { confidence: 1, hintLevelUsed: 3 }),
        2: solved(ago(9), { confidence: 2, hintLevelUsed: 3 }),
        3: p({ status: 'skipped' }),
        4: p({ status: 'skipped' }),
        5: p({ status: 'skipped' }),
      },
      drills: { [ago(3)]: drillDay(['stacks', 'stacks', 'trie', 'trie']) },
    });

    expect(out.length).toBeGreaterThan(1);
    for (const w of out) {
      expect(w.signals.length).toBeGreaterThan(0);
      expect(w.summary.trim()).not.toBe('');
      expect(w.name.trim()).not.toBe('');
      expect(w.name).not.toBe(w.id); // resolved through the pattern registry, not echoed back
    }
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Purity                                                                                       */
/* ------------------------------------------------------------------------------------------ */

describe('pure and deterministic — ISO strings in, no clock, no store', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const input = (): WeaknessInput => ({
    today: TODAY,
    all: [q(1), q(2), q(3)],
    byId: {
      1: solved(ago(10), { confidence: 1, timeSpentMin: 40, hintLevelUsed: 2, revisionHistory: recalls([ago(3), false]) }),
      2: solved(ago(9), { confidence: 2, timeSpentMin: 35, hintLevelUsed: 2, revisionHistory: recalls([ago(2), false]) }),
      3: p({ status: 'skipped' }),
    },
    drills: { [ago(1)]: drillDay(['graphs', 'graphs']) },
    families: [family('f1', [1, 2, 3])],
  });

  test('the same input twice produces the same answer', () => {
    expect(patternWeakness(input())).toEqual(patternWeakness(input()));
  });

  test('the wall clock cannot change the answer — only `today` can', () => {
    const baseline = patternWeakness(input());

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T03:00:00'));
    const inThePast = patternWeakness(input());
    vi.setSystemTime(new Date('2099-12-31T23:59:00'));
    const inTheFuture = patternWeakness(input());

    expect(inThePast).toEqual(baseline);
    expect(inTheFuture).toEqual(baseline);

    // `today` is the only lever, and moving it does move the answer.
    const later = patternWeakness({ ...input(), today: addDays(TODAY, 120) });
    expect(later[0]!.score).not.toBe(baseline[0]!.score);
  });

  test('nothing in the input is mutated', () => {
    const live = input();
    const snapshot = structuredClone(live);

    patternWeakness(live);

    expect(live).toEqual(snapshot);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* transferRecord — the transfer question answered on its own                                   */
/* ------------------------------------------------------------------------------------------ */

describe('transferRecord', () => {
  const solvedOn = (date: string, over: Partial<QuestionProgress> = {}) => solved(date, over);
  const all = Array.from({ length: 6 }, (_, i) => q(i + 1));
  const f = family('f1', [1, 2, 3, 4, 5, 6]);

  const six: Record<number, QuestionProgress> = {
    1: solvedOn('2026-07-01'),                                                   // the meeting
    2: solvedOn('2026-07-02'),                                                   // carried
    3: solvedOn('2026-07-03', { hintLevelUsed: 2 }),                             // needed the technique
    4: solvedOn('2026-07-04', { revisionHistory: recalls(['2026-07-10', false]) }), // lost it first time
    5: solvedOn('2026-07-05', { hintLevelUsed: 1 }),                             // a nudge still carries
    6: solvedOn('2026-07-06', { revisionHistory: recalls(['2026-07-11', true]) }),  // carried
  };

  test('nothing met means null, not a zero rate', () => {
    expect(transferRecord([], {}, [])).toBeNull();
    expect(transferRecord(all, {}, [f])).toBeNull();
    // Only the first problem in the family solved: there is nothing to have transferred to.
    expect(transferRecord(all, { 1: solvedOn('2026-07-01') }, [f])).toBeNull();
  });

  test('counts are facts, so they are returned; below the floor the rate is suppressed', () => {
    const thin = { ...six };
    delete thin[6];
    const record = transferRecord(all, thin, [f])!;

    expect(record.met).toBe(MIN_TRANSFER_OBSERVATIONS - 1);
    expect(record.carried).toBe(2);
    // Four problems is an anecdote — the page can say how far off measurable it is.
    expect(record.rate).toBeNull();
  });

  test('at the floor the rate appears, and grades on the technique hint and the first recall', () => {
    expect(transferRecord(all, six, [f])).toEqual({
      met: MIN_TRANSFER_OBSERVATIONS,
      carried: 3,
      rate: 0.6,
    });
  });

  test('a family member outside the dataset is not counted as met', () => {
    const withoutQ5 = all.filter((question) => question.id !== 5);
    const record = transferRecord(withoutQ5, six, [f])!;

    expect(record.met).toBe(4);
    expect(record.carried).toBe(2);
    expect(record.rate).toBeNull();
  });

  test('unsolved and skipped members are not counted — this metric measures solves only', () => {
    const partial: Record<number, QuestionProgress> = {
      1: solvedOn('2026-07-01'),
      2: solvedOn('2026-07-02'),
      3: p({ status: 'skipped' }),
      4: p({ status: 'in_progress' }),
    };

    expect(transferRecord(all, partial, [f])).toEqual({ met: 1, carried: 1, rate: null });
  });

  test('a perfect record reads 100%, not as an absence of evidence', () => {
    const clean: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= 6; i++) clean[i] = solvedOn(`2026-07-0${i}`);

    expect(transferRecord(all, clean, [f])).toEqual({ met: 5, carried: 5, rate: 1 });
  });

  test('is deterministic and mutates nothing', () => {
    const byId = structuredClone(six);
    const first = transferRecord(all, byId, [f]);

    expect(transferRecord(all, byId, [f])).toEqual(first);
    expect(byId).toEqual(six);
  });
});
