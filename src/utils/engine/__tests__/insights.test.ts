import {
  accuracyTrend,
  buildInsights,
  confidenceCalibration,
  courseRetention,
  MIN_CALIBRATION_SAMPLES,
  MIN_TREND_ATTEMPTS,
  paceAgainstEstimate,
  paceTrend,
  recognitionRecord,
  solveCoverage,
  studyTime,
  type InsightInput,
} from '@/utils/engine/insights';
import { companyCoverage, companyPracticeSet } from '@/utils/engine/companies';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import { patternStats } from '@/utils/engine/stats';
import { MIN_TRANSFER_OBSERVATIONS, patternWeakness } from '@/utils/engine/weakness';
import { COMPANIES } from '@/data/companies';
import { PATTERNS } from '@/data/patterns';
import type {
  Confidence,
  CourseWeekProgress,
  DayLog,
  PatternId,
  PracticeSitting,
  Question,
  QuestionProgress,
  RevisionEvent,
} from '@/types';
import { QF } from '@/test/questionFixture';

const q = (id: number, pattern: PatternId = 'two-pointers', estimatedTime = 20): Question => ({
  id, title: `Q${id}`, pattern, difficulty: 'medium', estimatedTime, ...QF,
});

const dayLog = (date: string, solved: number[]): DayLog => ({
  date, solvedIds: solved, revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

function solvedWithReviews(passes: boolean[]): QuestionProgress {
  let p = applySolve(initialProgress(), '2026-07-01');
  passes.forEach((passed, i) => {
    p = applyRevision(p, `2026-07-${String(2 + i).padStart(2, '0')}`, passed);
  });
  return p;
}

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

describe('buildInsights — suppression over padding', () => {
  test('an empty history produces no findings at all', () => {
    expect(buildInsights(base)).toEqual([]);
  });

  test('a single drill day is not enough to call recognition a bottleneck', () => {
    const insights = buildInsights({
      ...base,
      drills: { '2026-07-29': { correct: 1, total: 8, missedPatterns: [] } },
    });

    expect(insights.find((i) => i.id === 'recognition-gap')).toBeUndefined();
  });

  test('two active days is not a cadence — the consistency card stays suppressed', () => {
    const insights = buildInsights({
      ...base,
      dayLogs: { '2026-07-29': dayLog('2026-07-29', [1]), '2026-07-28': dayLog('2026-07-28', [2]) },
    });

    expect(insights.find((i) => i.id === 'consistency')).toBeUndefined();
  });

  test('every emitted finding carries evidence and an action — never a bare metric', () => {
    const dayLogs: Record<string, DayLog> = {};
    for (let i = 1; i <= 14; i++) {
      const day = String(30 - i).padStart(2, '0');
      dayLogs[`2026-07-${day}`] = dayLog(`2026-07-${day}`, [i]);
    }
    const insights = buildInsights({ ...base, dayLogs });

    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.headline.trim()).not.toBe('');
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.recommendation.trim()).not.toBe('');
      expect(insight.action.href).toMatch(/^\//);
      expect(insight.action.label.trim()).not.toBe('');
    }
  });
});

