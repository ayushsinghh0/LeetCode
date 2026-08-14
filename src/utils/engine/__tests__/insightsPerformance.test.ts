// V8's performance-gap analytics: the measurements that only became possible once interview and
// contest evidence survived their sittings, and the three cards built on them.
//
// Every one of these is a claim that can be made too early, so most of this file is about the
// floors: what the module refuses to say, and why the number it would have said is noise.
import { describe, expect, test } from 'vitest';
import {
  buildInsights,
  interviewLog,
  timedPace,
  timedRecord,
  type InsightInput,
} from '@/utils/engine/insights';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { QF } from '@/test/questionFixture';
import type {
  ContestStallRecord,
  InterviewSittingRecord,
  Question,
  QuestionProgress,
} from '@/types';

const base: InsightInput = {
  today: '2026-07-30',
  all: [],
  byId: {},
  dayLogs: {},
  drills: {},
  weakness: [],
  forecast: [],
  capacityMin: 60,
  revisionMinutes: 8,
};

const contestRecord = (
  date: string,
  problems: { outcome: string; minutesSpent: number; targetMinutes: number }[],
): [string, ContestStallRecord] => [
  date,
  {
    stalledPatterns: [],
    attempted: problems.length,
    total: 4,
    problems: problems.map((p, i) => ({ questionId: i + 1, ...p })),
  },
];

const sitting = (over: Partial<InterviewSittingRecord> = {}): InterviewSittingRecord => ({
  date: '2026-07-20',
  questionId: 1,
  stageReached: 6,
  outcomes: {},
  assessment: {},
  minutes: 25,
  hintsTaken: 0,
  hintsAvailable: 3,
  ...over,
});

describe('timedRecord', () => {
  test('says nothing below six informative problems — the shares would be noise', () => {
    expect(
      timedRecord(
        Object.fromEntries([
          contestRecord('2026-07-29', [
            { outcome: 'clean', minutesSpent: 10, targetMinutes: 12 },
            { outcome: 'stalled', minutesSpent: 20, targetMinutes: 25 },
          ]),
        ]),
      ),
    ).toBeNull();
  });

  test('counts a set-aside with real minutes as a stall, and one without as neither', () => {
    // Naming the decision must not launder the evidence — the same rule engine/contest.ts applies.
    const record = timedRecord(
      Object.fromEntries([
        contestRecord('2026-07-29', [
          { outcome: 'clean', minutesSpent: 10, targetMinutes: 12 },
          { outcome: 'clean', minutesSpent: 11, targetMinutes: 12 },
          { outcome: 'slow', minutesSpent: 40, targetMinutes: 20 },
          { outcome: 'set-aside', minutesSpent: 22, targetMinutes: 25 },
        ]),
        contestRecord('2026-07-27', [
          { outcome: 'stalled', minutesSpent: 30, targetMinutes: 25 },
          { outcome: 'clean', minutesSpent: 9, targetMinutes: 12 },
          { outcome: 'set-aside', minutesSpent: 1, targetMinutes: 25 },
          { outcome: 'untouched', minutesSpent: 0, targetMinutes: 45 },
        ]),
      ]),
    )!;

    expect(record.sittings).toBe(2);
    expect(record.clean).toBe(3);
    expect(record.slow).toBe(1);
    expect(record.stalled).toBe(2); // the 22-minute set-aside, plus the genuine stall
    expect(record.problems).toBe(6); // the 1-minute set-aside and the untouched one say nothing
  });

  test('a pre-V8 record carrying only patterns contributes nothing rather than zeroes', () => {
    expect(
      timedRecord({ '2026-07-29': { stalledPatterns: ['graphs'], attempted: 3, total: 4 } }),
    ).toBeNull();
  });
});

describe('interviewLog', () => {
  test('needs three sittings — a trend through two points always has a direction', () => {
    expect(interviewLog([sitting(), sitting()])).toBeNull();
  });

  test('reads hint use as first half against second half', () => {
    const log = interviewLog([
      sitting({ hintsTaken: 3 }),
      sitting({ hintsTaken: 2 }),
      sitting({ hintsTaken: 1 }),
      sitting({ hintsTaken: 0 }),
    ])!;

    expect(log.earlyHints).toBe(2.5);
    expect(log.lateHints).toBe(0.5);
  });

  test('a prediction with no self-assessment behind it is not a calibration sample', () => {
    const log = interviewLog([
      sitting({ expectation: 4 }),
      sitting({ expectation: 4 }),
      sitting({ expectation: 4 }),
    ])!;

    expect(log.predicted).toBe(0);
    expect(log.predictionError).toBeNull();
  });

  test('measures the prediction against the learner own read afterwards', () => {
    const log = interviewLog([
      sitting({ expectation: 4, assessment: { clarity: 2, complexity: 2 } }),
      sitting({ expectation: 5, assessment: { clarity: 3, complexity: 3 } }),
      sitting({ expectation: 4, assessment: { clarity: 2, complexity: 4 } }),
    ])!;

    expect(log.predicted).toBe(3);
    // (4-2) + (5-3) + (4-3) over three sittings: called it 1.7 points high, on average.
    expect(log.predictionError).toBeCloseTo(5 / 3, 5);
  });
});

