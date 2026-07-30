import type { PatternId, PatternMeta } from '@/types';

/* 28 editorial inks: one continuous warm-biased wheel (ink blue → moss → ochre →
   clay → plum → back to blue), saturation ~35-45%, midtone lightness so every
   chip and chart mark reads on both the lamplight and paper grounds. */
export const PATTERNS: PatternMeta[] = [
  { id: 'two-pointers', name: 'Two Pointers', icon: 'ArrowLeftRight', color: '#5b7fb0' },
  { id: 'fast-slow-pointers', name: 'Fast and Slow Pointers', icon: 'Rabbit', color: '#6b8fa8' },
  { id: 'sliding-window', name: 'Sliding Window', icon: 'PanelLeftClose', color: '#4f8a8b' },
  { id: 'intervals', name: 'Intervals', icon: 'CalendarRange', color: '#5d9178' },
  { id: 'linked-list-inplace', name: 'In-Place Manipulation of a Linked List', icon: 'Link2', color: '#6f9455' },
  { id: 'two-heaps', name: 'Two Heaps', icon: 'Layers', color: '#8a9a4e' },
  { id: 'k-way-merge', name: 'K-way Merge', icon: 'GitMerge', color: '#a89a3d' },
  { id: 'top-k-elements', name: 'Top K Elements', icon: 'Trophy', color: '#b98a2e' },
  { id: 'modified-binary-search', name: 'Modified Binary Search', icon: 'SearchCode', color: '#c07f45' },
  { id: 'subsets', name: 'Subsets', icon: 'Boxes', color: '#b8703f' },
  { id: 'greedy', name: 'Greedy Techniques', icon: 'Coins', color: '#b55f3a' },
  { id: 'backtracking', name: 'Backtracking', icon: 'Undo2', color: '#ad4f36' },
  { id: 'dynamic-programming', name: 'Dynamic Programming', icon: 'Braces', color: '#a34a4a' },
  { id: 'cyclic-sort', name: 'Cyclic Sort', icon: 'RefreshCw', color: '#a04f63' },
  { id: 'topological-sort', name: 'Topological Sort', icon: 'Network', color: '#94537a' },
  { id: 'sort-search', name: 'Sort and Search', icon: 'ArrowUpDown', color: '#7f568c' },
  { id: 'matrices', name: 'Matrices', icon: 'Grid3x3', color: '#6b5b99' },
  { id: 'stacks', name: 'Stacks', icon: 'Layers3', color: '#5c63a3' },
  { id: 'graphs', name: 'Graphs', icon: 'Share2', color: '#4a6fa5' },
  { id: 'tree-dfs', name: 'Tree Depth-First Search', icon: 'TreePine', color: '#48789c' },
  { id: 'tree-bfs', name: 'Tree Breadth-First Search', icon: 'TreeDeciduous', color: '#4e8496' },
  { id: 'trie', name: 'Trie', icon: 'SpellCheck', color: '#578f83' },
  { id: 'hash-maps', name: 'Hash Maps', icon: 'Hash', color: '#659366' },
  { id: 'tracking', name: 'Knowing What to Track', icon: 'Eye', color: '#7c9159' },
  { id: 'union-find', name: 'Union Find', icon: 'Combine', color: '#99924a' },
  { id: 'custom-data-structures', name: 'Custom Data Structures', icon: 'DatabaseZap', color: '#ab8340' },
  { id: 'bitwise-manipulation', name: 'Bitwise Manipulation', icon: 'Binary', color: '#b0713b' },
  { id: 'math-geometry', name: 'Math and Geometry', icon: 'Calculator', color: '#a85a44' },
];

export const patternById: Record<PatternId, PatternMeta> = PATTERNS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PatternId, PatternMeta>,
);