describe('buildInsights — return after failure (identity, never guilt)', () => {
  const failDay = (date: string): DayLog => ({
    date, solvedIds: [], revisionsPassed: [], revisionsFailed: [1], xpEarned: 0, focusMinutes: 0,
  });
  const activeDay = (date: string): DayLog => ({
    date, solvedIds: [1], revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
  });
  const returnsFor = (dates: string[]): Record<string, DayLog> => {
    const logs: Record<string, DayLog> = {};
    for (const d of dates) {
      logs[`2026-07-${d}`] = failDay(`2026-07-${d}`);
      const next = String(Number(d) + 1).padStart(2, '0');
      logs[`2026-07-${next}`] = activeDay(`2026-07-${next}`);
    }
    return logs;
  };
  const find = (input: Partial<InsightInput>) =>
    buildInsights({ ...base, ...input }).find((i) => i.id === 'return-after-failure');

  test('stays silent below four observed miss-windows', () => {
    expect(find({ dayLogs: returnsFor(['01', '05', '09']) })).toBeUndefined();
  });

  test('a consistent return is recorded as identity evidence, in a strength tone', () => {
    const insight = find({ dayLogs: returnsFor(['01', '05', '09', '13']) });
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe('strength');
    expect(insight!.evidence.join(' ')).toMatch(/4 of 4/);
    // Identity as evidence of process — never a label handed out for free.
    expect(insight!.headline).toMatch(/comes back after a miss/i);
  });

  test('a miss whose two-day window has not elapsed is not counted against the rate', () => {
    const dayLogs = returnsFor(['01', '05', '09', '13']);
    dayLogs['2026-07-29'] = failDay('2026-07-29'); // yesterday's miss, window still open
    const insight = find({ dayLogs, today: '2026-07-30' });
    expect(insight!.evidence.join(' ')).toMatch(/4 of 4/); // not 4 of 5
    expect(insight!.tone).toBe('strength');
  });

  test('a low return rate is met with the five-minute re-entry, never blame', () => {
    const dayLogs: Record<string, DayLog> = {};
    for (const d of ['01', '05', '09', '13']) dayLogs[`2026-07-${d}`] = failDay(`2026-07-${d}`);
    const insight = find({ dayLogs });
    expect(insight).toBeDefined();
    expect(insight!.tone).not.toBe('attention'); // no alarm on the no-failure-state surface
    expect(insight!.action.href).toBe('/focus?entry=small');
    const text = `${insight!.headline} ${insight!.recommendation}`;
    expect(text).not.toMatch(/failed|lazy|behind|should have|\bdiscipline\b|excuse/i);
  });
});

describe('buildInsights — session follow-through (only ever shrink)', () => {
  const sitting = (planned: number, done: number): PracticeSitting => ({ date: '2026-07-20', planned, done });
  const find = (sittings: PracticeSitting[]) =>
    buildInsights({ ...base, sittings }).find((i) => i.id === 'session-follow-through');

  test('stays silent below five sittings', () => {
    expect(find([sitting(10, 10), sitting(10, 10), sitting(10, 10), sitting(10, 10)])).toBeUndefined();
  });

  test('finishing what you plan is reported as a strength', () => {
    const insight = find(Array.from({ length: 6 }, () => sitting(8, 8)));
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe('strength');
  });

  test('planning more than you finish is met by shrinking the session, never pushing', () => {
    const insight = find(Array.from({ length: 6 }, () => sitting(10, 2)));
    expect(insight).toBeDefined();
    expect(insight!.tone).not.toBe('attention');
    const text = `${insight!.headline} ${insight!.recommendation}`;
    expect(text).toMatch(/short|small|less|fewer/i);
    expect(text).not.toMatch(/try harder|push|more often|don.t (?:lose|break)/i);
  });
});

describe('buildInsights — weekly consistency', () => {
  // Both windows end YESTERDAY. Counting today (still in progress) against seven finished days
  // told a learner with perfect attendance that they were slipping, every morning, before they
  // had done anything — a wrong, guilt-shaped card produced by an off-by-one.
  const perfectFortnight = (): Record<string, DayLog> => {
    const logs: Record<string, DayLog> = {};
    for (let i = 1; i <= 14; i++) {
      const date = `2026-07-${String(30 - i).padStart(2, '0')}`;
      logs[date] = dayLog(date, [i]);
    }
    return logs;
  };

  test('an unstarted today does not make a perfect fortnight look like a decline', () => {
    const insights = buildInsights({ ...base, dayLogs: perfectFortnight() });

    const finding = insights.find((i) => i.id === 'consistency')!;
    expect(finding.headline).not.toMatch(/less often/);
    expect(finding.evidence[0]).toContain('7 of the 7 days up to yesterday');
  });

  test('a genuine decline is still reported, without blame language', () => {
    const logs = perfectFortnight();
    // Drop four of the last seven days.
    for (const day of ['29', '28', '27', '26']) delete logs[`2026-07-${day}`];

    const finding = buildInsights({ ...base, dayLogs: logs }).find((i) => i.id === 'consistency')!;
    expect(finding.headline).toMatch(/less often/);
    expect(finding.recommendation).toMatch(/Shrink the daily commitment/);
    expect(finding.headline + finding.recommendation).not.toMatch(/lost|failed|streak|should have/i);
  });
});

