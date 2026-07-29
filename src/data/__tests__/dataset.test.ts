import questions from '@/data/questions.json';
import { PATTERNS, patternById } from '@/data/patterns';
import type { Question } from '@/types';

const qs = questions as Question[];

test('dataset has exactly 539 questions with sequential ids', () => {
  expect(qs).toHaveLength(539);
  qs.forEach((q, i) => expect(q.id).toBe(i + 1));
});

test('per-pattern counts match the approved spec', () => {
  const counts: Record<string, number> = {};
  qs.forEach((q) => (counts[q.pattern] = (counts[q.pattern] ?? 0) + 1));
  expect(counts).toEqual({
    'two-pointers': 34, 'fast-slow-pointers': 10, 'sliding-window': 23, intervals: 11,
    'linked-list-inplace': 14, 'two-heaps': 12, 'k-way-merge': 7, 'top-k-elements': 18,
    'modified-binary-search': 24, subsets: 8, greedy: 24, backtracking: 20,
    'dynamic-programming': 41, 'cyclic-sort': 6, 'topological-sort': 12, 'sort-search': 19,
    matrices: 20, stacks: 20, graphs: 18, 'tree-dfs': 22, 'tree-bfs': 14, trie: 15,
    'hash-maps': 32, tracking: 24, 'union-find': 14, 'custom-data-structures': 16,
    'bitwise-manipulation': 18, 'math-geometry': 43,
  });
});

test('difficulty distribution and estimatedTime mapping', () => {
  const est = { easy: 15, medium: 25, hard: 40 } as const;
  qs.forEach((q) => expect(q.estimatedTime).toBe(est[q.difficulty]));
  const byDiff: Record<string, number> = {};
  qs.forEach((q) => (byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1));
  expect(byDiff).toEqual({ easy: 131, medium: 268, hard: 140 });
});

test('PATTERNS covers all 28 patterns in dataset order', () => {
  expect(PATTERNS).toHaveLength(28);
  const seen = [...new Set(qs.map((q) => q.pattern))];
  expect(PATTERNS.map((p) => p.id)).toEqual(seen);
  PATTERNS.forEach((p) => expect(patternById[p.id]).toBe(p));
});
