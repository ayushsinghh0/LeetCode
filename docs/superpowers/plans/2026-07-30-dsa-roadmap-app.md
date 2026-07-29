# DSA Roadmap App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first React SPA that drives daily DSA practice: a 539-question / 68-day roadmap (8 new questions/day), spaced-repetition revision (1/3/7/15/30-day intervals), dashboard, analytics, gamification, and every bonus feature in the approved spec.

**Architecture:** Pure-function engine in `src/utils/engine/` (all business math, fully unit-tested, no React/Redux imports; every function takes dates as ISO-string params — never calls `Date.now()` internally except the single `todayISO()` helper used only by UI/thunks). Redux Toolkit slices hold state; thunks orchestrate engine calls; memoized selectors derive all stats. A `StorageAdapter` interface + debounced middleware persists to localStorage (Supabase-swappable later). UI is lazy-loaded route pages inside a sidebar shell.

**Tech Stack:** Vite 6 · React 18 · TypeScript (strict) · TailwindCSS 3.4 · vendored shadcn/ui components (Radix primitives) · Redux Toolkit 2 · React Router 6 · React Hook Form 7 · Framer Motion 11 · Recharts 2 · react-markdown · canvas-confetti · date-fns 4 · Lucide icons · Vitest 3 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-30-dsa-roadmap-app-design.md` — read it before starting any task. All product rules (intervals, XP values, weekly top-up, streak rules) live there and are restated in-task where needed.

## Global Constraints

- React **18** (not 19). TypeScript `strict: true`. Path alias `@/` → `src/`.
- **Dataset is already committed** at `src/data/questions.json` (539 questions; regenerate only via `node scripts/generate-questions.mjs`). Never hand-edit it.
- Revision intervals: `[1, 3, 7, 15, 30]` days. Stage = number of successful passes (0–5); stage 5 = Mastered (`nextRevision: null`). Fail → stage 0, due tomorrow.
- XP: solve easy/medium/hard = 10/20/30; revision pass = 5/10/15; daily-goal bonus +25; weekly-day full clear +50. Level L→L+1 costs `100 × L` XP (cumulative to reach level n+1 = `50·n·(n+1)`).
- Default `questionsPerDay` = 8 (configurable 4–16 in Settings). Total days = `ceil(539 / perDay)` = 68 at default. Weekly Revision Day = every roadmap day divisible by 7.
- Streak = consecutive calendar days with ≥1 activity (solve OR revision), not broken until a full day passes with none. "Perfect day" = daily new-question goal met.
- Dark theme is default. All engine functions pure & deterministic (dates passed in).
- Persisted state is versioned: `{ version: 1, ... }`. UI never touches localStorage directly — only through `StorageAdapter`.
- Commit after every task (message in each task). Run `npx vitest run` before every commit; never commit failing tests.
- Windows environment: shell commands below use PowerShell-compatible syntax (`;` chaining, no `&&`).

## File Structure (final)

```
src/
  main.tsx  App.tsx  index.css  vite-env.d.ts
  data/questions.json            # committed already
  data/patterns.ts               # 28 pattern metadata (id, name, icon, color)
  data/quotes.ts                 # motivational quotes
  types/index.ts                 # all shared types
  utils/cn.ts                    # clsx + tailwind-merge
  utils/dates.ts                 # ISO date helpers
  utils/engine/spacedRepetition.ts | roadmap.ts | streak.ts | xp.ts | stats.ts
              | achievements.ts | recommendations.ts | predictor.ts | weeklyRevision.ts
  store/store.ts  hooks.ts  actions.ts  selectors.ts
  store/slices/progressSlice.ts | settingsSlice.ts | gamificationSlice.ts | uiSlice.ts
  services/storage/StorageAdapter.ts | LocalStorageAdapter.ts | persistence.ts | serialize.ts
  contexts/ThemeContext.tsx
  hooks/usePomodoro.ts  useCelebration.ts
  components/ui/*                # vendored shadcn: button, card, badge, progress, dialog,
                                 # input, textarea, select, switch, tabs, tooltip, label
  components/layout/AppShell.tsx Sidebar.tsx MobileNav.tsx PageTransition.tsx
  components/shared/StatCard.tsx ProgressRing.tsx Heatmap.tsx EmptyState.tsx SearchDialog.tsx
  components/questions/QuestionCard.tsx DifficultyBadge.tsx PatternChip.tsx RevisionStagePips.tsx
                      ConfidenceRating.tsx QuestionDetailModal.tsx NotesEditor.tsx
  components/gamification/LevelRing.tsx StreakFlame.tsx AchievementToast.tsx XpBadge.tsx
  components/charts/*            # Recharts wrappers built in Analytics task
  components/pomodoro/PomodoroWidget.tsx
  pages/DashboardPage.tsx TodayPage.tsx RoadmapPage.tsx PatternsPage.tsx PatternDetailPage.tsx
        RevisionPage.tsx CalendarPage.tsx AnalyticsPage.tsx AchievementsPage.tsx
        BookmarksPage.tsx SettingsPage.tsx FocusPage.tsx
tests mirror source: src/utils/engine/__tests__/*.test.ts, src/store/__tests__/*.test.ts, etc.
```

---

### Task 1: Project Scaffold & Tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/utils/cn.ts`, `vitest.config.ts` (merged into vite.config.ts), `src/test/setup.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npx vitest run`; `cn(...inputs)` utility; `@/` alias everywhere.

- [ ] **Step 1: Write config files exactly as below** (no `npm create vite` — the repo already has files).

`package.json`:
```json
{
  "name": "dsa-roadmap",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@reduxjs/toolkit": "^2.3.0",
    "canvas-confetti": "^1.9.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "framer-motion": "^11.11.0",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-markdown": "^9.0.1",
    "react-redux": "^9.1.2",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.13.3",
    "remark-gfm": "^4.0.0",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@types/canvas-confetti": "^1.6.4",
    "@types/node": "^22.8.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DSA Roadmap</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`tailwind.config.js` (shadcn CSS-variable convention + app extras):
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        easy: '#22c55e',
        medium: '#f59e0b',
        hard: '#ef4444'
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`.gitignore`:
```
node_modules
dist
*.local
.DS_Store
```

`src/index.css` (theme variables + glass utilities; dark is default):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 5%;
    --foreground: 226 100% 97%;
    --card: 224 40% 8%;
    --card-foreground: 226 100% 97%;
    --popover: 224 45% 7%;
    --popover-foreground: 226 100% 97%;
    --primary: 258 90% 66%;
    --primary-foreground: 0 0% 100%;
    --secondary: 224 30% 14%;
    --secondary-foreground: 226 100% 97%;
    --muted: 224 30% 14%;
    --muted-foreground: 220 15% 65%;
    --accent: 190 95% 50%;
    --accent-foreground: 222 47% 5%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 224 30% 18%;
    --input: 224 30% 18%;
    --ring: 258 90% 66%;
  }
  .light {
    --background: 226 60% 97%;
    --foreground: 224 47% 10%;
    --card: 0 0% 100%;
    --card-foreground: 224 47% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 47% 10%;
    --primary: 258 85% 58%;
    --primary-foreground: 0 0% 100%;
    --secondary: 226 40% 92%;
    --secondary-foreground: 224 47% 10%;
    --muted: 226 40% 92%;
    --muted-foreground: 224 15% 40%;
    --accent: 190 90% 42%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 226 30% 85%;
    --input: 226 30% 85%;
    --ring: 258 85% 58%;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  /* fixed gradient backdrop */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(60rem 40rem at 10% -10%, hsl(258 90% 40% / 0.25), transparent 60%),
      radial-gradient(50rem 35rem at 110% 20%, hsl(190 95% 40% / 0.18), transparent 60%),
      radial-gradient(40rem 40rem at 50% 120%, hsl(320 80% 40% / 0.12), transparent 60%);
  }
  .light body::before { opacity: 0.5; }
}