describe('buildInsights — recognition vs implementation', () => {
  // 12 graded attempts — above MIN_REVISION_ATTEMPTS, whose floor exists so the measurement's
  // resolution is finer than the gap threshold it feeds.
  const byId: Record<number, QuestionProgress> = {
    1: solvedWithReviews([true, true, true, true, true, true]),
    2: solvedWithReviews([true, true, true, true, true, true]),
  };

  test('names recognition as the bottleneck when drills trail graded recalls', () => {
    const insights = buildInsights({
      ...base,
      byId,
      drills: {
        '2026-07-27': { correct: 2, total: 8, missedPatterns: ['graphs'] },
        '2026-07-28': { correct: 3, total: 8, missedPatterns: ['graphs'] },
        '2026-07-29': { correct: 2, total: 8, missedPatterns: [] },
      },
    });

    const finding = insights.find((i) => i.id === 'recognition-gap');
    expect(finding).toBeDefined();
    expect(finding!.headline).toMatch(/Naming the pattern is your bottleneck/);
    expect(finding!.evidence.join(' ')).toMatch(/24 prompts across 3 days/);
    expect(finding!.action.href).toBe('/drills');
  });

  test('names implementation instead when the gap runs the other way', () => {
    const insights = buildInsights({
      ...base,
      byId: {
        1: solvedWithReviews([false, false, false, false, true, true]),
        2: solvedWithReviews([false, false, false, false, true, true]),
      },
      drills: {
        '2026-07-27': { correct: 8, total: 8, missedPatterns: [] },
        '2026-07-28': { correct: 8, total: 8, missedPatterns: [] },
        '2026-07-29': { correct: 7, total: 8, missedPatterns: [] },
      },
    });

    const finding = insights.find((i) => i.id === 'implementation-gap');
    expect(finding).toBeDefined();
    expect(finding!.headline).toMatch(/the code is where it breaks down/);
  });
});

describe('buildInsights — schedule risk', () => {
  test('flags a future day whose review load overruns the stated capacity', () => {
    const insights = buildInsights({
      ...base,
      capacityMin: 30,
      revisionMinutes: 8,
      forecast: [
        { date: '2026-07-31', count: 1 },
        { date: '2026-08-05', count: 11 }, // ~88 min against a 30 min budget
      ],
    });

    const finding = insights.find((i) => i.id === 'schedule-risk');
    expect(finding).toBeDefined();
    // Formatted for a human, not a raw ISO key — every other date in the app reads this way.
    expect(finding!.headline).toContain('Wednesday Aug 5');
    expect(finding!.evidence.join(' ')).toContain('88 minutes');
    expect(finding!.evidence.join(' ')).toContain('30 minutes');
    // The fix is forward-rebalancing, not a debt notice.
    expect(finding!.recommendation).toMatch(/forward/);
  });

  test('a load inside capacity is not flagged', () => {
    const insights = buildInsights({
      ...base,
      capacityMin: 180,
      forecast: [{ date: '2026-08-05', count: 4 }],
    });

    expect(insights.find((i) => i.id === 'schedule-risk')).toBeUndefined();
  });
});

