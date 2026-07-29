import type { PatternId, PatternMeta } from '@/types';

export const PATTERNS: PatternMeta[] = [
  { id: 'two-pointers', name: 'Two Pointers', icon: 'ArrowLeftRight', color: '#8b5cf6' },
  { id: 'fast-slow-pointers', name: 'Fast and Slow Pointers', icon: 'Rabbit', color: '#a855f7' },
  { id: 'sliding-window', name: 'Sliding Window', icon: 'PanelLeftClose', color: '#3b82f6' },
  { id: 'intervals', name: 'Intervals', icon: 'CalendarRange', color: '#06b6d4' },
  { id: 'linked-list-inplace', name: 'In-Place Manipulation of a Linked List', icon: 'Link2', color: '#14b8a6' },
  { id: 'two-heaps', name: 'Two Heaps', icon: 'Layers', color: '#10b981' },
  { id: 'k-way-merge', name: 'K-way Merge', icon: 'GitMerge', color: '#f59e0b' },
  { id: 'top-k-elements', name: 'Top K Elements', icon: 'Trophy', color: '#f97316' },
  { id: 'modified-binary-search', name: 'Modified Binary Search', icon: 'SearchCode', color: '#f43f5e' },
  { id: 'subsets', name: 'Subsets', icon: 'Boxes', color: '#ec4899' },
  { id: 'greedy', name: 'Greedy Techniques', icon: 'Coins', color: '#7c3aed' },
  { id: 'backtracking', name: 'Backtracking', icon: 'Undo2', color: '#9333ea' },
  { id: 'dynamic-programming', name: 'Dynamic Programming', icon: 'Braces', color: '#2563eb' },
  { id: 'cyclic-sort', name: 'Cyclic Sort', icon: 'RefreshCw', color: '#0891b2' },
  { id: 'topological-sort', name: 'Topological Sort', icon: 'Network', color: '#0d9488' },
  { id: 'sort-search', name: 'Sort and Search', icon: 'ArrowUpDown', color: '#059669' },
  { id: 'matrices', name: 'Matrices', icon: 'Grid3x3', color: '#d97706' },
  { id: 'stacks', name: 'Stacks', icon: 'Layers3', color: '#ea580c' },
  { id: 'graphs', name: 'Graphs', icon: 'Share2', color: '#e11d48' },
  { id: 'tree-dfs', name: 'Tree Depth-First Search', icon: 'TreePine', color: '#db2777' },
  { id: 'tree-bfs', name: 'Tree Breadth-First Search', icon: 'TreeDeciduous', color: '#a78bfa' },
  { id: 'trie', name: 'Trie', icon: 'SpellCheck', color: '#c084fc' },
  { id: 'hash-maps', name: 'Hash Maps', icon: 'Hash', color: '#60a5fa' },
  { id: 'tracking', name: 'Knowing What to Track', icon: 'Eye', color: '#22d3ee' },
  { id: 'union-find', name: 'Union Find', icon: 'Combine', color: '#2dd4bf' },
  { id: 'custom-data-structures', name: 'Custom Data Structures', icon: 'DatabaseZap', color: '#34d399' },
  { id: 'bitwise-manipulation', name: 'Bitwise Manipulation', icon: 'Binary', color: '#fbbf24' },
  { id: 'math-geometry', name: 'Math and Geometry', icon: 'Calculator', color: '#fb923c' },
];

export const patternById: Record<PatternId, PatternMeta> = PATTERNS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PatternId, PatternMeta>,
);
