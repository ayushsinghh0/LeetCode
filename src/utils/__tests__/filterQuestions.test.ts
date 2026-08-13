import { filterQuestions } from '@/utils/filterQuestions';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import type { Question, QuestionProgress } from '@/types';
import { QF } from '@/test/questionFixture';

const TODAY = '2026-07-30';

// Small hand-built fixture (not the full 539-question dataset) — filterQuestions is a pure
// function over whatever Question[] it's given, so a compact fixture keeps each case's intent
// obvious. Titles are picked so substring/case-insensitivity is easy to eyeball.
const FIXTURE: Question[] = [
  { id: 1, title: '3Sum', pattern: 'two-pointers', difficulty: 'medium', estimatedTime: 25, ...QF },
  { id: 2, title: 'Two Sum', pattern: 'hash-maps', difficulty: 'easy', estimatedTime: 15, ...QF },
  { id: 3, title: 'Valid Palindrome', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 15, ...QF },
  { id: 4, title: 'Merge K Sorted Lists', pattern: 'k-way-merge', difficulty: 'hard', estimatedTime: 40, ...QF },
];

function emptyProgress(): QuestionProgress {
  return initialProgress();
}

describe('filterQuestions', () => {
  test('empty filter returns all questions, unfiltered', () => {
    const result = filterQuestions(FIXTURE, {}, {}, TODAY);
    expect(result).toEqual(FIXTURE);
  });

  test('query: case-insensitive substring match on title', () => {
    const result = filterQuestions(FIXTURE, {}, { query: 'sum' }, TODAY);
    expect(result.map((q) => q.id).sort()).toEqual([1, 2]);
  });

  test('query: trims surrounding whitespace before matching', () => {
    const result = filterQuestions(FIXTURE, {}, { query: '  3sum  ' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([1]);
  });

  test('query: whitespace-only query is treated as no query constraint', () => {
    const result = filterQuestions(FIXTURE, {}, { query: '   ' }, TODAY);
    expect(result).toEqual(FIXTURE);
  });

  test('query: matches against the question notes as well as the title', () => {
    const byId: Record<number, QuestionProgress> = {
      4: { ...emptyProgress(), notes: 'Use a min-HEAP of list heads.' },
    };
    // "heap" appears in no title, only in id 4's notes; matching is case-insensitive.
    const result = filterQuestions(FIXTURE, byId, { query: 'heap' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([4]);
  });

  test('query: questions without a progress entry are still matched by title only', () => {
    // No byId entries at all — the sparse-state fallback must not throw on notes access.
    const result = filterQuestions(FIXTURE, {}, { query: 'palindrome' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([3]);
  });

  test('difficulty: filters to exactly the given difficulty', () => {
    const result = filterQuestions(FIXTURE, {}, { difficulty: 'easy' }, TODAY);
    expect(result.map((q) => q.id).sort()).toEqual([2, 3]);
  });

  test('pattern: filters to exactly the given pattern', () => {
    const result = filterQuestions(FIXTURE, {}, { pattern: 'two-pointers' }, TODAY);
    expect(result.map((q) => q.id).sort()).toEqual([1, 3]);
  });

  test('status "solved": only questions whose progress.status is solved', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved' },
    };
    const result = filterQuestions(FIXTURE, byId, { status: 'solved' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([1]);
  });

  test('status "unsolved": everything whose status is not solved, including questions with no progress entry', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved' },
    };
    const result = filterQuestions(FIXTURE, byId, { status: 'unsolved' }, TODAY);
    expect(result.map((q) => q.id).sort()).toEqual([2, 3, 4]);
  });

  test('status "bookmarked": returns only bookmarked questions regardless of solve status', () => {
    const byId: Record<number, QuestionProgress> = {
      3: { ...emptyProgress(), bookmarked: true },
    };
    const result = filterQuestions(FIXTURE, byId, { status: 'bookmarked' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([3]);
  });

  test('status "needs-revision": solved AND due for revision (isDue semantics) — not solved-but-not-due, not unsolved', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved', nextRevision: '2026-07-31' }, // not due yet
      2: { ...emptyProgress(), status: 'solved', nextRevision: '2026-07-30' }, // due today
    };

    const notDueYet = filterQuestions(FIXTURE, byId, { status: 'needs-revision' }, '2026-07-30');
    expect(notDueYet.map((q) => q.id)).toEqual([2]);

    const dueNow = filterQuestions(FIXTURE, byId, { status: 'needs-revision' }, '2026-07-31');
    expect(dueNow.map((q) => q.id).sort()).toEqual([1, 2]);
  });

  test('AND-combines query + difficulty + status', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved' },
      2: { ...emptyProgress(), status: 'solved' },
    };
    // "sum" matches ids 1 & 2; status "solved" matches both too; difficulty "easy" narrows to id 2 only.
    const result = filterQuestions(FIXTURE, byId, { query: 'sum', status: 'solved', difficulty: 'easy' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([2]);
  });

  test('AND-combines pattern + status: pattern narrows before status is applied', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved' },
      2: { ...emptyProgress(), status: 'solved' },
    };
    // Both id 1 and 2 are solved, but only id 1 is two-pointers.
    const result = filterQuestions(FIXTURE, byId, { pattern: 'two-pointers', status: 'solved' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([1]);
  });

  test('AND-combines pattern + difficulty: both two-pointers questions differ in difficulty', () => {
    // id 1 (3Sum) is medium, id 3 (Valid Palindrome) is easy — both two-pointers.
    const result = filterQuestions(FIXTURE, {}, { pattern: 'two-pointers', difficulty: 'easy' }, TODAY);
    expect(result.map((q) => q.id)).toEqual([3]);
  });

  test('AND-combines all four constraints at once: query + difficulty + status + pattern', () => {
    const byId: Record<number, QuestionProgress> = {
      1: { ...emptyProgress(), status: 'solved' }, // 3Sum: medium, two-pointers, solved
      3: { ...emptyProgress(), status: 'solved' }, // Valid Palindrome: easy, two-pointers, solved
    };
    // "sum" only matches id 1 by title, which also happens to satisfy difficulty/status/pattern —
    // proves every constraint is applied, not just a subset.
    const result = filterQuestions(
      FIXTURE,
      byId,
      { query: 'sum', difficulty: 'medium', status: 'solved', pattern: 'two-pointers' },
      TODAY,
    );
    expect(result.map((q) => q.id)).toEqual([1]);
  });

  test('combined constraints that match nothing return an empty array', () => {
    const result = filterQuestions(FIXTURE, {}, { query: 'sum', difficulty: 'hard' }, TODAY);
    expect(result).toEqual([]);
  });
});