describe('buildInsights — weak pattern', () => {
  // The card reads the ONE weakness model rather than scoring patterns itself. Two formulas
  // ranking the same learner's patterns is exactly what engine/weakness.ts exists to prevent.
  const all = [1, 2, 3, 4].map((id) => q(id, 'graphs'));
  const byId: Record<number, QuestionProgress> = {
    1: solvedWithReviews([false, false]),
    2: solvedWithReviews([false, true]),
    3: solvedWithReviews([false, false]),
    4: solvedWithReviews([true, false]),
  };
  const drills = { '2026-07-29': { correct: 6, total: 8, missedPatterns: ['graphs', 'graphs'] } };

  test('names the pattern the model ranks first, with the model’s own evidence', () => {
    const weakness = patternWeakness({ today: base.today, all, byId, drills, contests: {}, families: [] });
    const insights = buildInsights({ ...base, all, byId, drills, weakness });

    const finding = insights.find((i) => i.id === 'weak-pattern-graphs');
    expect(finding).toBeDefined();
    expect(finding!.headline).toMatch(/Graphs is the pattern your record says to work on/);
    // Verbatim from the model — every line carries its numbers.
    expect(finding!.evidence).toEqual(weakness[0]!.signals.slice(0, 3).map((s) => s.detail));
    // The drill misses in the fixture must be among the reasons shown, asserted by signal
    // identity rather than by the model's wording: this card renders whatever prose the weakness
    // model writes, so pinning that prose here would test weakness.ts's copy from a second file.
    expect(weakness[0]!.signals.slice(0, 3).map((s) => s.id)).toContain('recognition');
    expect(finding!.evidence.join(' ')).toMatch(/\d+ recognition/);
    expect(finding!.action.href).toBe('/patterns/graphs');
  });

  test('an empty weakness model produces no weak-pattern card at all', () => {
    expect(buildInsights({ ...base, all, byId, drills }).find((i) => i.id.startsWith('weak-pattern')))
      .toBeUndefined();
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Measurements                                                                                 */
/* ------------------------------------------------------------------------------------------ */

const withHistory = (revisionHistory: RevisionEvent[]): QuestionProgress => ({
  ...initialProgress(),
  status: 'solved',
  revisionHistory,
});

const courseWeek = (over: Partial<CourseWeekProgress>): CourseWeekProgress => ({
  day1DoneOn: null,
  day2DoneOn: null,
  notes: '',
  revisionStage: 0,
  nextRevision: null,
  lastReviewed: null,
  revisionHistory: [],
  ...over,
});

const events = (from: number, count: number, passed: (i: number) => boolean): RevisionEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-07-${String(from + i).padStart(2, '0')}`,
    passed: passed(i),
  }));

describe('confidence calibration', () => {
  const rated = (confidence: Confidence, outcomes: boolean[]): QuestionProgress => ({
    ...solvedWithReviews(outcomes),
    confidence,
  });

  const bucket = (confidence: Confidence, count: number, passed: (i: number) => boolean) => {
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 0; i < count; i++) byId[i] = rated(confidence, [passed(i)]);
    return byId;
  };

  test('nothing rated and graded is null, not a verdict', () => {
    expect(confidenceCalibration({})).toBeNull();
    // Rated but never recalled: the prediction has not been tested yet.
    expect(confidenceCalibration({ 1: rated(5, []) })).toBeNull();
  });

  test('a bucket one short of the floor is unmeasured, and says how far short', () => {
    const report = confidenceCalibration(bucket(5, MIN_CALIBRATION_SAMPLES - 1, () => false))!;

    expect(report.verdict).toBe('unmeasured');
    expect(report.high).toBeNull();
    expect(report.highCount).toBe(MIN_CALIBRATION_SAMPLES - 1);
    expect(report.observations).toBe(MIN_CALIBRATION_SAMPLES - 1);
  });

  test('names overconfidence once the confident bucket clears the floor and keeps failing', () => {
    const report = confidenceCalibration(bucket(5, MIN_CALIBRATION_SAMPLES, (i) => i >= 4))!;

    expect(report.verdict).toBe('overconfident');
    expect(report.high).toEqual({ observations: MIN_CALIBRATION_SAMPLES, passRate: 0.5 });
  });

  test('names underconfidence when the shaky bucket passes anyway', () => {
    const report = confidenceCalibration(bucket(1, MIN_CALIBRATION_SAMPLES, (i) => i > 0))!;

    expect(report.verdict).toBe('underconfident');
    expect(report.low!.passRate).toBeGreaterThan(0.75);
  });

  test('only the FIRST recall counts — later ones test a state the rating never described', () => {
    // Every question passed the recall its rating was predicting and then lapsed repeatedly.
    // Counting all attempts would call this overconfidence; counting the prediction does not.
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 0; i < MIN_CALIBRATION_SAMPLES; i++) byId[i] = rated(5, [true, false, false, false]);

    expect(confidenceCalibration(byId)!.verdict).toBe('calibrated');
  });

  test('a rating of 3 is an observation but predicts nothing, so it joins neither bucket', () => {
    const report = confidenceCalibration(bucket(3, 4, () => false))!;

    expect(report.observations).toBe(4);
    expect(report.highCount).toBe(0);
    expect(report.lowCount).toBe(0);
    expect(report.verdict).toBe('unmeasured');
  });

  test('buildInsights emits the calibration card only once it is measurable', () => {
    const thin = buildInsights({ ...base, byId: bucket(5, MIN_CALIBRATION_SAMPLES - 1, () => false) });
    expect(thin.find((i) => i.id === 'calibration')).toBeUndefined();

    const finding = buildInsights({
      ...base,
      byId: bucket(5, MIN_CALIBRATION_SAMPLES, (i) => i >= 4),
    }).find((i) => i.id === 'calibration')!;

    expect(finding.headline).toMatch(/not predicting the recall/);
    expect(finding.evidence.join(' ')).toMatch(new RegExp(`over ${MIN_CALIBRATION_SAMPLES} of them`));
    expect(finding.action.href).toBe('/revision');
  });
});

describe('accuracy trend', () => {
  test('null until both halves clear the attempt floor', () => {
    const short = withHistory(events(1, MIN_TREND_ATTEMPTS * 2 - 1, () => true));
    expect(accuracyTrend({ 1: short })).toBeNull();
  });

  test('a delta inside what the samples can resolve reads as steady, not as progress', () => {
    // 10 attempts a side resolves to 10pp each, so the honest noise floor is 20pp. A 10pp
    // improvement is inside it and must not be reported as one.
    const trend = accuracyTrend({
      1: withHistory([
        ...events(1, 10, (i) => i < 8), // 80%
        ...events(11, 10, (i) => i < 9), // 90%
      ]),
    })!;

    expect(trend.deltaPp).toBe(10);
    expect(trend.noiseFloorPp).toBe(20);
    expect(trend.verdict).toBe('steady');
  });

  test('reports improvement once the delta clears the floor the sample sizes set', () => {
    const trend = accuracyTrend({
      1: withHistory([...events(1, 10, (i) => i < 3), ...events(11, 10, () => true)]),
    })!;

    expect(trend.verdict).toBe('improving');
    expect(trend.recent.passRate).toBe(1);
    expect(trend.prior.passRate).toBeCloseTo(0.3);
  });

  test('course reviews are graded into the same record — one ladder, one accuracy figure', () => {
    const byId = { 1: withHistory(events(1, 10, () => true)) };
    expect(accuracyTrend(byId)).toBeNull();

    const withCourse = accuracyTrend(byId, {
      w00: courseWeek({ revisionHistory: events(11, 10, () => false) }),
    })!;
    expect(withCourse.verdict).toBe('declining');
  });
});

// These two describes sit below the fixture helpers rather than up with the other builder suites:
// `withHistory`, `events` and `courseWeek` are const declarations, and a describe body runs at
// collection time, so referencing them from above would be a temporal-dead-zone error.
describe('buildInsights — am I improving?', () => {
  // The measurement has been implemented and tested since the start; without a builder it could
  // never become a *finding*, which left the page's own headline question unanswerable.
  const split = (priorPasses: number, recentPasses: number): Record<number, QuestionProgress> => ({
    1: withHistory([
      ...events(1, MIN_TREND_ATTEMPTS, (i) => i < priorPasses),
      ...events(11, MIN_TREND_ATTEMPTS, (i) => i < recentPasses),
    ]),
  });

  test('one recall short of the floor there is no finding at all', () => {
    const byId = { 1: withHistory(events(1, MIN_TREND_ATTEMPTS * 2 - 1, () => true)) };

    expect(buildInsights({ ...base, byId }).find((i) => i.id === 'accuracy-trend')).toBeUndefined();
  });

  test('a decline is reported as two measured rates, never as a score', () => {
    const finding = buildInsights({ ...base, byId: split(10, 3) }).find(
      (i) => i.id === 'accuracy-trend',
    )!;

    expect(finding.headline).toMatch(/passing less often than it used to/);
    expect(finding.evidence[0]).toBe(
      '30% over your last 10 graded recalls; 100% over the 10 before them.',
    );
    // The movement is stated against what the samples can resolve, so the reader can see the
    // claim is bigger than the noise rather than being told to trust it.
    expect(finding.evidence[1]).toMatch(/70-point move, against the 20 points/);
    expect(finding.recommendation).toMatch(/fewer new questions/);
    expect(finding.action).toEqual({ label: 'Open revisions', href: '/revision' });
    expect(finding.tone).toBe('attention');
  });

  test('improvement points at the one dimension recall was never tested on', () => {
    const finding = buildInsights({ ...base, byId: split(3, 10) }).find(
      (i) => i.id === 'accuracy-trend',
    )!;

    expect(finding.headline).toMatch(/holding up better than it used to/);
    expect(finding.action).toEqual({ label: 'Sit a timed round', href: '/contest' });
    expect(finding.tone).toBe('strength');
  });

  test('a move inside the noise floor is reported as holding, not as progress', () => {
    const finding = buildInsights({ ...base, byId: split(8, 9) }).find(
      (i) => i.id === 'accuracy-trend',
    )!;

    expect(finding.headline).toMatch(/holding, not moving/);
    expect(finding.evidence[1]).toMatch(/10-point move, against the 20 points/);
    expect(finding.tone).toBe('steady');
  });

  test('course-week reviews are graded into the same finding — one ladder, one verdict', () => {
    const byId = { 1: withHistory(events(1, MIN_TREND_ATTEMPTS, () => true)) };
    // Question revisions alone are one recall short of two halves.
    expect(buildInsights({ ...base, byId }).find((i) => i.id === 'accuracy-trend')).toBeUndefined();

    const finding = buildInsights({
      ...base,
      byId,
      courseByWeekId: { w00: courseWeek({ revisionHistory: events(11, MIN_TREND_ATTEMPTS, () => false) }) },
    }).find((i) => i.id === 'accuracy-trend')!;

    expect(finding.headline).toMatch(/passing less often/);
    expect(finding.evidence.join(' ')).toMatch(/course-week reviews climb the same ladder/);
  });
});

describe('buildInsights — can I carry an idea into a problem I have not seen?', () => {
  test('below the observation floor there is a count and no card', () => {
    // `transferRecord` suppresses its own rate under MIN_TRANSFER_OBSERVATIONS; the card inherits
    // that floor rather than inventing a second one.
    const insights = buildInsights({
      ...base,
      transfer: { met: MIN_TRANSFER_OBSERVATIONS - 1, carried: 0, rate: null },
    });

    expect(insights.find((i) => i.id === 'transfer')).toBeUndefined();
  });

  test('names the failure when an idea does not survive a change of disguise', () => {
    const finding = buildInsights({
      ...base,
      transfer: { met: 10, carried: 3, rate: 0.3 },
    }).find((i) => i.id === 'transfer')!;

    expect(finding.headline).toMatch(/not carrying into their next disguise/);
    expect(finding.evidence[0]).toMatch(/^3 of 10 problems from families you had already solved/);
    expect(finding.action).toEqual({ label: 'Start a drill', href: '/drills' });
    expect(finding.tone).toBe('attention');
  });

  test('a holding record points at rehearsal rather than at more volume', () => {
    const finding = buildInsights({
      ...base,
      transfer: { met: 10, carried: 9, rate: 0.9 },
    }).find((i) => i.id === 'transfer')!;

    expect(finding.headline).toMatch(/carrying into problems you had not seen/);
    expect(finding.action).toEqual({ label: 'Run an interview round', href: '/interview' });
    expect(finding.tone).toBe('strength');
  });

  test('the middle of the range carries no claim — five observations cannot pay for one', () => {
    const insights = buildInsights({ ...base, transfer: { met: 10, carried: 6, rate: 0.6 } });

    expect(insights.find((i) => i.id === 'transfer')).toBeUndefined();
  });
});

describe('pace measurements', () => {
  const timed = (date: string, minutes: number): QuestionProgress => ({
    ...initialProgress(),
    status: 'solved',
    completedAt: date,
    timeSpentMin: minutes,
  });

  test('the figure stays silent below the estimator’s own sample floor', () => {
    expect(paceAgainstEstimate([{ ratio: 1 }, { ratio: 2 }])).toBeNull();
    expect(paceAgainstEstimate(Array.from({ length: 5 }, () => ({ ratio: 2 })))).toEqual({
      ratio: 2,
      samples: 5,
    });
  });

  test('the trend needs both halves and reports the direction, not just a number', () => {
    const all = Array.from({ length: 12 }, (_, i) => q(i + 1, 'graphs', 20));
    const byId: Record<number, QuestionProgress> = {};
    // Earlier six at twice the estimate, recent six on it.
    all.forEach((question, i) => {
      byId[question.id] = timed(`2026-07-${String(i + 1).padStart(2, '0')}`, i < 6 ? 40 : 20);
    });

    expect(paceTrend(all.slice(0, 8), byId)).toBeNull(); // 8 samples: neither half clears the floor
    const trend = paceTrend(all, byId)!;
    expect(trend.verdict).toBe('faster');
    expect(trend.prior).toBe(2);
    expect(trend.recent).toBe(1);
    expect(trend.samples).toBe(12);
  });

  test('an unmeasured solve contributes nothing rather than counting as instant', () => {
    const all = Array.from({ length: 12 }, (_, i) => q(i + 1, 'graphs', 20));
    const byId: Record<number, QuestionProgress> = {};
    all.forEach((question, i) => {
      byId[question.id] = timed(`2026-07-${String(i + 1).padStart(2, '0')}`, i < 6 ? 40 : 0);
    });

    expect(paceTrend(all, byId)).toBeNull();
  });
});

describe('cold-read and coverage measurements', () => {
  test('recognition needs a few recorded days, and reports against chance', () => {
    expect(recognitionRecord({ '2026-07-29': { correct: 8, total: 8, missedPatterns: [] } })).toBeNull();

    const record = recognitionRecord({
      '2026-07-27': { correct: 4, total: 8, missedPatterns: [] },
      '2026-07-28': { correct: 4, total: 8, missedPatterns: [] },
      '2026-07-29': { correct: 4, total: 8, missedPatterns: [] },
    })!;
    expect(record.rate).toBe(0.5);
    expect(record.days).toBe(3);
    expect(record.chance).toBe(0.25);
    // Half right on a four-option prompt is a third of the range above guessing, not half of it.
    expect(record.aboveChance).toBeCloseTo(1 / 3);
  });

  test('solve coverage separates tested, untested and unaided', () => {
    const coverage = solveCoverage({
      1: solvedWithReviews([true]),
      2: { ...applySolve(initialProgress(), '2026-07-01'), hintLevelUsed: 2 },
      3: applySolve(initialProgress(), '2026-07-02'),
      4: initialProgress(), // unsolved — not counted at all
    });

    expect(coverage.solved).toBe(3);
    expect(coverage.tested).toBe(1);
    expect(coverage.untested).toBe(2);
    expect(coverage.unaided).toBe(2);
  });

  test('study time reports what the minutes bought, never a bare total', () => {
    const record = studyTime(
      {
        '2026-07-30': { ...dayLog('2026-07-30', [1, 2]), focusMinutes: 60 },
        '2026-07-29': { ...dayLog('2026-07-29', []), revisionsPassed: [3], focusMinutes: 30 },
        '2026-06-01': { ...dayLog('2026-06-01', [9]), focusMinutes: 999 }, // outside the window
      },
      '2026-07-30',
      14,
    );

    expect(record).toEqual({ minutes: 90, solves: 2, reviews: 1, activeDays: 2, windowDays: 14 });
  });

  test('course retention counts the ladder, not attendance', () => {
    const record = courseRetention({
      w00: courseWeek({ nextRevision: '2026-08-01', revisionHistory: [{ date: '2026-07-20', passed: true }] }),
      w01: courseWeek({ nextRevision: '2026-08-02' }), // cleared, never reviewed
      w02: courseWeek({ revisionStage: 5, revisionHistory: [{ date: '2026-07-21', passed: false }] }),
      w03: courseWeek({ day1DoneOn: '2026-07-25' }), // half-done, not on the ladder
    });

    expect(record.onLadder).toBe(3);
    expect(record.retained).toBe(1);
    expect(record.neverReviewed).toBe(1);
    expect(record.attempts).toBe(2);
    expect(record.passRate).toBe(0.5);
  });
});

describe('company coverage', () => {
  const google = COMPANIES.find((c) => c.id === 'google')!;

  test('the shipped evidence never claims pattern relevance without a topic-naming source', () => {
    for (const company of COMPANIES) {
      if (company.evidence !== 'topics') {
        expect(company.patterns).toEqual([]);
      } else {
        expect(company.patterns.length).toBeGreaterThan(0);
      }
      // Every entry is a quoted, dated, first-party link.
      expect(company.url.startsWith('https://')).toBe(true);
      expect(company.quote.length).toBeGreaterThanOrEqual(40);
      expect(company.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('reports coverage of the mapped patterns and grades each one', () => {
    const all = [
      ...Array.from({ length: 4 }, (_, i) => q(i + 1, 'graphs')),
      ...Array.from({ length: 4 }, (_, i) => q(i + 10, 'hash-maps')),
    ];
    const byId: Record<number, QuestionProgress> = {
      1: solvedWithReviews([true, true]),
      2: solvedWithReviews([true, true]),
      3: solvedWithReviews([true, true]),
    };

    const coverage = companyCoverage(['graphs', 'hash-maps'], patternStats(all, byId), all, byId);

    expect(coverage.solved).toBe(3);
    expect(coverage.total).toBe(8);
    expect(coverage.strong).toEqual(['graphs']);
    expect(coverage.gaps).toEqual(['hash-maps']);
    // 5 unsolved questions at 20 minutes each.
    expect(coverage.remainingMinutes).toBe(100);
  });

  test('the practice set opens on the weakest area, easiest first', () => {
    const all = [
      ...Array.from({ length: 3 }, (_, i) => q(i + 1, 'graphs')),
      { ...q(10, 'hash-maps'), difficulty: 'hard' as const },
      { ...q(11, 'hash-maps'), difficulty: 'easy' as const },
    ];
    const byId: Record<number, QuestionProgress> = {
      1: solvedWithReviews([true, true]),
      2: solvedWithReviews([true, true]),
    };

    const coverage = companyCoverage(['graphs', 'hash-maps'], patternStats(all, byId), all, byId);
    const set = companyPracticeSet(coverage, all, byId);

    expect(set[0]!.id).toBe(11); // the gap pattern's easiest unsolved question
    expect(set[1]!.id).toBe(10);
  });

  test("every company's mapped patterns are real roadmap pattern ids", () => {
    // The previous version of this test asserted `coverage.patterns.length === input.length`,
    // which `companyCoverage` satisfies by construction — it would have passed with a bogus id.
    // Check the ids against the actual pattern registry instead.
    const known = new Set(PATTERNS.map((p) => p.id));
    for (const company of COMPANIES) {
      for (const pattern of company.patterns) {
        expect(known.has(pattern)).toBe(true);
      }
    }
    expect(google.patterns.length).toBeGreaterThan(0);
  });

  test('a quote is never a paraphrase — no entry admits to one in its own note', () => {
    // Two entries were removed for exactly this: their `note` said the "quote" was a paraphrase
    // of page headings, while the UI renders it as an attributed blockquote.
    for (const company of COMPANIES) {
      expect(company.note ?? '').not.toMatch(/paraphras/i);
    }
  });
});