describe('the timed-pace card', () => {
  const timedQuestions: Question[] = [1, 2, 3, 4, 5].map((id) => ({
    id,
    title: `Q${id}`,
    pattern: 'two-pointers' as const,
    difficulty: 'medium' as const,
    estimatedTime: 20,
    ...QF,
  }));
  const timedProgress: Record<number, QuestionProgress> = Object.fromEntries(
    timedQuestions.map((q) => [
      q.id,
      {
        ...initialProgress(),
        status: 'solved' as const,
        completedAt: '2026-07-20',
        timeSpentMin: 20,
      },
    ]),
  );
  const fastSitting = contestRecord('2026-07-29', [
    { outcome: 'clean', minutesSpent: 40, targetMinutes: 20 },
    { outcome: 'clean', minutesSpent: 44, targetMinutes: 20 },
    { outcome: 'clean', minutesSpent: 42, targetMinutes: 20 },
    { outcome: 'slow', minutesSpent: 41, targetMinutes: 20 },
  ]);

  test('stays silent without both halves of the comparison', () => {
    // Contest rows but no measured untimed solves: nothing to compare against.
    const insights = buildInsights({ ...base, contests: Object.fromEntries([fastSitting]) });
    expect(insights.find((i) => i.id.startsWith('timed-pace'))).toBeUndefined();
  });

  test('reports a slower timed pace as minutes, never as a verdict about the learner', () => {
    const insights = buildInsights({
      ...base,
      all: timedQuestions,
      byId: timedProgress,
      contests: Object.fromEntries([fastSitting]),
    });

    const card = insights.find((i) => i.id === 'timed-pace-gap')!;
    expect(card).toBeDefined();
    expect(card.evidence[0]).toContain('1.00×');
    expect(card.evidence[1]).toContain('2.08×');
    const prose = card.headline + card.recommendation;
    expect(prose).not.toMatch(/worse under pressure|choke|panic|bad at/i);
  });

  test('an implausible timed ratio is discarded, exactly as the untimed side discards one', () => {
    // A contest left armed overnight is not a twelve-hour solve. All four consumers of
    // MAX_PLAUSIBLE_RATIO must discard the same samples or they disagree about one learner.
    expect(
      timedPace(
        Object.fromEntries([
          contestRecord('2026-07-29', [
            { outcome: 'clean', minutesSpent: 600, targetMinutes: 20 },
            { outcome: 'clean', minutesSpent: 700, targetMinutes: 20 },
            { outcome: 'clean', minutesSpent: 800, targetMinutes: 20 },
            { outcome: 'clean', minutesSpent: 900, targetMinutes: 20 },
          ]),
        ]),
      ),
    ).toBeNull();
  });
});

describe('the interview cards', () => {
  test('say nothing at all below three sittings', () => {
    const insights = buildInsights({ ...base, interviews: [sitting(), sitting()] });
    expect(insights.filter((i) => i.id.startsWith('interview-'))).toEqual([]);
  });

  test('a falling hint count reads as independence, and never as a score', () => {
    const insights = buildInsights({
      ...base,
      interviews: [
        sitting({ hintsTaken: 3 }),
        sitting({ hintsTaken: 3 }),
        sitting({ hintsTaken: 0 }),
        sitting({ hintsTaken: 1 }),
      ],
    });

    const card = insights.find((i) => i.id === 'interview-independence')!;
    expect(card.tone).toBe('strength');
    expect(card.headline + card.recommendation).not.toMatch(/score|grade|rating/i);
  });

  test('rising hint use is information, never a penalty', () => {
    const insights = buildInsights({
      ...base,
      interviews: [
        sitting({ hintsTaken: 0 }),
        sitting({ hintsTaken: 0 }),
        sitting({ hintsTaken: 2 }),
        sitting({ hintsTaken: 3 }),
      ],
    });

    const card = insights.find((i) => i.id === 'interview-hint-use')!;
    expect(card.tone).toBe('steady');
    expect(card.recommendation).toMatch(/costs nothing/i);
  });

  test('calibration compares two of the learner own numbers and says so', () => {
    const insights = buildInsights({
      ...base,
      interviews: [
        sitting({ expectation: 5, assessment: { clarity: 2 } }),
        sitting({ expectation: 5, assessment: { clarity: 2 } }),
        sitting({ expectation: 4, assessment: { clarity: 2 } }),
      ],
    });

    const card = insights.find((i) => i.id === 'interview-over-prediction')!;
    expect(card.evidence.join(' ')).toMatch(/Nothing here graded you/);
  });

  test('no performance card ever emits an aggregate figure about the learner', () => {
    // The no-judge contract, asserted on the rendered strings rather than on the exports.
    const insights = buildInsights({
      ...base,
      interviews: [
        sitting({ hintsTaken: 3, expectation: 5, assessment: { clarity: 2 } }),
        sitting({ hintsTaken: 3, expectation: 5, assessment: { clarity: 2 } }),
        sitting({ hintsTaken: 0, expectation: 4, assessment: { clarity: 2 } }),
        sitting({ hintsTaken: 0, expectation: 4, assessment: { clarity: 2 } }),
      ],
    });

    const prose = insights
      .filter((i) => i.id.startsWith('interview-'))
      .flatMap((i) => [i.headline, i.recommendation, ...i.evidence])
      .join(' ');
    expect(prose).not.toMatch(/out of 100|overall score|your grade|\brated \d/i);
  });
});
