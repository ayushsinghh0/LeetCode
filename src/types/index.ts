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
  // Verified external identity, present on the 528 questions with an exact LeetCode
  // counterpart (resolved against the committed catalog snapshot by the generator —
  // see scripts/generate-questions.mjs). Absent for Educative/Grokking originals.
  url?: string;
  leetcodeId?: number;
  premium?: boolean; // LeetCode paywalled problem — link works, content needs a subscription
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
  notifications: boolean;         // default false
  dailyCapacityMin: number;       // default 180 — study minutes the daily plan budgets against
}

// --- Daily execution layer -------------------------------------------------------------
// Lightweight, learning-adjacent tasks (a project milestone, a follow-up email, an admin
// errand) that share the day with roadmap/course work in the Today plan. Deliberately NOT a
// project-management system: no assignees, no subtasks, no recurring rules.

export type TaskCategory = 'study' | 'project' | 'communication' | 'admin';

export interface DailyTask {
  id: string;                 // stable "t<N>" — never derived from title or date
  title: string;
  category: TaskCategory;
  date: string;               // yyyy-MM-dd the task belongs to
  done: boolean;
  completedOn: string | null; // stamped when done flips true
  estMinutes: number | null;  // explicit user estimate; null = use the plan's default
  notes: string;
}

export interface TasksState {
  byId: Record<string, DailyTask>; // sparse like every other map — reads must tolerate absence
}

// AI/ML course track (100xDevs cohort). A core week has two sessions — day 1 lecture,
// day 2 practice; optional extras use day 1 only. Dates are ISO yyyy-MM-dd, stamped when
// the session was marked done. Cleared core weeks climb the same 1/3/7/15/30 review ladder
// as questions (stage 5 = retained, nextRevision null); extras never enter the ladder.
export interface CourseWeekProgress {
  day1DoneOn: string | null;
  day2DoneOn: string | null;
  notes: string; // markdown, like QuestionProgress.notes
  revisionStage: number; // 0..5; 5 = retained
  nextRevision: string | null;
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
}

export interface CourseState {
  byWeekId: Record<string, CourseWeekProgress>; // sparse — only touched weeks exist
}

export interface PersistedStateV1 {
  version: 1;
  progress: {
    byId: Record<number, QuestionProgress>;
    dayLogs: Record<string, DayLog>;
    startDate: string | null;
  };
  // dailyCapacityMin is optional in persisted payloads (predates the daily plan; the load
  // boundary defaults it to 180) but always present in the live store.
  settings: Omit<SettingsState, 'dailyCapacityMin'> & { dailyCapacityMin?: number };
  // unlocked: achievementId -> ISO date. The two bonus markers gate the daily-goal (+25) and
  // weekly-clear (+50) bonuses to once per day / once per roadmap week; optional so payloads
  // saved before they shipped keep validating (absent -> null).
  gamification: {
    xp: number;
    unlocked: Record<string, string>;
    dailyGoalBonusDate?: string | null;   // ISO date the +25 daily bonus last fired
    weeklyClearBonusDay?: number | null;  // roadmap day the +50 weekly bonus last fired
  };
  // Optional so pre-course backups (and older stored payloads) keep validating/loading.
  course?: CourseState;
  // Optional for the same reason — payloads saved before the daily execution layer shipped.
  tasks?: TasksState;
}
