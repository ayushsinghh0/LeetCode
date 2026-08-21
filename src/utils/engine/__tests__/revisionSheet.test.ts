import { describe, expect, it } from 'vitest';
import {
  selectSheetRevision,
  sheetEntry,
  sheetStats,
  type SheetResolvers,
} from '@/utils/engine/revisionSheet';
import { WEAK_PATTERN_REASON } from '@/utils/engine/contestLibrary';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { QF } from '@/test/questionFixture';
import type {
  ContestLibraryProblem,
  ContestProblemProgress,
  Question,
  QuestionProgress,
  SheetOnlyProblem,
  SheetRow,
  SheetRowRef,
} from '@/types';

const TODAY = '2026-07-30';

/* --- fixtures ------------------------------------------------------------------------------ */

const row = (ref: SheetRowRef, over: Partial<Omit<SheetRow, 'ref'>> = {}): SheetRow => ({
  topicIndex: 0,
  topic: 'Binary Search',
  subtopicIndex: 0,
  subtopic: 'Introductory Problems',
  order: 0,
  ref,
  ...over,
});

const question = (id: number, over: Partial<Question> = {}): Question => ({
  id,
  title: `Question ${id}`,
  pattern: 'two-pointers',
  difficulty: 'easy',
  estimatedTime: 10,
  ...QF,
  url: `https://leetcode.com/problems/question-${id}/`,
  leetcodeId: 9000 + id,
  ...over,
});

const libraryProblem = (
  slug: string,
  over: Partial<ContestLibraryProblem> = {},
): ContestLibraryProblem => ({
  slug,
  frontendId: 100,
  title: `Library ${slug}`,
  url: `https://leetcode.com/problems/${slug}/`,
  officialDifficulty: 'medium',
  contestRating: 1500,
  contest: { slug: 'weekly-contest-300', type: 'weekly', number: 300, index: 2 },
  leetcodeTopics: ['Array'],
  aicmPatterns: ['sliding-window'],
  inferredPatterns: [],
  aicmSubpatterns: [],
  mappingConfidence: 'exact',
  premium: false,
  curriculumQuestionId: null,
  ...over,
});

const sheetOnly = (slug: string, over: Partial<SheetOnlyProblem> = {}): SheetOnlyProblem => ({
  slug,
  frontendId: 1,
  title: `Sheet ${slug}`,
  url: `https://leetcode.com/problems/${slug}/`,
  officialDifficulty: 'easy',
  premium: false,
  leetcodeTopics: ['Array'],
  aicmPatterns: ['hash-maps'],
  inferredPatterns: [],
  mappingConfidence: 'exact',
  ...over,
});

const slugProgress = (over: Partial<ContestProblemProgress> = {}): ContestProblemProgress => ({
  solved: false,
  attempts: 0,
  lastAttemptedOn: null,
  solvedOn: null,
  revisionStage: 0,
  nextRevision: null,
  lastReviewed: null,
  revisionHistory: [],
  ...over,
});

function resolvers(input: {
  questions?: Question[];
  library?: ContestLibraryProblem[];
  questionStates?: Record<number, QuestionProgress>;
  slugStates?: Record<string, ContestProblemProgress>;
}): SheetResolvers {
  const byId = new Map((input.questions ?? []).map((q) => [q.id, q]));
  const bySlug = new Map((input.library ?? []).map((p) => [p.slug, p]));
  return {
    questionById: (id) => byId.get(id),
    libraryBySlug: (slug) => bySlug.get(slug),
    questionState: (id) => input.questionStates?.[id],
    slugState: (slug) => input.slugStates?.[slug],
  };
}

/* --- sheetEntry ---------------------------------------------------------------------------- */

