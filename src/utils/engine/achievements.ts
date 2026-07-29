import { PATTERNS } from '@/data/patterns';
import type { DayLog, Difficulty, Question, QuestionProgress } from '@/types';
import { addDays, diffDays } from '@/utils/dates';
import { isMastered } from '@/utils/engine/spacedRepetition';
import { difficultyStats, patternStats, type DifficultyStat, type PatternStat } from '@/utils/engine/stats';
import { computeStreaks, hasActivity } from '@/utils/engine/streak';

const PERFECT_REVISION_WINDOW_DAYS = 7;
const COMEBACK_GAP_DAYS = 4;

export interface AchievementCtx {
  solvedCount: number;
  masteredCount: number;
  streak: { current: number; longest: number };
  patternStats: PatternStat[];
  difficultyStats: DifficultyStat[];
  perfectRevisionWeek: boolean; // last 7 calendar days: >=1 revision attempted every day, all passed
  hadComeback: boolean;         // an active day whose previous active day is >=4 days earlier
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide-react component name
  check: (ctx: AchievementCtx) => boolean;
}

const solvedAtLeast = (n: number) => (ctx: AchievementCtx): boolean => ctx.solvedCount >= n;
const masteredAtLeast = (n: number) => (ctx: AchievementCtx): boolean => ctx.masteredCount >= n;
const streakAtLeast = (n: number) => (ctx: AchievementCtx): boolean => ctx.streak.longest >= n;

const allSolvedFor = (difficulty: Difficulty) => (ctx: AchievementCtx): boolean => {
  const stat = ctx.difficultyStats.find((s) => s.difficulty === difficulty);
  return !!stat && stat.solved === stat.total;
};

const FIXED_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-solve', title: 'First Blood', description: 'Solve your first question.',
    icon: 'Sparkles', check: solvedAtLeast(1),
  },
  {
    id: 'solved-10', title: 'Getting Started', description: 'Solve 10 questions.',
    icon: 'Footprints', check: solvedAtLeast(10),
  },
  {
    id: 'solved-50', title: 'Half Century', description: 'Solve 50 questions.',
    icon: 'Medal', check: solvedAtLeast(50),
  },
  {
    id: 'solved-100', title: 'Century Club', description: 'Solve 100 questions.',
    icon: 'Award', check: solvedAtLeast(100),
  },
  {
    id: 'solved-250', title: 'Quarter Master', description: 'Solve 250 questions.',
    icon: 'Trophy', check: solvedAtLeast(250),
  },
  {
    id: 'solved-500', title: '500 Strong', description: 'Solve 500 questions.',
    icon: 'Crown', check: solvedAtLeast(500),
  },
  {
    id: 'solved-539', title: 'Completionist', description: 'Solve every question in the roadmap.',
    icon: 'Gem', check: solvedAtLeast(539),
  },
  {
    id: 'streak-3', title: 'Warming Up', description: 'Reach a 3-day streak.',
    icon: 'Flame', check: streakAtLeast(3),
  },
  {
    id: 'streak-7', title: 'One Week Strong', description: 'Reach a 7-day streak.',
    icon: 'CalendarCheck', check: streakAtLeast(7),
  },
  {
    id: 'streak-14', title: 'Two Weeks In', description: 'Reach a 14-day streak.',
    icon: 'CalendarClock', check: streakAtLeast(14),
  },
  {
    id: 'streak-30', title: 'Monthly Grind', description: 'Reach a 30-day streak.',
    icon: 'Rocket', check: streakAtLeast(30),
  },
  {
    id: 'streak-50', title: 'Unstoppable', description: 'Reach a 50-day streak.',
    icon: 'Zap', check: streakAtLeast(50),
  },
  {
    id: 'streak-68', title: 'Iron Will',
    description: 'Reach a 68-day streak, the length of the full roadmap.',
    icon: 'Swords', check: streakAtLeast(68),
  },
  {
    id: 'all-easy', title: 'Easy Does It', description: 'Solve every Easy question.',
    icon: 'Target', check: allSolvedFor('easy'),
  },
  {
    id: 'all-medium', title: 'Medium Mastery', description: 'Solve every Medium question.',
    icon: 'Compass', check: allSolvedFor('medium'),
  },
  {
    id: 'all-hard', title: 'Hard Mode Cleared', description: 'Solve every Hard question.',
    icon: 'Mountain', check: allSolvedFor('hard'),
  },
  {
    id: 'perfect-revision-week', title: 'Perfect Recall',
    description: 'Pass every revision, every day, for 7 days straight.',
    icon: 'ShieldCheck', check: (ctx) => ctx.perfectRevisionWeek,
  },
  {
    id: 'comeback', title: 'The Comeback',
    description: 'Return to solving after a break of 4 or more days.',
    icon: 'Undo2', check: (ctx) => ctx.hadComeback,
  },
  {
    id: 'first-mastered', title: 'First Mastery', description: 'Fully master your first question.',
    icon: 'Star', check: masteredAtLeast(1),
  },
  {
    id: 'mastered-100', title: 'Master of 100', description: 'Fully master 100 questions.',
    icon: 'Diamond', check: masteredAtLeast(100),
  },
];

