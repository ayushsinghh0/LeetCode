import { buildInsights, type InsightInput } from '@/utils/engine/insights';
import { companyCoverage, companyPracticeSet } from '@/utils/engine/companies';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import { patternStats } from '@/utils/engine/stats';
import { COMPANIES } from '@/data/companies';
import { PATTERNS } from '@/data/patterns';
import type { DayLog, PatternId, Question, QuestionProgress } from '@/types';
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
  patternStats: [],
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
  test('names the pattern that is not holding, and points at it', () => {
    const all = [1, 2, 3, 4].map((id) => q(id, 'graphs'));
    const byId: Record<number, QuestionProgress> = {
      1: solvedWithReviews([false, false]),
      2: solvedWithReviews([false, true]),
      3: solvedWithReviews([false, false]),
      4: solvedWithReviews([true, false]),
    };

    const insights = buildInsights({
      ...base,
      all,
      byId,
      patternStats: patternStats(all, byId),
      drills: { '2026-07-29': { correct: 6, total: 8, missedPatterns: ['graphs', 'graphs'] } },
    });

    const finding = insights.find((i) => i.id === 'weak-pattern-graphs');
    expect(finding).toBeDefined();
    expect(finding!.headline).toMatch(/Graphs is not holding between reviews/);
    expect(finding!.evidence.join(' ')).toMatch(/2 drill misses/);
    expect(finding!.action.href).toBe('/patterns/graphs');
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