describe('sheetEntry', () => {
  it('resolves a curriculum row through the question, keyed q<id>, onRoadmap, unrated', () => {
    const q = question(105, { title: 'Merge Sorted Array', difficulty: 'easy' });
    const entry = sheetEntry(
      row({ kind: 'curriculum', questionId: 105 }),
      resolvers({
        questions: [q],
        questionStates: {
          105: { ...initialProgress(), status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29', revisionStage: 2 },
        },
      }),
      TODAY,
    )!;
    expect(entry.identity).toBe('q105');
    expect(entry.title).toBe('Merge Sorted Array');
    expect(entry.url).toBe(q.url);
    expect(entry.onRoadmap).toBe(true);
    expect(entry.questionId).toBe(105);
    expect(entry.contestRating).toBeNull();
    expect(entry.patterns).toEqual(['two-pointers']);
    expect(entry.status).toBe('due');
  });

  it('resolves a library row with its rating and slug identity', () => {
    const entry = sheetEntry(
      row({ kind: 'library', slug: 'lib-a' }),
      resolvers({ library: [libraryProblem('lib-a')] }),
      TODAY,
    )!;
    expect(entry.identity).toBe('lib-a');
    expect(entry.contestRating).toBe(1500);
    expect(entry.onRoadmap).toBe(false);
    expect(entry.questionId).toBeNull();
    expect(entry.status).toBe('untouched');
  });

  it('resolves a sheet-only row from its own metadata, honestly unrated', () => {
    const entry = sheetEntry(
      row({ kind: 'sheet', problem: sheetOnly('two-sum', { frontendId: 1, title: 'Two Sum' }) }),
      resolvers({ slugStates: { 'two-sum': slugProgress({ attempts: 2, lastAttemptedOn: '2026-07-20' }) } }),
      TODAY,
    )!;
    expect(entry.identity).toBe('two-sum');
    expect(entry.title).toBe('Two Sum');
    expect(entry.contestRating).toBeNull();
    expect(entry.status).toBe('attempted');
  });

  it('gives external and ambiguous rows no identity, no url, no status', () => {
    const external = sheetEntry(
      row({ kind: 'external', title: 'Pongal Bunk', difficulty: 'medium', platform: 'Codeforces' }),
      resolvers({}),
      TODAY,
    )!;
    expect(external.identity).toBeNull();
    expect(external.url).toBeNull();
    expect(external.status).toBeNull();
    expect(external.platform).toBe('Codeforces');

    const ambiguous = sheetEntry(
      row({ kind: 'ambiguous', title: 'Beautiful Numbers', difficulty: 'hard', note: 'Could be either.' }),
      resolvers({}),
      TODAY,
    )!;
    expect(ambiguous.identity).toBeNull();
    expect(ambiguous.url).toBeNull();
    expect(ambiguous.status).toBeNull();
  });

  it('returns null for a dangling reference instead of inventing an entry', () => {
    expect(sheetEntry(row({ kind: 'curriculum', questionId: 999 }), resolvers({}), TODAY)).toBeNull();
    expect(sheetEntry(row({ kind: 'library', slug: 'gone' }), resolvers({}), TODAY)).toBeNull();
  });
});

/* --- sheetStats ---------------------------------------------------------------------------- */

describe('sheetStats', () => {
  it('counts unique problems, not rows', () => {
    const lib = libraryProblem('lib-a');
    const rows = [
      row({ kind: 'library', slug: 'lib-a' }),
      // The same problem under a second sub-topic — one problem, one count.
      row({ kind: 'library', slug: 'lib-a' }, { subtopicIndex: 1, subtopic: 'Another' }),
      row({ kind: 'sheet', problem: sheetOnly('sheet-b') }),
      row({ kind: 'curriculum', questionId: 7 }),
      row({ kind: 'external', title: 'Ext', difficulty: null, platform: 'CSES' }),
      row({ kind: 'external', title: 'Ext', difficulty: null, platform: 'CSES' }),
    ];
    const stats = sheetStats(
      rows,
      resolvers({
        questions: [question(7)],
        library: [lib],
        slugStates: {
          'lib-a': slugProgress({ solved: true, solvedOn: '2026-07-01', nextRevision: '2026-07-29', revisionStage: 1, attempts: 1 }),
        },
      }),
      TODAY,
    );
    expect(stats.tracked).toBe(3);
    expect(stats.untracked).toBe(1);
    expect(stats.total).toBe(4);
    expect(stats.solved).toBe(1);
    expect(stats.due).toBe(1);
    expect(stats.onRoadmap).toBe(1);
  });
});

/* --- selectSheetRevision ------------------------------------------------------------------- */

describe('selectSheetRevision', () => {
  const mixedRows = () => [
    row({ kind: 'curriculum', questionId: 7 }),
    row({ kind: 'library', slug: 'lib-a' }),
    row({ kind: 'sheet', problem: sheetOnly('sheet-b') }),
    row({ kind: 'external', title: 'Ext', difficulty: null, platform: 'CSES' }),
    row({ kind: 'ambiguous', title: 'Amb', difficulty: null, note: 'note' }),
  ];
  const mixedResolvers = () =>
    resolvers({
      questions: [question(7)],
      library: [libraryProblem('lib-a')],
      questionStates: {
        7: { ...initialProgress(), status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-29', revisionStage: 2 },
      },
    });

  it('CRITICAL: never admits a roadmap problem by default — the structural exclusion', () => {
    const ranked = selectSheetRevision({ rows: mixedRows(), resolvers: mixedResolvers(), today: TODAY });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.some((s) => s.entry.onRoadmap)).toBe(false);
    // The due roadmap question would have been the top pick — its absence must be structural.
    expect(ranked.some((s) => s.entry.identity === 'q7')).toBe(false);
  });

  it('admits roadmap problems only on request, and says so', () => {
    const ranked = selectSheetRevision({
      rows: mixedRows(),
      resolvers: mixedResolvers(),
      today: TODAY,
      includeRoadmap: true,
    });
    const roadmap = ranked.find((s) => s.entry.identity === 'q7');
    expect(roadmap).toBeDefined();
    expect(roadmap!.reasons).toContain('On your roadmap');
    // Due beats unsolved: retention outranks acquisition, via the shared core.
    expect(ranked[0]!.entry.identity).toBe('q7');
  });

  it('never selects external or ambiguous rows, and never gives them a URL', () => {
    const ranked = selectSheetRevision({
      rows: mixedRows(),
      resolvers: mixedResolvers(),
      today: TODAY,
      includeRoadmap: true,
    });
    for (const s of ranked) {
      expect(s.entry.identity).not.toBeNull();
      expect(['external', 'ambiguous']).not.toContain(s.entry.row.ref.kind);
    }
  });

  it('scores a problem once however many sub-topics list it, keeping the first row', () => {
    const rows = [
      row({ kind: 'library', slug: 'lib-a' }, { subtopic: 'First', subtopicIndex: 0 }),
      row({ kind: 'library', slug: 'lib-a' }, { subtopic: 'Second', subtopicIndex: 1 }),
    ];
    const ranked = selectSheetRevision({
      rows,
      resolvers: resolvers({ library: [libraryProblem('lib-a')] }),
      today: TODAY,
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.entry.row.subtopic).toBe('First');
  });

  it('ranks a due library problem above an unsolved one', () => {
    const ranked = selectSheetRevision({
      rows: [
        row({ kind: 'library', slug: 'fresh' }),
        row({ kind: 'library', slug: 'due' }),
      ],
      resolvers: resolvers({
        library: [libraryProblem('fresh'), libraryProblem('due')],
        slugStates: {
          due: slugProgress({ solved: true, solvedOn: '2026-07-01', nextRevision: '2026-07-28', revisionStage: 1, attempts: 1 }),
        },
      }),
      today: TODAY,
    });
    expect(ranked[0]!.entry.identity).toBe('due');
    expect(ranked[0]!.reasons.join(' ')).toContain('Due for revision');
  });

  it('carries the one weakness sentence through the shared core', () => {
    const ranked = selectSheetRevision({
      rows: [row({ kind: 'sheet', problem: sheetOnly('weak-one', { aicmPatterns: ['hash-maps'] }) })],
      resolvers: resolvers({}),
      today: TODAY,
      weakPatterns: ['hash-maps'],
    });
    expect(ranked[0]!.reasons).toContain(WEAK_PATTERN_REASON);
  });

  it('is deterministic, and sorts unrated after rated within a difficulty tie', () => {
    const rows = [
      row({ kind: 'sheet', problem: sheetOnly('unrated-z', { officialDifficulty: 'medium' }) }),
      row({ kind: 'library', slug: 'rated-a' }),
    ];
    const res = resolvers({
      library: [libraryProblem('rated-a', { aicmPatterns: ['hash-maps'] })],
    });
    const first = selectSheetRevision({ rows, resolvers: res, today: TODAY });
    const second = selectSheetRevision({ rows, resolvers: res, today: TODAY });
    expect(first.map((s) => s.entry.identity)).toEqual(second.map((s) => s.entry.identity));
    // Same score (both unsolved, exact-mapped, medium): the rated one leads, null sorts last.
    expect(first.map((s) => s.entry.identity)).toEqual(['rated-a', 'unrated-z']);
  });
});