const PATTERN_ACHIEVEMENTS: AchievementDef[] = PATTERNS.map((pattern) => ({
  id: `pattern-100-${pattern.id}`,
  title: `100% ${pattern.name}`,
  description: `Solve every question in the ${pattern.name} pattern.`,
  icon: pattern.icon,
  check: (ctx: AchievementCtx): boolean => {
    const stat = ctx.patternStats.find((s) => s.pattern === pattern.id);
    return !!stat && stat.pct === 100;
  },
}));

export const ACHIEVEMENTS: AchievementDef[] = [...FIXED_ACHIEVEMENTS, ...PATTERN_ACHIEVEMENTS];

function computePerfectRevisionWeek(dayLogs: Record<string, DayLog>, today: string): boolean {
  let anyFailed = false;
  for (let delta = 0; delta < PERFECT_REVISION_WINDOW_DAYS; delta++) {
    const date = addDays(today, -delta);
    const log = dayLogs[date];
    const attempts = log ? log.revisionsPassed.length + log.revisionsFailed.length : 0;
    if (attempts === 0) return false;
    if (log.revisionsFailed.length > 0) anyFailed = true;
  }
  return !anyFailed;
}

function computeHadComeback(dayLogs: Record<string, DayLog>): boolean {
  const activeDates = Object.keys(dayLogs)
    .filter((date) => hasActivity(dayLogs[date]))
    .sort();

  for (let i = 1; i < activeDates.length; i++) {
    if (diffDays(activeDates[i], activeDates[i - 1]) >= COMEBACK_GAP_DAYS) return true;
  }
  return false;
}

export function buildAchievementCtx(
  all: Question[], byId: Record<number, QuestionProgress>,
  dayLogs: Record<string, DayLog>, today: string,
): AchievementCtx {
  let solvedCount = 0;
  let masteredCount = 0;
  for (const q of all) {
    const p = byId[q.id];
    if (!p || p.status !== 'solved') continue;
    solvedCount += 1;
    if (isMastered(p)) masteredCount += 1;
  }

  return {
    solvedCount,
    masteredCount,
    streak: computeStreaks(dayLogs, today),
    patternStats: patternStats(all, byId),
    difficultyStats: difficultyStats(all, byId),
    perfectRevisionWeek: computePerfectRevisionWeek(dayLogs, today),
    hadComeback: computeHadComeback(dayLogs),
  };
}

export function evaluateAchievements(
  ctx: AchievementCtx, unlocked: Record<string, string>,
): string[] {
  return ACHIEVEMENTS
    .filter((a) => !Object.hasOwn(unlocked, a.id) && a.check(ctx))
    .map((a) => a.id);
}