@layer components {
  .glass {
    @apply rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgb(0_0_0/0.25)];
  }
  .light .glass {
    @apply border-black/5 bg-white/70 shadow-[0_8px_32px_rgb(0_0_0/0.08)];
  }
  .text-gradient {
    @apply bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent;
  }
  .bg-accent-gradient {
    @apply bg-gradient-to-r from-violet-500 to-cyan-500;
  }
}
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/utils/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx` (placeholder, replaced in Task 12):
```tsx
export default function App() {
  return <div className="p-8 text-2xl font-bold text-gradient">DSA Roadmap</div>;
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes without errors; `package-lock.json` created.

- [ ] **Step 3: Write a scaffold smoke test**

`src/__tests__/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import App from '@/App';

test('app renders', () => {
  render(<App />);
  expect(screen.getByText(/DSA Roadmap/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Verify test passes and build works**

Run: `npx vitest run` → Expected: 1 passed.
Run: `npm run build` → Expected: `dist/` produced, zero TS errors.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: scaffold Vite + React 18 + TS + Tailwind + Vitest"
```

---

### Task 2: Types, Pattern Metadata, Dataset Validation

**Files:**
- Create: `src/types/index.ts`, `src/data/patterns.ts`, `src/data/quotes.ts`, `src/utils/dates.ts`
- Test: `src/data/__tests__/dataset.test.ts`, `src/utils/__tests__/dates.test.ts`

**Interfaces (produced — every later task depends on these exact names):**
```ts
// src/types/index.ts — copy verbatim
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'unsolved' | 'in_progress' | 'solved' | 'skipped';
export type Confidence = 1 | 2 | 3 | 4 | 5;

export type PatternId =
  | 'two-pointers' | 'fast-slow-pointers' | 'sliding-window' | 'intervals'
  | 'linked-list-inplace' | 'two-heaps' | 'k-way-merge' | 'top-k-elements'
  | 'modified-binary-search' | 'subsets' | 'greedy' | 'backtracking'
  | 'dynamic-programming' | 'cyclic-sort' | 'topological-sort' | 'sort-search'
  | 'matrices' | 'stacks' | 'graphs' | 'tree-dfs' | 'tree-bfs' | 'trie'
  | 'hash-maps' | 'tracking' | 'union-find' | 'custom-data-structures'
  | 'bitwise-manipulation' | 'math-geometry';

export interface Question {
  id: number;
  title: string;
  pattern: PatternId;
  difficulty: Difficulty;
  estimatedTime: number; // minutes
}

export interface RevisionEvent { date: string; passed: boolean }

export interface QuestionProgress {
  status: QuestionStatus;
  revisionStage: number;          // 0..5; 5 = mastered
  nextRevision: string | null;    // ISO yyyy-MM-dd
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
  notes: string;                  // markdown
  bookmarked: boolean;
  completedAt: string | null;     // ISO date
  confidence: Confidence | null;
  timeSpentMin: number;
}

export interface DayLog {
  date: string;                   // yyyy-MM-dd
  solvedIds: number[];
  revisionsPassed: number[];
  revisionsFailed: number[];
  xpEarned: number;
  focusMinutes: number;
}

export interface PatternMeta {
  id: PatternId;
  name: string;
  icon: string;                   // lucide-react icon component name
  color: string;                  // tailwind-compatible hex for charts/chips
}

export interface SettingsState {
  questionsPerDay: number;        // default 8
  revisionEnabled: boolean;       // default true
  theme: 'dark' | 'light';        // default 'dark'
  notifications: boolean;         // default false (stub)
}

export interface PersistedStateV1 {
  version: 1;
  progress: {
    byId: Record<number, QuestionProgress>;
    dayLogs: Record<string, DayLog>;
    startDate: string | null;
  };
  settings: SettingsState;
  gamification: { xp: number; unlocked: Record<string, string> }; // achievementId -> ISO date
}
```

```ts
// src/utils/dates.ts — copy verbatim
import { addDays as dfAddDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd');
export const todayISO = (): string => toISODate(new Date());
export const addDays = (iso: string, n: number): string => toISODate(dfAddDays(parseISO(iso), n));
export const diffDays = (a: string, b: string): number =>
  differenceInCalendarDays(parseISO(a), parseISO(b)); // a - b in days
```

`src/data/patterns.ts` exports `export const PATTERNS: PatternMeta[]` (28 entries, ordered as the dataset) and `export const patternById: Record<PatternId, PatternMeta>`. Names exactly: Two Pointers, Fast and Slow Pointers, Sliding Window, Intervals, In-Place Manipulation of a Linked List, Two Heaps, K-way Merge, Top K Elements, Modified Binary Search, Subsets, Greedy Techniques, Backtracking, Dynamic Programming, Cyclic Sort, Topological Sort, Sort and Search, Matrices, Stacks, Graphs, Tree Depth-First Search, Tree Breadth-First Search, Trie, Hash Maps, Knowing What to Track, Union Find, Custom Data Structures, Bitwise Manipulation, Math and Geometry. Icons: pick sensible lucide names per pattern (e.g. `ArrowLeftRight`, `Rabbit`, `PanelLeftClose`, `CalendarRange`, `Link2`, `Layers`, `GitMerge`, `Trophy`, `SearchCode`, `Boxes`, `Coins`, `Undo2`, `Braces`, `RefreshCw`, `Network`, `ArrowUpDown`, `Grid3x3`, `Layers3`, `Share2`, `TreePine`, `TreeDeciduous`, `SpellCheck`, `Hash`, `Eye`, `Combine`, `DatabaseZap`, `Binary`, `Calculator`). Colors: 28 distinct hex values cycling a violet→cyan→emerald→amber→rose spectrum.

`src/data/quotes.ts` exports `export const QUOTES: string[]` with **30 real motivational quotes** (grind/discipline themed) and `export const quoteForDate = (iso: string): string => QUOTES[[...iso].reduce((a, c) => a + c.charCodeAt(0), 0) % QUOTES.length];`

- [ ] **Step 1: Write failing dataset validation test**

`src/data/__tests__/dataset.test.ts`:
```ts
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
```

`src/utils/__tests__/dates.test.ts`:
```ts
import { addDays, diffDays, toISODate } from '@/utils/dates';

test('addDays crosses month boundaries', () => {
  expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});

test('diffDays is signed (a - b)', () => {
  expect(diffDays('2026-08-02', '2026-07-30')).toBe(3);
  expect(diffDays('2026-07-30', '2026-08-02')).toBe(-3);
});

test('toISODate formats', () => {
  expect(toISODate(new Date(2026, 6, 30))).toBe('2026-07-30');
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run` → FAIL (modules don't exist).
- [ ] **Step 3: Create `src/types/index.ts`, `src/utils/dates.ts` (verbatim above), `src/data/patterns.ts`, `src/data/quotes.ts`.**
- [ ] **Step 4: Run tests to verify all pass** — `npx vitest run` → PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: types, pattern metadata, quotes, date utils, dataset validation"`

---

### Task 3: Spaced Repetition Engine (TDD)

**Files:**
- Create: `src/utils/engine/spacedRepetition.ts`
- Test: `src/utils/engine/__tests__/spacedRepetition.test.ts`

**Interfaces:**
- Consumes: `QuestionProgress`, `addDays` (Task 2).
- Produces (exact signatures — used by slices, thunks, selectors):
```ts
export const REVISION_INTERVALS = [1, 3, 7, 15, 30] as const;
export const MASTERED_STAGE = 5;
export function initialProgress(): QuestionProgress;
export function applySolve(p: QuestionProgress, date: string): QuestionProgress;
export function applyRevision(p: QuestionProgress, date: string, passed: boolean): QuestionProgress;
export function isDue(p: QuestionProgress, today: string): boolean;   // solved, not mastered, nextRevision <= today
export function isMastered(p: QuestionProgress): boolean;
export function dueIds(byId: Record<number, QuestionProgress>, today: string): number[]; // sorted oldest nextRevision first, ties by id
```

- [ ] **Step 1: Write the failing tests** — `src/utils/engine/__tests__/spacedRepetition.test.ts`:
```ts
import {
  applyRevision, applySolve, dueIds, initialProgress, isDue, isMastered,
  MASTERED_STAGE, REVISION_INTERVALS,
} from '@/utils/engine/spacedRepetition';

const T = '2026-07-30';

test('intervals match spec', () => {
  expect([...REVISION_INTERVALS]).toEqual([1, 3, 7, 15, 30]);
});

test('initialProgress is a clean unsolved record', () => {
  const p = initialProgress();
  expect(p).toEqual({
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0,
  });
});

test('solve schedules first revision for next day', () => {
  const p = applySolve(initialProgress(), T);
  expect(p.status).toBe('solved');
  expect(p.completedAt).toBe(T);
  expect(p.revisionStage).toBe(0);
  expect(p.nextRevision).toBe('2026-07-31');
});

test('passing walks the full ladder 1→3→7→15→30 then masters', () => {
  let p = applySolve(initialProgress(), T);
  const gaps = [3, 7, 15, 30]; // gap AFTER passing stages 1..4
  let day = p.nextRevision!;
  for (let pass = 0; pass < 5; pass++) {
    p = applyRevision(p, day, true);
    if (pass < 4) {
      expect(p.revisionStage).toBe(pass + 1);
      expect(p.nextRevision).toBe(
        // next due = review day + gap for the new stage
        require('@/utils/dates').addDays(day, gaps[pass])
      );
      day = p.nextRevision!;
    }
  }
  expect(p.revisionStage).toBe(MASTERED_STAGE);
  expect(p.nextRevision).toBeNull();
  expect(isMastered(p)).toBe(true);
});

test('failing resets to stage 0, due tomorrow, and records history', () => {
  let p = applySolve(initialProgress(), T);
  p = applyRevision(p, '2026-07-31', true);   // stage 1
  p = applyRevision(p, '2026-08-03', false);  // fail
  expect(p.revisionStage).toBe(0);
  expect(p.nextRevision).toBe('2026-08-04');
  expect(p.revisionHistory).toEqual([
    { date: '2026-07-31', passed: true },
    { date: '2026-08-03', passed: false },
  ]);
  expect(p.lastReviewed).toBe('2026-08-03');
});

test('isDue: overdue counts, unsolved and mastered never due', () => {
  const solved = applySolve(initialProgress(), T);
  expect(isDue(solved, '2026-07-30')).toBe(false); // due tomorrow, not today
  expect(isDue(solved, '2026-07-31')).toBe(true);
  expect(isDue(solved, '2026-09-01')).toBe(true);  // overdue still due
  expect(isDue(initialProgress(), '2026-09-01')).toBe(false);
});

test('dueIds sorts oldest-first with id tiebreak', () => {
  const a = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02
  const b = { ...applySolve(initialProgress(), '2026-07-10') };   // due 07-11
  const c = { ...applySolve(initialProgress(), '2026-07-01') };   // due 07-02
  expect(dueIds({ 7: b, 3: a, 5: c }, '2026-07-20')).toEqual([3, 5, 7]);
});

test('applySolve/applyRevision do not mutate their input', () => {
  const p0 = initialProgress();
  applySolve(p0, T);
  expect(p0.status).toBe('unsolved');
});
```
Note: replace the `require('@/utils/dates')` line with a top-of-file `import { addDays } from '@/utils/dates';` and `addDays(day, gaps[pass])` — ESM, no require.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/engine` → FAIL (module missing).
- [ ] **Step 3: Implement** — `src/utils/engine/spacedRepetition.ts`:
```ts
import type { QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';

export const REVISION_INTERVALS = [1, 3, 7, 15, 30] as const;
export const MASTERED_STAGE = 5;

export function initialProgress(): QuestionProgress {
  return {
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0,
  };
}

export function applySolve(p: QuestionProgress, date: string): QuestionProgress {
  return {
    ...p, status: 'solved', completedAt: date, revisionStage: 0,
    nextRevision: addDays(date, REVISION_INTERVALS[0]),
  };
}

export function applyRevision(p: QuestionProgress, date: string, passed: boolean): QuestionProgress {
  const history = [...p.revisionHistory, { date, passed }];
  if (!passed) {
    return { ...p, revisionStage: 0, nextRevision: addDays(date, 1), lastReviewed: date, revisionHistory: history };
  }
  const stage = p.revisionStage + 1;
  return {
    ...p, revisionStage: stage, lastReviewed: date, revisionHistory: history,
    nextRevision: stage >= MASTERED_STAGE ? null : addDays(date, REVISION_INTERVALS[stage]),
  };
}

export const isMastered = (p: QuestionProgress) => p.revisionStage >= MASTERED_STAGE;

export function isDue(p: QuestionProgress, today: string): boolean {
  return p.status === 'solved' && !isMastered(p) && p.nextRevision !== null && p.nextRevision <= today;
}

export function dueIds(byId: Record<number, QuestionProgress>, today: string): number[] {
  return Object.entries(byId)
    .filter(([, p]) => isDue(p, today))
    .sort(([ia, a], [ib, b]) =>
      a.nextRevision! < b.nextRevision! ? -1 :
      a.nextRevision! > b.nextRevision! ? 1 : Number(ia) - Number(ib))
    .map(([id]) => Number(id));
}
```
(ISO `yyyy-MM-dd` strings compare correctly with `<=` — that's why the format is fixed.)

- [ ] **Step 4: Run tests** — `npx vitest run` → all PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: spaced repetition engine with 1/3/7/15/30 ladder"`

---

### Task 4: Roadmap Engine (TDD)

**Files:**
- Create: `src/utils/engine/roadmap.ts`
- Test: `src/utils/engine/__tests__/roadmap.test.ts`

**Interfaces:**
- Produces:
```ts
export function totalDays(totalQuestions: number, perDay: number): number;            // ceil
export function daySlice(all: Question[], day: number, perDay: number): Question[];   // 1-based day
export function dayOfQuestion(id: number, perDay: number): number;
export function currentDay(solvedNewCount: number, perDay: number, totalQuestions: number): number; // capped at totalDays
export function isWeeklyRevisionDay(day: number): boolean;                            // day % 7 === 0
export function solvePace(dayLogs: Record<string, DayLog>, today: string, windowDays?: number): number; // avg solves/day over last 14 calendar days
export function estimatedFinishDate(
  today: string, remaining: number, dayLogs: Record<string, DayLog>, perDay: number
): string; // today + ceil(remaining / max(pace, epsilon)); falls back to perDay pace when <3 active days in window
```

- [ ] **Step 1: Write the failing tests** — `src/utils/engine/__tests__/roadmap.test.ts`:
```ts
import questions from '@/data/questions.json';
import type { DayLog, Question } from '@/types';
import {
  currentDay, dayOfQuestion, daySlice, estimatedFinishDate,
  isWeeklyRevisionDay, solvePace, totalDays,
} from '@/utils/engine/roadmap';

const qs = questions as Question[];
const log = (date: string, solved: number): DayLog => ({
  date, solvedIds: Array.from({ length: solved }, (_, i) => i + 1),
  revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

test('68 days at 8/day for 539 questions; last day is short', () => {
  expect(totalDays(539, 8)).toBe(68);
  expect(daySlice(qs, 1, 8).map((q) => q.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(daySlice(qs, 68, 8).map((q) => q.id)).toEqual([537, 538, 539]);
  expect(daySlice(qs, 69, 8)).toEqual([]);
});

test('dayOfQuestion and currentDay', () => {
  expect(dayOfQuestion(1, 8)).toBe(1);
  expect(dayOfQuestion(8, 8)).toBe(1);
  expect(dayOfQuestion(9, 8)).toBe(2);
  expect(currentDay(0, 8, 539)).toBe(1);
  expect(currentDay(7, 8, 539)).toBe(1);   // day 1 not finished
  expect(currentDay(8, 8, 539)).toBe(2);
  expect(currentDay(539, 8, 539)).toBe(68); // capped, never 69
});

test('weekly revision day every 7th roadmap day', () => {
  expect(isWeeklyRevisionDay(7)).toBe(true);
  expect(isWeeklyRevisionDay(14)).toBe(true);
  expect(isWeeklyRevisionDay(8)).toBe(false);
  expect(isWeeklyRevisionDay(0)).toBe(false);
});

test('solvePace averages over the last 14 calendar days', () => {
  const logs = {
    '2026-07-29': log('2026-07-29', 8),
    '2026-07-28': log('2026-07-28', 8),
    '2026-07-20': log('2026-07-20', 12),
  };
  expect(solvePace(logs, '2026-07-30')).toBeCloseTo(28 / 14);
});

test('estimatedFinishDate uses pace, falls back to perDay with <3 active days', () => {
  // fallback: no history → 80 remaining at 8/day = 10 days out
  expect(estimatedFinishDate('2026-07-30', 80, {}, 8)).toBe('2026-08-09');
  // real pace: 28 solves in window → pace 2/day → 20 remaining = 10 days
  const logs = {
    '2026-07-27': log('2026-07-27', 10), '2026-07-25': log('2026-07-25', 10),
    '2026-07-23': log('2026-07-23', 8),
  };
  expect(estimatedFinishDate('2026-07-30', 20, logs, 8)).toBe('2026-08-09');
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run src/utils/engine` → FAIL.
- [ ] **Step 3: Implement `roadmap.ts`** — straightforward math per the signatures; `solvePace` counts `solvedIds.length` across logs whose date is within `(today-13 .. today]`, divides by 14; "active day" = a log in that window with ≥1 solve; `estimatedFinishDate` = `addDays(today, Math.ceil(remaining / pace))` where `pace = activeDays >= 3 ? solvePace(...) : perDay`, guarded `pace = Math.max(pace, 0.5)`.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: roadmap engine (day slices, pace, finish estimate)"`

---

### Task 5: Streak + XP/Level Engines (TDD)

**Files:**
- Create: `src/utils/engine/streak.ts`, `src/utils/engine/xp.ts`
- Test: `src/utils/engine/__tests__/streak.test.ts`, `src/utils/engine/__tests__/xp.test.ts`

**Interfaces:**
```ts
// streak.ts
export function hasActivity(log: DayLog | undefined): boolean; // ≥1 solve OR revision (pass or fail)
export function isPerfectDay(log: DayLog | undefined, perDay: number): boolean; // solvedIds.length >= perDay
export function computeStreaks(dayLogs: Record<string, DayLog>, today: string): { current: number; longest: number };
// current: consecutive active days ending today or yesterday (today without activity yet does NOT break it)

// xp.ts
export const SOLVE_XP: Record<Difficulty, number>; // {easy:10, medium:20, hard:30}
export const revisionXp: (d: Difficulty) => number; // half of solve
export const DAILY_GOAL_BONUS = 25;
export const WEEKLY_CLEAR_BONUS = 50;
export function levelForXp(xp: number): number;        // level 1 at 0; reach level n+1 at 50·n·(n+1)
export function levelProgress(xp: number): { level: number; intoLevel: number; needed: number };
// needed = 100 × level (incremental cost of current level)
```

- [ ] **Step 1: Write the failing tests** — key cases:
```ts
// streak.test.ts
import { computeStreaks, hasActivity, isPerfectDay } from '@/utils/engine/streak';
import type { DayLog } from '@/types';

const mk = (date: string, s = 0, r = 0): DayLog => ({
  date, solvedIds: Array.from({ length: s }, (_, i) => i + 1),
  revisionsPassed: Array.from({ length: r }, (_, i) => 100 + i),
  revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

test('revision-only days keep the streak alive', () => {
  const logs = { '2026-07-29': mk('2026-07-29', 0, 2), '2026-07-28': mk('2026-07-28', 8) };
  expect(computeStreaks(logs, '2026-07-30').current).toBe(2); // today empty ≠ broken
});

test('a gap breaks current but longest survives', () => {
  const logs = {
    '2026-07-20': mk('2026-07-20', 8), '2026-07-21': mk('2026-07-21', 8),
    '2026-07-22': mk('2026-07-22', 8), '2026-07-29': mk('2026-07-29', 8),
    '2026-07-30': mk('2026-07-30', 3),
  };
  expect(computeStreaks(logs, '2026-07-30')).toEqual({ current: 2, longest: 3 });
});

test('empty logs → zero streaks; perfect day threshold', () => {
  expect(computeStreaks({}, '2026-07-30')).toEqual({ current: 0, longest: 0 });
  expect(isPerfectDay(mk('2026-07-30', 8), 8)).toBe(true);
  expect(isPerfectDay(mk('2026-07-30', 7), 8)).toBe(false);
  expect(hasActivity(undefined)).toBe(false);
});
```
```ts
// xp.test.ts
import { DAILY_GOAL_BONUS, levelForXp, levelProgress, revisionXp, SOLVE_XP, WEEKLY_CLEAR_BONUS } from '@/utils/engine/xp';

test('xp constants per spec', () => {
  expect(SOLVE_XP).toEqual({ easy: 10, medium: 20, hard: 30 });
  expect(revisionXp('easy')).toBe(5);
  expect(revisionXp('hard')).toBe(15);
  expect(DAILY_GOAL_BONUS).toBe(25);
  expect(WEEKLY_CLEAR_BONUS).toBe(50);
});

test('quadratic level curve: thresholds 100, 300, 600, 1000', () => {
  expect(levelForXp(0)).toBe(1);
  expect(levelForXp(99)).toBe(1);
  expect(levelForXp(100)).toBe(2);
  expect(levelForXp(299)).toBe(2);
  expect(levelForXp(300)).toBe(3);
  expect(levelForXp(1000)).toBe(5);
});

test('levelProgress reports xp into current level and its cost', () => {
  expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, needed: 100 });
  expect(levelProgress(150)).toEqual({ level: 2, intoLevel: 50, needed: 200 });
  expect(levelProgress(300)).toEqual({ level: 3, intoLevel: 0, needed: 300 });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement.** `computeStreaks`: walk back day-by-day from `today` (if today inactive, start from yesterday) counting active days for `current`; for `longest`, sort active dates ascending and scan for the longest consecutive run. `levelForXp`: `let l = 1; while (xp >= 50 * l * (l + 1)) l++; return l;`. `levelProgress`: `intoLevel = xp - 50*(level-1)*level; needed = 100*level`.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: streak and XP/level engines"`

---

### Task 6: Stats Engine (TDD)

**Files:**
- Create: `src/utils/engine/stats.ts`
- Test: `src/utils/engine/__tests__/stats.test.ts`

**Interfaces:**
```ts
export interface PatternStat {
  pattern: PatternId; total: number; solved: number; mastered: number;
  inRevision: number;          // solved, not mastered
  remaining: number; pct: number;              // solved/total * 100, rounded
  avgConfidence: number | null;                // over solved with confidence set
  revisionPassRate: number | null;             // passes / attempts across histories
}
export function patternStats(all: Question[], byId: Record<number, QuestionProgress>): PatternStat[];

export interface DifficultyStat {
  difficulty: Difficulty; total: number; solved: number; pct: number;
  revisionPassRate: number | null;
}
export function difficultyStats(all: Question[], byId: Record<number, QuestionProgress>): DifficultyStat[];

export function overallRevisionPassRate(byId: Record<number, QuestionProgress>): number | null;
export function consistency(dayLogs: Record<string, DayLog>, today: string, windowDays?: number): number; // 0..1, default 14
export function goalRate(dayLogs: Record<string, DayLog>, today: string, perDay: number, windowDays?: number): number; // perfect days / window
export function productivityScore(
  dayLogs: Record<string, DayLog>, byId: Record<number, QuestionProgress>, perDay: number, today: string
): number; // round(40·consistency14 + 35·goalRate14 + 25·(passRate30 ?? 0.5)·? ) — see Step 3
export function solvedPerDaySeries(
  dayLogs: Record<string, DayLog>, today: string, days: number
): { date: string; solved: number; revisions: number }[]; // oldest→newest, zero-filled
```

- [ ] **Step 1: Write failing tests.** Build a small fixture: 6 questions across 2 patterns/3 difficulties; progress where q1 solved+2 passes 1 fail (conf 4), q2 solved mastered (conf 5), q3 unsolved. Assert:
  - `patternStats` totals/solved/mastered/inRevision/remaining/pct correct; `avgConfidence` = 4.5; `revisionPassRate` = 2/3.
  - `difficultyStats` per-difficulty solved counts and pass rates.
  - `consistency({14 logs, 7 active}, today) === 0.5`.
  - `productivityScore` returns an integer 0–100; with 100% consistency, 100% goal rate, 100% pass rate → 100; with all-empty logs → 0.
  - `solvedPerDaySeries` zero-fills missing days and is chronological, length = `days`.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement.** Productivity formula (locked): `round(100 · (0.40·consistency14 + 0.35·goalRate14 + 0.25·(overallRevisionPassRate ?? 0)))` — when there are zero revision attempts AND zero activity, score is 0; when there are no revision attempts but there IS solve activity, substitute `0.5` for the pass-rate term so early users aren't punished. Encode exactly this rule in a test.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: stats engine (patterns, difficulty, consistency, productivity)"`

---

### Task 7: Achievements Engine (TDD)

**Files:**
- Create: `src/utils/engine/achievements.ts`
- Test: `src/utils/engine/__tests__/achievements.test.ts`

**Interfaces:**
```ts
export interface AchievementCtx {
  solvedCount: number; masteredCount: number;
  streak: { current: number; longest: number };
  patternStats: PatternStat[];
  difficultyStats: DifficultyStat[];
  perfectRevisionWeek: boolean;   // last 7 calendar days: ≥1 revision attempted every day, all passed
  hadComeback: boolean;           // an active day whose previous active day is ≥4 days earlier
}
export interface AchievementDef {
  id: string; title: string; description: string; icon: string; // lucide name
  check: (ctx: AchievementCtx) => boolean;
}
export const ACHIEVEMENTS: AchievementDef[];
export function buildAchievementCtx(
  all: Question[], byId: Record<number, QuestionProgress>,
  dayLogs: Record<string, DayLog>, today: string
): AchievementCtx;
export function evaluateAchievements(ctx: AchievementCtx, unlocked: Record<string, string>): string[]; // newly earned ids
```

**Achievement list (ids locked):** `first-solve`, `solved-10`, `solved-50`, `solved-100`, `solved-250`, `solved-500`, `solved-539`, `streak-3`, `streak-7`, `streak-14`, `streak-30`, `streak-50`, `streak-68`, `pattern-100-<patternId>` (28 generated defs, title "100% <Pattern Name>"), `all-easy`, `all-medium`, `all-hard`, `perfect-revision-week`, `comeback`, `first-mastered`, `mastered-100`.

- [ ] **Step 1: Write failing tests.** Assert: total count = 48 (20 fixed + 28 pattern-generated); `evaluateAchievements` returns only NEW ids (already-unlocked excluded); ctx with solvedCount 100 unlocks `solved-10/50/100` + `first-solve` in one call; `pattern-100-two-pointers` unlocks when that pattern's pct is 100; `buildAchievementCtx` computes `perfectRevisionWeek` true only when each of the last 7 days has ≥1 attempt and zero fails, and `hadComeback` from a ≥4-day gap between active days.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** — checks are one-liners over ctx; generate the 28 pattern defs by mapping `PATTERNS`.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: achievements engine (49 achievements)"`

---

### Task 8: Recommendations, Predictor, Weekly Top-Up (TDD)

**Files:**
- Create: `src/utils/engine/recommendations.ts`, `src/utils/engine/predictor.ts`, `src/utils/engine/weeklyRevision.ts`
- Test: one test file per module under `src/utils/engine/__tests__/`

**Interfaces:**
```ts
// recommendations.ts
export interface WeakPattern { pattern: PatternId; score: number } // lower = weaker
export function weakestPatterns(stats: PatternStat[], minAttempts?: number): WeakPattern[];
// score = 0.4·(revisionPassRate ?? 1) + 0.4·((avgConfidence ?? 3)/5) + 0.2·(pct/100);
// only patterns with ≥ minAttempts (default 3) revision attempts OR ≥3 solved; sorted ascending (weakest first)

export interface Recommendation { kind: 'revision' | 'weak-pattern' | 'new'; questionIds: number[]; reason: string }
export interface Recommender {
  recommend(args: {
    all: Question[]; byId: Record<number, QuestionProgress>;
    due: number[]; todaysNew: number[]; weakest: WeakPattern[];
  }): Recommendation[];
}
export class HeuristicRecommender implements Recommender { /* deterministic: due first (reason mentions overdue count), then up to 3 unsolved from the weakest pattern, then today's new slice */ }

export function seededRandomQuestion(all: Question[], seed: string): Question;
// deterministic: mulberry32 over a string hash of `seed` (use date string) → index

// predictor.ts
export function revisionLoadForecast(
  byId: Record<number, QuestionProgress>, today: string, horizonDays?: number, // default 30
  expectedNewPerDay?: number // default 0; each future new solve adds a stage-0 review next day
): { date: string; count: number }[];
// simulate: every non-mastered solved question's future reviews assuming passes on due dates;
// overdue items count on tomorrow; plus expectedNewPerDay chain contributions

// weeklyRevision.ts
export function weeklyTopUp(
  all: Question[], byId: Record<number, QuestionProgress>, due: number[],
  today: string, min?: number, max?: number   // defaults 15, 20
): number[];
// returns EXTRA ids (excluding due + mastered + unsolved), ranked by:
// confidence asc (null = 2.5) → fail count desc → lastReviewed asc (null = completedAt) → id asc;
// count = clamp(min - due.length … max - due.length, 0, ∞) capped by pool size
```

- [ ] **Step 1: Write failing tests.** Cover: weakest sorting + minAttempts exclusion; `HeuristicRecommender` ordering and reasons non-empty; `seededRandomQuestion` deterministic for same seed / different across seeds; forecast counts an overdue item tomorrow and a stage-1 item on its due date, horizon length exact; `weeklyTopUp` returns 15−due…20−due items, never due/mastered/unsolved, deterministic order, and `[]` when due ≥ 20.
- [ ] **Step 2: Verify failure.**  
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: recommendation, forecast, weekly top-up engines"`

---

### Task 9: Redux Store — Slices, Thunks, Selectors (TDD)

**Files:**
- Create: `src/store/store.ts`, `src/store/hooks.ts`, `src/store/slices/progressSlice.ts`, `src/store/slices/settingsSlice.ts`, `src/store/slices/gamificationSlice.ts`, `src/store/slices/uiSlice.ts`, `src/store/actions.ts`, `src/store/selectors.ts`
- Test: `src/store/__tests__/actions.test.ts`, `src/store/__tests__/selectors.test.ts`

**Interfaces:**
- Consumes: every engine module (Tasks 3–8), types (Task 2).
- Produces:
```ts
// store.ts
export function makeStore(preloaded?: Partial<RootState>, extraMiddleware?: Middleware[]): AppStore; // extra middleware used by persistence (Task 10)
export type RootState; export type AppDispatch; export type AppStore;
export type AppThunk = ThunkAction<void, RootState, unknown, UnknownAction>; // from '@reduxjs/toolkit'
// hooks.ts
export const useAppDispatch: () => AppDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState>;

// progressSlice state: { byId: Record<number, QuestionProgress>; dayLogs: Record<string, DayLog>; startDate: string | null }
// reducers (all take ISO date in payload — thunks supply it):
//   questionStarted{id}, questionSolved{id, date, xp}, questionSkipped{id}, bookmarkToggled{id},
//   notesSet{id, notes}, confidenceSet{id, confidence}, revisionLogged{id, date, passed, xp},
//   focusMinutesAdded{date, minutes}, timeSpentAdded{id, minutes}, stateImported(PersistedStateV1), progressReset()
// questionSolved: byId[id] = applySolve(byId[id] ?? initialProgress(), date); ensures dayLogs[date], pushes id
//   into solvedIds (idempotent — ignore if already present), adds xp to dayLog.xpEarned; sets startDate if null.
// revisionLogged: applyRevision + push into revisionsPassed/Failed + xp into dayLog.

// settingsSlice: SettingsState + settingsUpdated(Partial<SettingsState>), stateImported, progressReset (resets to defaults? NO —
//   progressReset keeps settings; only stateImported overwrites them).

// gamificationSlice state: { xp: number; unlocked: Record<string, string> }
//   reducers: xpAdded(number), achievementsUnlocked{ids: string[], date}, stateImported, progressReset.

// uiSlice state: { focusMode: boolean; activeQuestionId: number | null; celebration: 'confetti' | 'fireworks' | null;
//   searchOpen: boolean; toastQueue: string[] /* achievement ids */ }
//   reducers: focusModeSet, activeQuestionSet, celebrationShown(null clears), searchOpenSet, toastPushed(ids), toastPopped.

// actions.ts — exported thunks (THE public mutation API; UI must use these, never raw slice actions):
export const solveQuestion: (id: number) => AppThunk;
export const reviseQuestion: (id: number, passed: boolean) => AppThunk;
export const skipQuestion: (id: number) => AppThunk;
export const startQuestion: (id: number) => AppThunk;
export const toggleBookmark: (id: number) => AppThunk;
export const saveNotes: (id: number, notes: string) => AppThunk;
export const setConfidence: (id: number, confidence: Confidence) => AppThunk;
export const logFocusSession: (minutes: number) => AppThunk;
export const importProgress: (state: PersistedStateV1) => AppThunk;
export const resetProgress: () => AppThunk;
// solveQuestion: reads difficulty from static dataset; xp = SOLVE_XP[difficulty]; dispatches questionSolved;
//   if today's solvedIds count crosses questionsPerDay exactly → xpAdded(DAILY_GOAL_BONUS) + celebration 'confetti';
//   if pattern completion hits 100% → celebration 'fireworks';
//   then evaluates achievements (buildAchievementCtx + evaluateAchievements) → achievementsUnlocked + toastPushed.
// reviseQuestion: revisionXp; on weekly day, if this clears ALL due+topup → xpAdded(WEEKLY_CLEAR_BONUS);
//   then achievements evaluation (streaks/perfect-week can trigger).

// selectors.ts — memoized (createSelector), all take RootState:
export const selectQuestions: () => Question[];                    // static import, identity
export const selectQuestionById: (id) => Question | undefined;
export const selectPerDay, selectSolvedNewCount, selectCurrentDay, selectTotalDays,
  selectTodaysNewQuestions,      // daySlice(currentDay) filtered to unsolved-or-in-progress + already-solved-today ids for display
  selectDueRevisionIds, selectIsWeeklyDay, selectWeeklyTopUpIds, selectRevisionQueueIds, // due + topup on weekly days
  selectPatternStats, selectDifficultyStats, selectStreaks, selectLevelInfo,
  selectHeatmapData,             // last 365 days: {date, count: solved+revisions, level: 0..4}
  selectEstimatedFinish, selectProductivityScore, selectWeakestPatterns,
  selectForecast, selectBookmarkedIds, selectTodayLog, selectAchievementCtx;
```

- [ ] **Step 1: Write failing thunk tests** (the critical flows — use `makeStore()` fresh per test; mock nothing, use real engine; freeze "today" by passing a date: thunks read date via `todayISO()` — to keep tests deterministic use `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))`):
```ts
// actions.test.ts — assertions to include:
// 1. solveQuestion(1): progress.byId[1].status === 'solved'; dayLog for today has [1]; gamification.xp === 10 (q1 is easy).
// 2. solving 8 questions (ids 1–8): xp includes DAILY_GOAL_BONUS once; ui.celebration === 'confetti';
//    solving a 9th does NOT re-award the bonus.
// 3. reviseQuestion pass then fail: revisionStage transitions 1 then 0; xp adds revisionXp each attempt.
// 4. achievements: after solveQuestion(1), gamification.unlocked has 'first-solve'; ui.toastQueue includes it.
// 5. resetProgress: byId/dayLogs/xp/unlocked cleared; settings survive.
// 6. importProgress(fixture): state replaced wholesale; selectSolvedNewCount reflects fixture.
// 7. selectors: selectCurrentDay advances after 8 solves; selectTodaysNewQuestions returns day-2 slice afterwards;
//    selectHeatmapData returns 365 entries with today's count correct.
```
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement slices → actions → selectors.** Keep reducers dumb (call engine, no cross-slice reads). `makeStore` wires `preloadedState` and accepts `extraMiddleware: Middleware[]` param (empty for now).
- [ ] **Step 4: Run tests** — PASS (all suites).
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: redux store, thunks, memoized selectors"`

---

### Task 10: Persistence — StorageAdapter, Middleware, Export/Import (TDD)

**Files:**
- Create: `src/services/storage/StorageAdapter.ts`, `src/services/storage/LocalStorageAdapter.ts`, `src/services/storage/serialize.ts`, `src/services/storage/persistence.ts`
- Modify: `src/store/store.ts` (accept persistence middleware), `src/main.tsx` (hydrate before render)
- Test: `src/services/storage/__tests__/persistence.test.ts`

**Interfaces:**
```ts
// StorageAdapter.ts
export interface StorageAdapter {
  load(): PersistedStateV1 | null;      // sync is fine for localStorage; Supabase adapter would wrap async elsewhere
  save(state: PersistedStateV1): void;
}
// LocalStorageAdapter.ts — key 'dsa-roadmap:v1'; JSON parse errors → null (corrupt data never crashes boot).
// serialize.ts
export function selectPersistedState(root: RootState): PersistedStateV1;
export function validatePersisted(raw: unknown): PersistedStateV1 | null; // structural check incl. version === 1
export function exportAsJson(root: RootState): string;                    // pretty-printed
// persistence.ts
export function createPersistenceMiddleware(adapter: StorageAdapter, debounceMs?: number): Middleware; // default 500
export function loadInitialState(adapter: StorageAdapter): Partial<RootState> | undefined; // maps PersistedStateV1 → slice shapes
```

- [ ] **Step 1: Write failing tests:** middleware saves after a dispatched thunk (use fake timers to flush debounce); round-trip: `makeStore` → solve 3 → save → new store via `loadInitialState` → selectors agree; `validatePersisted` rejects `version: 2`, missing keys, non-object; corrupt localStorage JSON → `load()` returns null.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement; wire into `main.tsx`:** create adapter → `loadInitialState` → `makeStore(preloaded, [createPersistenceMiddleware(adapter)])` → `<Provider store={store}>`.
- [ ] **Step 4: Run tests + `npm run build`** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: localStorage persistence behind StorageAdapter seam"`

---

### Task 11: Theme Context + Vendored UI Primitives

**Files:**
- Create: `src/contexts/ThemeContext.tsx`, `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `progress.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `switch.tsx`, `tabs.tsx`, `tooltip.tsx`, `label.tsx`
- Test: `src/components/ui/__tests__/primitives.test.tsx` (render smoke tests)

**Interfaces:**
- `ThemeProvider` + `useTheme(): { theme: 'dark' | 'light'; toggle(): void }` — reads initial theme from settings slice, applies `document.documentElement.classList` (`dark` class present by default from index.html; light mode swaps to `light` class), and dispatches `settingsUpdated({theme})` on toggle.
- UI components: **vendor the standard shadcn/ui (Radix + cva) implementations verbatim** — public canonical code, adjusted only for the `@/utils/cn` import path. Exact exports required: `Button` (+`buttonVariants`; variants: default/secondary/ghost/outline/destructive; sizes: default/sm/lg/icon), `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter`, `Badge` (+`badgeVariants`), `Progress`, `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`, `Input`, `Textarea`, `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`, `Switch`, `Tabs, TabsList, TabsTrigger, TabsContent`, `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`, `Label`.

- [ ] **Step 1: Write smoke tests** — render Button/Card/Badge/Progress/Input, assert visible text & no crash; Dialog opens on trigger click (userEvent).
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Vendor the components + write ThemeContext.**
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: theme context and shadcn-style UI primitives"`

---

### Task 12: App Shell — Router, Sidebar, Lazy Pages

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `PageTransition.tsx`; all 12 page files as minimal placeholders (`<h1>` + TODO-free stub content); replace `src/App.tsx`
- Test: `src/components/layout/__tests__/shell.test.tsx`

**Interfaces:**
- Routes (exact paths): `/` Dashboard · `/today` · `/roadmap` · `/patterns` · `/patterns/:patternId` · `/revision` · `/calendar` · `/analytics` · `/achievements` · `/bookmarks` · `/settings` · `/focus` (focus mode, rendered WITHOUT sidebar chrome).
- `App.tsx`: `Provider` (store) → `ThemeProvider` → `TooltipProvider` → `BrowserRouter` → `AppShell` with `React.lazy` + `Suspense` (glass skeleton fallback) per page.
- Sidebar: nav items with lucide icons (LayoutDashboard, CalendarCheck, Map, Shapes, RotateCcw, CalendarDays, BarChart3, Trophy, Bookmark, Settings); active state = accent-gradient pill; collapsed icon-rail below `lg`; `MobileNav` bottom bar (5 primary items + "More" sheet) below `md`. Sidebar footer shows LevelRing mini + streak flame (wired in Task 15; stub with static numbers now).
- `PageTransition`: `framer-motion` `AnimatePresence` wrapper keyed by pathname — fade/slide 150ms.

- [ ] **Step 1: Write failing tests** — render App inside `MemoryRouter` (export `AppRoutes` separately so tests can mount without `BrowserRouter`); assert sidebar renders all 10 nav labels; navigating to `/today` shows the Today placeholder heading.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement shell + placeholders.**
- [ ] **Step 4: Run tests + `npm run dev` visual check** — sidebar, gradient background, glass look, dark theme.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: app shell with sidebar, lazy routes, page transitions"`

---

### Task 13: Question Components + Detail Modal + Notes

**Files:**
- Create: `src/components/questions/DifficultyBadge.tsx`, `PatternChip.tsx`, `RevisionStagePips.tsx`, `ConfidenceRating.tsx`, `QuestionCard.tsx`, `NotesEditor.tsx`, `QuestionDetailModal.tsx`
- Test: `src/components/questions/__tests__/questionCard.test.tsx`

**Interfaces:**
```ts
// QuestionCard props
interface QuestionCardProps {
  question: Question;
  progress: QuestionProgress;        // pass initialProgress() for untouched
  context?: 'today' | 'revision' | 'browse';  // controls which action buttons show
  onOpenDetail: (id: number) => void;
}
// today: Start / Solved / Need Revision / Skip / Bookmark buttons; revision: Pass / Fail / Bookmark; browse: status badge only.
// "Need Revision" = solved-but-shaky: dispatches solveQuestion(id) THEN setConfidence(id, 2) — it enters the
// normal revision ladder (due tomorrow) but is flagged low-confidence so weekly top-up and weak-pattern
// scoring prioritize it. Test this compound dispatch in Step 1.
// Card shows: title, DifficultyBadge (colored easy/medium/hard), PatternChip (icon+name), RevisionStagePips
// (5 pips, filled = passed stages, gold when mastered), status, estimated time (Clock icon + "25 min"),
// notes indicator (FileText icon when notes non-empty), confidence dots.
// All mutations go through store/actions.ts thunks. framer-motion: whileHover lift + layout animation.
```
- `ConfidenceRating`: 5 dots, click sets via `setConfidence` thunk.
- `NotesEditor`: React Hook Form (`useForm<{notes: string}>`) + Tabs (Write / Preview); Preview renders `react-markdown` + `remark-gfm` (code blocks, links, images, tables). Save button dispatches `saveNotes`; autosave on blur.
- `QuestionDetailModal`: Dialog controlled by `ui.activeQuestionId` (`activeQuestionSet` action); shows everything: full metadata, status controls for its context, ConfidenceRating, NotesEditor, revision history timeline (list of `RevisionEvent` with pass/fail icons + dates), bookmark toggle. Mount ONCE in AppShell.

- [ ] **Step 1: Write failing tests** — QuestionCard renders title/difficulty/pattern/time; clicking Solved dispatches (assert via store state change on a real `makeStore` + Provider); revision context shows Pass/Fail; notes indicator appears when progress.notes set.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement components.**
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: question cards, detail modal, markdown notes"`

---

### Task 14: Today Page + Celebrations

**Files:**
- Create: `src/hooks/useCelebration.ts`; replace `src/pages/TodayPage.tsx`
- Test: `src/pages/__tests__/today.test.tsx`

**Interfaces:**
- Consumes: `selectTodaysNewQuestions`, `selectRevisionQueueIds`, `selectIsWeeklyDay`, `selectTodayLog`, `selectPerDay`, thunks, `QuestionCard`.
- `useCelebration`: subscribes to `ui.celebration`; fires `canvas-confetti` — 'confetti' = single burst; 'fireworks' = 3 staggered bursts; then dispatches `celebrationShown(null)`. Mounted once in AppShell.

**Layout:** header "Day X of 68" + date + weekly-day banner (accent gradient, Sparkles icon, "Weekly Revision Day — N revisions queued") when `selectIsWeeklyDay`; progress bar `solvedToday / perDay` (animated Progress); section "New Questions" = grid of QuestionCards (context 'today'); section "Revision Due" = revision queue cards (context 'revision') with overdue amber badge (days overdue via `diffDays`); empty states (EmptyState component: icon + message) when goal done ("Crushed it — come back tomorrow") / no revisions.

- [ ] **Step 1: Write failing tests** — fresh store: Today shows 8 cards, ids 1–8; after `solveQuestion(1)` card 1 shows solved state and progress bar text "1 / 8"; store with due revision fixtures lists them under "Revision Due".
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + manual dev check (solve 8 → confetti fires).**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: today page with revision queue and confetti"`

---

### Task 15: Gamification Components + Dashboard

**Files:**
- Create: `src/components/shared/StatCard.tsx`, `ProgressRing.tsx`, `Heatmap.tsx`, `EmptyState.tsx`; `src/components/gamification/LevelRing.tsx`, `StreakFlame.tsx`, `XpBadge.tsx`; replace `src/pages/DashboardPage.tsx`; wire real LevelRing/StreakFlame into Sidebar footer
- Test: `src/pages/__tests__/dashboard.test.tsx`, `src/components/shared/__tests__/heatmap.test.tsx`

**Interfaces:**
```ts
// ProgressRing: { value: number; max: number; size?: number; strokeWidth?: number; children?: ReactNode }
//   SVG circle, animated stroke-dashoffset via framer-motion, accent gradient stroke.
// Heatmap: { data: { date: string; count: number; level: 0|1|2|3|4 }[]; onSelectDate?: (date: string) => void }
//   GitHub-style: 53×7 CSS grid, tooltip per cell "N activities on <date>", violet intensity scale.
// StatCard: { label: string; value: string | number; icon: LucideIcon; sub?: string; accent?: boolean }
// StreakFlame: { current: number } — Flame icon, framer-motion pulse when ≥3, gray when 0.
// LevelRing: ProgressRing of levelProgress() with level number centered.
```
**Dashboard layout (grid, all `glass` cards, staggered `framer-motion` entrance):** Row 1 hero: "Day X of 68" + today's date + quote (`quoteForDate(today)`) + current-position line: PatternChip + DifficultyBadge of the first unsolved question in today's slice ("You're in: Two Pointers · medium") | StreakFlame + current/longest | LevelRing + XpBadge. Row 2 StatCards: Solved (n/539), Remaining, Completion % (ProgressRing), Revisions Due Today, Estimated Finish (date), Productivity Score. Row 3: Today's progress mini-bar + "Go to Today" button (Link) | Weakest pattern card (name, pct, "Practice this" links to `/patterns/:id`) | Smart recommendation panel (HeuristicRecommender output: top 3 reasons + question titles, click → opens detail modal). Row 4: full-width Heatmap (365 days, `selectHeatmapData`, cell click → `/calendar`). Also "Random interview question" dice button in the hero → opens seededRandomQuestion(today) in detail modal.

- [ ] **Step 1: Write failing tests** — heatmap renders 365 cells with correct level classes from fixture; dashboard (fresh store) shows "Day 1", "0 / 539", quote text present; after solving 8 via thunks, shows "Day 2" and updated solved count.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + dev check.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: dashboard with heatmap, streak, level ring, recommendations"`

---

### Task 16: Roadmap Page

**Files:** replace `src/pages/RoadmapPage.tsx`; Test: `src/pages/__tests__/roadmap.test.tsx`

**Layout:** vertical timeline of all 68 days (virtualize NOT needed — 68 rows is fine). Each row: day number node on a gradient spine (green `CheckCircle2` = every question in slice solved; blue pulsing ring = current day; gray = future), day's pattern name(s) (from slice), difficulty dot summary (e.g. 3 easy · 4 med · 1 hard), solved x/8 mini progress, weekly-day `Sparkles` marker on multiples of 7. Row click expands (framer-motion `layout`) inline list of that day's questions (compact rows: title, DifficultyBadge, status icon; click → detail modal). Current day auto-scrolls into view on mount (`scrollIntoView` in effect).

- [ ] **Step 1: Write failing tests** — 68 rows render; day 1 marked current on fresh store; after solving ids 1–8 day 1 shows complete and day 2 current; expanding day 2 lists ids 9–16 titles.
- [ ] **Step 2: Verify failure.** — **Step 3: Implement.** — **Step 4: Tests PASS + dev check.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: roadmap timeline page"`

---

### Task 17: Patterns + Pattern Detail Pages

**Files:** replace `src/pages/PatternsPage.tsx`, `src/pages/PatternDetailPage.tsx`; Test: `src/pages/__tests__/patterns.test.tsx`

**PatternsPage:** responsive grid of 28 cards (staggered entrance). Card: pattern icon (lucide, pattern color), name, "34 Questions", solved / in-revision / mastered / remaining counts, animated Progress bar (pct), avg confidence dots. Click → `/patterns/:patternId`. Sort toggle: dataset order | completion % | weakest first (uses `weakestPatterns`).
**PatternDetailPage:** header (icon, name, big ProgressRing, difficulty breakdown chips) + filter row (status: all/solved/unsolved/needs-revision/bookmarked; difficulty) + list of QuestionCards (context 'browse') for the pattern. Invalid `:patternId` → EmptyState with back link.

- [ ] **Step 1: Write failing tests** — 28 cards with correct counts ("34 Questions" on two-pointers); detail page for `two-pointers` lists 34 rows; filter to solved shows only solved fixtures; invalid id shows empty state.
- [ ] **Step 2–4: TDD cycle as above.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: patterns grid and pattern detail with filters"`

---

### Task 18: Revision Page

**Files:** replace `src/pages/RevisionPage.tsx`; Test: `src/pages/__tests__/revision.test.tsx`

**Layout:** three Tabs: **Due Today** (revision queue incl. weekly top-up, QuestionCards context 'revision', overdue badges, count in tab label) · **Upcoming** (next 30 days grouped by date from `selectForecast` — date header + expected count + the actual scheduled questions for that date) · **Mastered** (grid of mastered questions, gold Award icon). Header stats: due now, passed this week, overall pass rate, mastered count. Weekly-day banner reused from Today.

- [ ] **Step 1: Write failing tests** — due fixture appears in Due tab with overdue badge; Pass click advances stage in store; Upcoming groups by forecast dates; Mastered tab lists stage-5 fixtures.
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: revision center with forecast and mastered list"`

---

### Task 19: Calendar Page

**Files:** replace `src/pages/CalendarPage.tsx`; Test: `src/pages/__tests__/calendar.test.tsx`

**Layout:** month grid (date-fns `startOfMonth`/`eachDayOfInterval`; weeks as rows; prev/next month chevrons + "Today" button). Each day cell: date number, activity dot intensity (same scale as heatmap), perfect-day ring, future dates dimmed. Click day → Dialog: that date's DayLog — solved questions (titles via dataset lookup), revisions passed/failed (titles + icons), XP earned, focus minutes; EmptyState when no log. Month summary footer: active days, solves, revisions, XP.

- [ ] **Step 1: Write failing tests** — renders current month with correct day count; fixture log on a date shows intensity + dialog lists solved titles and XP; empty date shows empty state.
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: calendar with per-day detail dialog"`

---

### Task 20: Analytics Page (charts)

> **IMPORTANT:** Before writing ANY chart code in this task, invoke the `dataviz` skill and follow its guidance (form, palette, axes, tooltips). Charts must read correctly in both themes.

**Files:** create `src/components/charts/SolvedPerDayChart.tsx`, `PatternCompletionChart.tsx`, `DifficultyChart.tsx`, `RevisionRateChart.tsx`, `ForecastChart.tsx`; replace `src/pages/AnalyticsPage.tsx`; Test: `src/pages/__tests__/analytics.test.tsx`

**Content (all Recharts, wrapped in `ResponsiveContainer`, glass cards):** Solved per day — 30-day bar chart (solved + revisions stacked) from `solvedPerDaySeries`. Pattern completion — horizontal bars, 28 patterns, pct fill (pattern colors). Difficulty — three stat blocks with rings (completion) + pass-rate bars. Revision success rate — overall % + per-stage breakdown if attempts exist. Strong/weak patterns — top 3 / bottom 3 lists from `weakestPatterns` (inverted for strong). Consistency + streaks — current, longest, active days/14, productivity score. Forecast — 30-day revision-load area chart. Header: Tabs for range where it applies (30/90/all).

- [ ] **Step 1: Write failing tests** — page renders all section headings from a seeded store; solved-per-day receives zero-filled series (assert via rendered bar count or accessible labels).
- [ ] **Step 2–4: TDD cycle (load dataviz skill BEFORE implementing).**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: analytics dashboard with charts"`

---

### Task 21: Achievements Page + Unlock Toasts

**Files:** create `src/components/gamification/AchievementToast.tsx` (mount in AppShell); replace `src/pages/AchievementsPage.tsx`; Test: `src/pages/__tests__/achievements.test.tsx`

**Page:** header (unlocked X / 48, ProgressRing) + grid of all 48 achievements: unlocked = full color + unlock date; locked = grayscale/dimmed + Lock icon; grouped sections (Progress, Streaks, Patterns, Mastery, Special). **Toast:** watches `ui.toastQueue`; renders framer-motion slide-in card (icon, "Achievement unlocked!", title) bottom-right, auto-dismiss 4s → `toastPopped`; queue drains one at a time.

- [ ] **Step 1: Write failing tests** — 48 cards; fixture unlocked shows date & locked shows lock; pushing toast id renders card then store queue drains (fake timers).
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: achievements gallery and unlock toasts"`

---

### Task 22: Search + Bookmarks

**Files:** create `src/components/shared/SearchDialog.tsx` (mount in AppShell; Ctrl/Cmd+K + Sidebar search button); replace `src/pages/BookmarksPage.tsx`; Test: `src/components/shared/__tests__/search.test.tsx`

**SearchDialog:** Dialog with autofocused Input; live results (case-insensitive substring on title) + filter chips: difficulty (easy/med/hard), status (solved/unsolved/needs-revision/bookmarked), pattern (Select). Result rows: title, DifficultyBadge, PatternChip, status icon; click → close + open detail modal. Filter logic in a pure helper `filterQuestions(all, byId, {query, difficulty?, status?, pattern?}): Question[]` exported from `src/utils/filterQuestions.ts` — unit-test THIS directly (needs-revision = solved && due-or-overdue; bookmarked from progress).
**BookmarksPage:** all bookmarked QuestionCards (context 'browse') + same filter row; EmptyState with hint when none.

- [ ] **Step 1: Write failing tests** — `filterQuestions` covers query/difficulty/status/pattern combos; dialog opens on hotkey, typing "3Sum" shows one result; bookmarks page lists bookmarked fixtures.
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: global search (Ctrl+K) and bookmarks page"`

---

### Task 23: Settings Page

**Files:** replace `src/pages/SettingsPage.tsx`; Test: `src/pages/__tests__/settings.test.tsx`

**Form (React Hook Form `useForm<SettingsState>`, values from store, `settingsUpdated` on submit; Save button disabled until dirty):** questionsPerDay (Select 4–16, help text shows recomputed total days `ceil(539/n)`), revisionEnabled (Switch — when off, Today/Revision hide revision queues; selectors already respect it via `selectRevisionQueueIds` returning `[]` — add that guard in Task 9's selector now if missed), theme (Switch dark/light wired to ThemeContext), notifications (Switch, stub with "coming soon" note). **Danger zone (separate card):** Export progress (downloads `dsa-roadmap-backup-<date>.json` via `exportAsJson` + Blob URL) · Import (file input → `validatePersisted` → confirm Dialog showing summary "X solved, Y XP" → `importProgress`; invalid file → destructive error text) · Reset (Dialog requiring typed "RESET" before `resetProgress`).

- [ ] **Step 1: Write failing tests** — changing perDay updates store + total-days help text; reset requires exact confirmation text; import of invalid JSON shows error and does NOT dispatch.
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: settings with export/import/reset"`

---

### Task 24: Pomodoro + Focus Mode

**Files:** create `src/hooks/usePomodoro.ts`, `src/components/pomodoro/PomodoroWidget.tsx`; replace `src/pages/FocusPage.tsx`; Test: `src/hooks/__tests__/usePomodoro.test.ts`

**Interfaces:**
```ts
// uiSlice additions (add in this task): pomodoro: { phase: 'idle' | 'focus' | 'break'; endsAt: number | null; focusLenMin: number; breakLenMin: number }
// usePomodoro(): { phase, remainingSec, start(), pause(), skip(), reset(), focusLenMin, setLengths(f, b) }
// Completing a focus phase dispatches logFocusSession(focusLenMin) (→ DayLog.focusMinutes) and auto-starts break.
```
**PomodoroWidget:** floating bottom-right glass pill (all pages except `/focus` embeds it inline, larger): mm:ss countdown ring, phase color (violet focus / cyan break), start/pause/skip. Timer computed from `endsAt` timestamp (survives refresh via… `ui` isn't persisted — acceptable: timer resets on refresh; document this in code comment).
**FocusPage (`/focus`):** distraction-free — no sidebar (Task 12 already routes it bare): centered current question (first unsolved of today's slice, else first due revision), big title, pattern/difficulty, Solved / Need Revision / Skip buttons, inline notes textarea, embedded Pomodoro, Exit button (→ `/today`). Entering via "Focus mode" button on Today page header.

- [ ] **Step 1: Write failing tests** — fake timers: start() → remainingSec ticks down; focus completion dispatches logFocusSession and phase becomes 'break'; skip() ends phase.
- [ ] **Step 2–4: TDD cycle.**
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: pomodoro timer and distraction-free focus mode"`

---

### Task 25: Final Polish, Vercel Config, README, Release Check

**Files:** create `vercel.json`, `README.md`; touch-ups across pages.

- [ ] **Step 1: `vercel.json`:**
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
- [ ] **Step 2: README.md** — project intro, screenshots section (placeholder-free: describe features in text), `npm install / npm run dev / npm run build / npm test`, deploy-to-Vercel steps, data model summary, "how revision scheduling works" table, roadmap for v2 (Supabase adapter, real AI recommender).
- [ ] **Step 3: Responsive audit** — dev-server pass at 375px, 768px, 1280px: no horizontal scroll, mobile bottom nav works, dialogs fit, heatmap scrolls horizontally in its own container on mobile. Fix what's broken.
- [ ] **Step 4: Full verification** — `npx vitest run` (ALL suites green) then `npm run build` (zero TS errors), then `npm run preview` smoke: dashboard → solve flow → refresh persists → export file downloads → import restores → light theme readable.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "chore: vercel config, README, responsive polish — v1.0"`

---

## Self-Review Notes (kept for executors)

- Task 9's `selectRevisionQueueIds` must return `[]` when `settings.revisionEnabled` is false — this is asserted again in Task 23's tests.
- Task 3's test file: use the top-of-file `import { addDays } from '@/utils/dates'` (ESM) — the inline `require` shown in the draft block is called out and must not be copied.
- `PersistedStateV1.progress.byId` only stores TOUCHED questions (sparse map) — `initialProgress()` is the implicit default for missing ids everywhere (selectors must use `byId[id] ?? initialProgress()`).
- Celebration rule: confetti fires when today's solve count crosses `questionsPerDay` exactly (not on every solve past it); fireworks when a pattern reaches 100% — both asserted in Task 9 tests.
- `daySlice` is static (fixed id ranges); `selectTodaysNewQuestions` = slice of `currentDay` — solved items in the slice still render (as completed cards) until the day advances.
