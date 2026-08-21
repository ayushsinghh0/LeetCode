import { describe, expect, it } from 'vitest';
import {
  MIN_BAND_EVIDENCE,
  RATING_BANDS,
  RECENCY_CLEAR_DAYS,
  applyContestReview,
  applyContestSolve,
  bandById,
  bandEvidenceFromRegister,
  buildContestIndex,
  contestStateFromQuestionProgress,
  dueContestSlugs,
  filterContestProblems,
  initialContestProgress,
  isFilterActive,
  ratingBand,
  recommendBand,
  scoreRevisionCandidates,
  selectionReason,
} from '@/utils/engine/contestLibrary';
import { REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';
import type { ContestLibraryProblem, ContestProblemProgress, QuestionProgress } from '@/types';

const TODAY = '2026-07-30';

function problem(over: Partial<ContestLibraryProblem> = {}): ContestLibraryProblem {
  return {
    slug: 'two-sum',
    frontendId: 1,
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    officialDifficulty: 'easy',
    contestRating: 1500,
    contest: { slug: 'weekly-contest-100', type: 'weekly', number: 100, index: 1 },
    leetcodeTopics: ['Array', 'Hash Table'],
    aicmPatterns: ['hash-maps'],
    inferredPatterns: [],
    aicmSubpatterns: [],
    mappingConfidence: 'exact',
    premium: false,
    curriculumQuestionId: null,
    ...over,
  };
}

const lookup =
  (map: Record<string, ContestProblemProgress>) =>
  (slug: string): ContestProblemProgress | undefined =>
    map[slug];

describe('rating bands', () => {
  it('assigns every rating to exactly one band', () => {
    for (const rating of [0, 900, 1199, 1200, 1399, 1400, 2199, 2200, 3800]) {
      const matches = RATING_BANDS.filter((b) => rating >= b.min && rating <= b.max);
      expect(matches, `rating ${rating}`).toHaveLength(1);
      expect(ratingBand(rating)).toBe(matches[0]);
    }
  });

  it('resolves a band by id, and reports nothing for an unknown one', () => {
    expect(bandById('1600')?.min).toBe(1600);
    expect(bandById('nope')).toBeUndefined();
  });
});

describe('filterContestProblems — one predicate, every dimension', () => {
  const pool = [
    problem({ slug: 'a', contestRating: 1250, officialDifficulty: 'easy', aicmPatterns: ['two-pointers'], contest: { slug: 'weekly-contest-1', type: 'weekly', number: 1, index: 1 } }),
    problem({ slug: 'b', contestRating: 1650, officialDifficulty: 'medium', aicmPatterns: ['sliding-window'], contest: { slug: 'biweekly-contest-2', type: 'biweekly', number: 2, index: 3 } }),
    problem({ slug: 'c', contestRating: 2400, officialDifficulty: 'hard', aicmPatterns: ['graphs'], premium: true, contest: { slug: 'weekly-contest-3', type: 'weekly', number: 3, index: 4 } }),
    problem({ slug: 'd', contestRating: 1700, officialDifficulty: 'medium', aicmPatterns: [], inferredPatterns: ['math-geometry'], mappingConfidence: 'heuristic', curriculumQuestionId: 42 }),
  ];
  const slugs = (list: ContestLibraryProblem[]) => list.map((p) => p.slug);

  it('returns everything when nothing is constrained', () => {
    expect(filterContestProblems(pool, {})).toHaveLength(4);
    expect(isFilterActive({})).toBe(false);
  });

  it('treats an empty array as unconstrained, not as "match nothing"', () => {
    expect(filterContestProblems(pool, { difficulty: [], aicmPatterns: [] })).toHaveLength(4);
    expect(isFilterActive({ difficulty: [] })).toBe(false);
  });

  it('filters by contest type, index, difficulty and rating', () => {
    expect(slugs(filterContestProblems(pool, { contestType: ['biweekly'] }))).toEqual(['b']);
    expect(slugs(filterContestProblems(pool, { problemIndex: [4] }))).toEqual(['c']);
    expect(slugs(filterContestProblems(pool, { difficulty: ['hard'] }))).toEqual(['c']);
    expect(slugs(filterContestProblems(pool, { ratingMin: 1600, ratingMax: 1800 }))).toEqual(['b', 'd']);
    expect(slugs(filterContestProblems(pool, { ratingBands: ['1200'] }))).toEqual(['a']);
  });

  it('filters by AICM pattern using only confident mappings by default', () => {
    expect(slugs(filterContestProblems(pool, { aicmPatterns: ['two-pointers'] }))).toEqual(['a']);
    // 'd' claims math-geometry only heuristically — an inferred pattern is not a claim that the
    // problem IS that pattern, so it must not satisfy the filter.
    expect(filterContestProblems(pool, { aicmPatterns: ['math-geometry'] })).toEqual([]);
    expect(
      slugs(filterContestProblems(pool, { aicmPatterns: ['math-geometry'], includeInferredPatterns: true })),
    ).toEqual(['d']);
  });

  it('filters by curriculum status and premium', () => {
    expect(slugs(filterContestProblems(pool, { curriculumStatus: ['curriculum'] }))).toEqual(['d']);
    expect(filterContestProblems(pool, { includePremium: false }).map((p) => p.slug)).not.toContain('c');
  });

  it('composes every active constraint with AND', () => {
    const result = filterContestProblems(pool, {
      contestType: ['weekly'],
      difficulty: ['easy'],
      ratingMax: 1300,
      aicmPatterns: ['two-pointers'],
    });
    expect(slugs(result)).toEqual(['a']);
    // One contradictory constraint empties it, rather than any single filter winning.
    expect(filterContestProblems(pool, { contestType: ['weekly'], difficulty: ['easy'], ratingMin: 2000 })).toEqual([]);
  });

  it('filters by progress against supplied learner state', () => {
    const progress = lookup({
      a: { ...initialContestProgress(), solved: true, attempts: 1, solvedOn: '2026-07-01' },
      b: { ...initialContestProgress(), attempts: 2 },
      // Solved implies at least one attempt — the appliers always increment together, so a
      // fixture that separated them would be testing a state the product cannot reach.
      c: { ...initialContestProgress(), solved: true, attempts: 1, nextRevision: '2026-07-29', revisionStage: 1 },
    });
    expect(slugs(filterContestProblems(pool, { progress: ['solved'] }, progress, TODAY))).toEqual(['a', 'c']);
    expect(slugs(filterContestProblems(pool, { progress: ['never-attempted'] }, progress, TODAY))).toEqual(['d']);
    expect(slugs(filterContestProblems(pool, { progress: ['attempted'] }, progress, TODAY))).toEqual(['a', 'b', 'c']);
    expect(slugs(filterContestProblems(pool, { progress: ['due'] }, progress, TODAY))).toEqual(['c']);
    // Several progress chips read as "any of these".
    expect(slugs(filterContestProblems(pool, { progress: ['due', 'never-attempted'] }, progress, TODAY))).toEqual(['c', 'd']);
  });

  it('searches titles case-insensitively', () => {
    const titled = [problem({ slug: 'x', title: 'Maximum Subarray Sum' }), problem({ slug: 'y', title: 'Two Sum' })];
    expect(slugs(filterContestProblems(titled, { search: 'SUBARRAY' }))).toEqual(['x']);
  });
});

describe('buildContestIndex', () => {
  const pool = [
    problem({ slug: 'a', aicmPatterns: ['two-pointers'], leetcodeTopics: ['Array'] }),
    problem({ slug: 'b', aicmPatterns: ['two-pointers', 'graphs'], leetcodeTopics: ['Array', 'Graph Theory'] }),
    problem({ slug: 'c', aicmPatterns: [], inferredPatterns: ['math-geometry'], mappingConfidence: 'heuristic', leetcodeTopics: ['Math'] }),
  ];

  it('indexes every dimension the library filters on', () => {
    const index = buildContestIndex(pool);
    expect(index.bySlug.size).toBe(3);
    expect(index.byAicmPattern.get('two-pointers')).toEqual(['a', 'b']);
    expect(index.byLeetcodeTopic.get('Array')).toEqual(['a', 'b']);
    expect(index.byCurriculumStatus.get('contest-only')).toHaveLength(3);
    expect(index.byMappingConfidence.get('heuristic')).toEqual(['c']);
  });

  it('never indexes an inferred pattern as if it were claimed', () => {
    // An index is exactly where the confident/inferred distinction would quietly dissolve.
    const index = buildContestIndex(pool);
    expect(index.byAicmPattern.get('math-geometry')).toBeUndefined();
  });

  it('orders the topic option list by frequency', () => {
    const index = buildContestIndex(pool);
    expect(index.topicsByFrequency[0]).toEqual({ topic: 'Array', count: 2 });
  });
});

describe('the shared ladder, second register', () => {
  it('enters the 1/3/7/15/30 ladder on the first solve', () => {
    const solved = applyContestSolve(initialContestProgress(), TODAY);
    expect(solved.solved).toBe(true);
    expect(solved.revisionStage).toBe(0);
    expect(solved.nextRevision).toBe('2026-07-31'); // +1, REVISION_INTERVALS[0]
    expect(REVISION_INTERVALS[0]).toBe(1);
  });

  it('does not restart the ladder when an already-solved problem is re-solved', () => {
    const first = applyContestSolve(initialContestProgress(), '2026-07-01');
    const passed = applyContestReview(first, '2026-07-02', true);
    const again = applyContestSolve(passed, TODAY);
    // Practising something again must not silently reset the schedule underneath the learner.
    expect(again.revisionStage).toBe(passed.revisionStage);
    expect(again.nextRevision).toBe(passed.nextRevision);
    // The FIRST solve is what the ladder and the recency penalty are measured from, so it holds.
    expect(again.solvedOn).toBe('2026-07-01');
    // Attempts still counts up: doing the problem again genuinely is another attempt, and this
    // number is evidence, never a penalty.
    expect(again.attempts).toBe(2);
  });

  it('climbs on a pass and restarts at stage 0 due tomorrow on a fail', () => {
    const solved = applyContestSolve(initialContestProgress(), '2026-07-01');
    const passed = applyContestReview(solved, TODAY, true);
    expect(passed.revisionStage).toBe(1);
    expect(passed.revisionHistory).toHaveLength(1);

    const failed = applyContestReview(passed, TODAY, false);
    expect(failed.revisionStage).toBe(0);
    expect(failed.nextRevision).toBe('2026-07-31');
  });

  it('lists due slugs most-overdue-first without needing the dataset', () => {
    const bySlug: Record<string, ContestProblemProgress> = {
      late: { ...initialContestProgress(), solved: true, revisionStage: 1, nextRevision: '2026-07-20' },
      today: { ...initialContestProgress(), solved: true, revisionStage: 1, nextRevision: TODAY },
      later: { ...initialContestProgress(), solved: true, revisionStage: 1, nextRevision: '2026-09-01' },
      unsolved: { ...initialContestProgress(), nextRevision: '2026-07-01' },
    };
    expect(dueContestSlugs(bySlug, TODAY)).toEqual(['late', 'today']);
  });
});

describe('scoreRevisionCandidates — what is worth doing now', () => {
  it('ranks a due review above an unsolved problem', () => {
    const pool = [problem({ slug: 'unsolved' }), problem({ slug: 'due' })];
    const progress = lookup({
      due: { ...initialContestProgress(), solved: true, revisionStage: 1, nextRevision: '2026-07-25', solvedOn: '2026-07-01' },
    });
    const ranked = scoreRevisionCandidates({ pool, progress, today: TODAY });
    expect(ranked[0]!.problem.slug).toBe('due');
    expect(ranked[0]!.reasons[0]).toContain('past its scheduled date');
  });

  it('penalises something solved days ago without excluding it forever', () => {
    const pool = [problem({ slug: 'fresh' }), problem({ slug: 'stale' })];
    const progress = lookup({
      fresh: { ...initialContestProgress(), solved: true, solvedOn: '2026-07-29' },
      stale: { ...initialContestProgress(), solved: true, solvedOn: '2026-05-01' },
    });
    const ranked = scoreRevisionCandidates({ pool, progress, today: TODAY });
    const fresh = ranked.find((r) => r.problem.slug === 'fresh')!;
    const stale = ranked.find((r) => r.problem.slug === 'stale')!;
    expect(fresh.score).toBeLessThan(stale.score);
    // Never an infinite exclusion — it is still in the result.
    expect(ranked).toHaveLength(2);
  });

  it('clears the recency penalty entirely past the window', () => {
    const solvedOn = '2026-06-01'; // ~59 days before TODAY, well past RECENCY_CLEAR_DAYS
    expect(RECENCY_CLEAR_DAYS).toBeLessThan(59);
    const ranked = scoreRevisionCandidates({
      pool: [problem({ slug: 'old' })],
      progress: lookup({ old: { ...initialContestProgress(), solved: true, solvedOn } }),
      today: TODAY,
    });
    expect(ranked[0]!.reasons).toContain('Solved over a month ago');
  });

  it('lifts problems in a pattern the ONE weakness model flagged', () => {
    const pool = [
      problem({ slug: 'strong', aicmPatterns: ['hash-maps'] }),
      problem({ slug: 'weak', aicmPatterns: ['graphs'] }),
    ];
    const ranked = scoreRevisionCandidates({
      pool,
      progress: () => undefined,
      today: TODAY,
      weakPatterns: ['graphs'],
    });
    expect(ranked[0]!.problem.slug).toBe('weak');
    expect(ranked[0]!.reasons.some((r) => r.includes('not holding'))).toBe(true);
  });

  it('is deterministic — no clock, no randomness', () => {
    const pool = [problem({ slug: 'a' }), problem({ slug: 'b' }), problem({ slug: 'c' })];
    const once = scoreRevisionCandidates({ pool, progress: () => undefined, today: TODAY });
    const twice = scoreRevisionCandidates({ pool, progress: () => undefined, today: TODAY });
    expect(once.map((r) => r.problem.slug)).toEqual(twice.map((r) => r.problem.slug));
  });
});

describe('selectionReason — "Why this problem?"', () => {
  it('states facts, including when the pattern is unknown', () => {
    const reasons = selectionReason(
      problem({ aicmPatterns: [], mappingConfidence: 'unmapped', contestRating: 1582, contest: { slug: 'weekly-contest-300', type: 'weekly', number: 300, index: 2 } }),
      undefined,
      TODAY,
    );
    expect(reasons).toContain('Pattern mapping unavailable');
    expect(reasons).toContain('Contest rating 1582');
    expect(reasons).toContain('Weekly Contest 300 · Q2');
    expect(reasons).toContain('Not solved recently');
  });

  it('names the pattern when one was supplied', () => {
    expect(selectionReason(problem(), undefined, TODAY, 'Two Pointers')[0]).toBe('Two Pointers');
  });
});

describe('recommendBand — conservative or silent', () => {
  it('returns null below the stated minimum evidence', () => {
    expect(recommendBand({ solvedRatings: [1500, 1550], missedRatings: [] })).toBeNull();
    expect(MIN_BAND_EVIDENCE).toBeGreaterThan(2);
  });

  it('advances at most one band, never two', () => {
    const reading = recommendBand({ solvedRatings: [1450, 1500, 1520, 1560], missedRatings: [] })!;
    expect(reading).not.toBeNull();
    const comfortable = ratingBand(1520);
    const comfortableIdx = RATING_BANDS.findIndex((b) => b.id === comfortable.id);
    const recommendedIdx = RATING_BANDS.findIndex((b) => b.id === reading.band.id);
    expect(recommendedIdx - comfortableIdx).toBeLessThanOrEqual(1);
  });

  it('holds position when the evidence is mixed', () => {
    const reading = recommendBand({ solvedRatings: [1450, 1500], missedRatings: [1600, 1700] })!;
    expect(reading.statement).toContain('staying here');
  });

  it('never claims a rating for the learner — only for the problems', () => {
    const readings = [
      recommendBand({ solvedRatings: [1450, 1500, 1520, 1560], missedRatings: [] }),
      recommendBand({ solvedRatings: [1450, 1500], missedRatings: [1600, 1700] }),
      recommendBand({ solvedRatings: [], missedRatings: [1600, 1700, 1800, 1900] }),
    ];
    for (const r of readings) {
      expect(r).not.toBeNull();
      expect(r!.statement.toLowerCase()).not.toMatch(/your rating|you are rated|your level is/);
    }
  });

  it('steps down at most one band when nothing landed', () => {
    const current = ratingBand(1900);
    const reading = recommendBand({ solvedRatings: [], missedRatings: [1900, 1950, 1980, 1990] }, current)!;
    const currentIdx = RATING_BANDS.findIndex((b) => b.id === current.id);
    const recommendedIdx = RATING_BANDS.findIndex((b) => b.id === reading.band.id);
    expect(currentIdx - recommendedIdx).toBe(1);
  });

  it('reports the sample size it rests on', () => {
    const reading = recommendBand({ solvedRatings: [1450, 1500, 1520], missedRatings: [1600] })!;
    expect(reading.sampleSize).toBe(4);
  });
});

describe('bandEvidenceFromRegister — one computation behind every band surface', () => {
  const entry = (over: Partial<ContestProblemProgress>): ContestProblemProgress => ({
    ...initialContestProgress(),
    ...over,
  });
  const ratings: Record<string, number> = { a: 1450, b: 1650, c: 1850 };
  const ratingFor = (slug: string): number | undefined => ratings[slug];

  it('splits the register into solved and missed ratings; a never-attempted entry says nothing', () => {
    const evidence = bandEvidenceFromRegister(
      {
        a: entry({ solved: true, attempts: 1, solvedOn: '2026-07-01' }),
        b: entry({ attempts: 2 }),
        c: entry({}),
      },
      ratingFor,
    );
    expect(evidence.solvedRatings).toEqual([1450]);
    expect(evidence.missedRatings).toEqual([1650]);
  });

  it('orders solved ratings most recent first — the BandEvidence contract', () => {
    const evidence = bandEvidenceFromRegister(
      {
        a: entry({ solved: true, attempts: 1, solvedOn: '2026-07-01' }),
        b: entry({ solved: true, attempts: 1, solvedOn: '2026-07-20' }),
        c: entry({ solved: true, attempts: 1, solvedOn: '2026-07-10' }),
      },
      ratingFor,
    );
    expect(evidence.solvedRatings).toEqual([1650, 1850, 1450]);
  });

  it('a slug the resolver does not know is inert, never an error', () => {
    const evidence = bandEvidenceFromRegister(
      { retired: entry({ solved: true, attempts: 3, solvedOn: '2026-07-01' }) },
      ratingFor,
    );
    expect(evidence.solvedRatings).toEqual([]);
    expect(evidence.missedRatings).toEqual([]);
  });

  it('gives a self-reported solve zero band weight — an untimed tick is not contest evidence', () => {
    // The A5.1 scenario: a 2200-rated problem ticked "Mark solved" on the sheet. Counting it
    // would inflate the recommendation off work never performed under contest conditions.
    const evidence = bandEvidenceFromRegister(
      {
        a: entry({ solved: true, attempts: 1, solvedOn: '2026-07-01' }),
        hard: entry({ solved: true, attempts: 1, solvedOn: '2026-07-02', selfReported: true }),
      },
      (slug) => (slug === 'hard' ? 2200 : ratingFor(slug)),
    );
    expect(evidence.solvedRatings).toEqual([1450]);
    expect(evidence.missedRatings).toEqual([]);
  });
});

describe('contestStateFromQuestionProgress — the 207 bridge read-through', () => {
  const qp = (over: Partial<QuestionProgress> = {}) => ({
    status: 'unsolved' as QuestionProgress['status'],
    revisionStage: 0,
    nextRevision: null as string | null,
    completedAt: null as string | null,
    ...over,
  });

  it('translates a solved curriculum question into a solved contest state on the same ladder', () => {
    const state = contestStateFromQuestionProgress(
      qp({ status: 'solved', completedAt: '2026-07-20', revisionStage: 2, nextRevision: '2026-07-27' }),
    );
    expect(state.solved).toBe(true);
    expect(state.solvedOn).toBe('2026-07-20');
    expect(state.revisionStage).toBe(2);
    expect(state.nextRevision).toBe('2026-07-27');
  });

  it('attempts is a floor: worked-on registers as attempted, untouched and skipped do not', () => {
    expect(contestStateFromQuestionProgress(qp({ status: 'in_progress' })).attempts).toBe(1);
    expect(contestStateFromQuestionProgress(qp({ status: 'solved' })).attempts).toBe(1);
    expect(contestStateFromQuestionProgress(qp()).attempts).toBe(0);
    expect(contestStateFromQuestionProgress(qp({ status: 'skipped' })).attempts).toBe(0);
  });

  it('feeds the one filter predicate: a due bridged problem matches the due chip', () => {
    const state = contestStateFromQuestionProgress(
      qp({ status: 'solved', completedAt: '2026-07-20', revisionStage: 1, nextRevision: TODAY }),
    );
    const bridged = problem({ slug: 'bridged', curriculumQuestionId: 12 });
    const matches = filterContestProblems([bridged], { progress: ['due'] }, () => state, TODAY);
    expect(matches.map((p) => p.slug)).toEqual(['bridged']);
  });
});
