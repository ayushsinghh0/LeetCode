// The daily plan: turns the day's remaining work — both learning tracks plus user tasks —
// into a small list of lines with explicit minute estimates, summed against the user's
// capacity setting. Pure and deterministic like every engine module: no clock, no store.
//
// Estimates are deliberately explicit constants, not fabricated precision: a revision is a
// quick re-derive (~a third of solving it fresh), a course session is the two-day sprint's
// evening block, a task without a user estimate gets a small default. The UI presents totals
// with "~" for exactly this reason.
import type { DailyTask, Question } from '@/types';

export const REVISION_MINUTES = 8;
export const COURSE_SESSION_MINUTES = 60;
export const COURSE_REVIEW_MINUTES = 10;
export const DEFAULT_TASK_MINUTES = 15;

export interface PlanInput {
  remainingNewQuestions: Question[]; // today's slice, not yet solved/skipped
  dueRevisionCount: number;
  courseSessionPending: boolean;
  courseReviewsDue: number;
  openTasks: DailyTask[]; // today's not-done user tasks
  capacityMin: number;
}

export interface PlanLine {
  kind: 'new-questions' | 'revisions' | 'course-session' | 'course-reviews' | 'task';
  label: string;
  minutes: number;
  count: number;
  taskId?: string; // present for kind 'task'
}

export interface DailyPlan {
  lines: PlanLine[];
  totalMinutes: number;
  capacityMin: number;
  overCapacity: boolean;
}

export function buildDailyPlan(input: PlanInput): DailyPlan {
  const lines: PlanLine[] = [];

  const newCount = input.remainingNewQuestions.length;
  if (newCount > 0) {
    const minutes = input.remainingNewQuestions.reduce((sum, q) => sum + q.estimatedTime, 0);
    lines.push({
      kind: 'new-questions',
      label: `${newCount} new question${newCount === 1 ? '' : 's'}`,
      minutes,
      count: newCount,
    });
  }

  if (input.dueRevisionCount > 0) {
    lines.push({
      kind: 'revisions',
      label: `${input.dueRevisionCount} revision${input.dueRevisionCount === 1 ? '' : 's'} due`,
      minutes: input.dueRevisionCount * REVISION_MINUTES,
      count: input.dueRevisionCount,
    });
  }

  if (input.courseSessionPending) {
    lines.push({
      kind: 'course-session',
      label: 'AI/ML session',
      minutes: COURSE_SESSION_MINUTES,
      count: 1,
    });
  }

  if (input.courseReviewsDue > 0) {
    lines.push({
      kind: 'course-reviews',
      label: `${input.courseReviewsDue} course review${input.courseReviewsDue === 1 ? '' : 's'} due`,
      minutes: input.courseReviewsDue * COURSE_REVIEW_MINUTES,
      count: input.courseReviewsDue,
    });
  }

  for (const task of input.openTasks) {
    lines.push({
      kind: 'task',
      label: task.title,
      minutes: task.estMinutes ?? DEFAULT_TASK_MINUTES,
      count: 1,
      taskId: task.id,
    });
  }

  const totalMinutes = lines.reduce((sum, line) => sum + line.minutes, 0);
  return {
    lines,
    totalMinutes,
    capacityMin: input.capacityMin,
    overCapacity: totalMinutes > input.capacityMin,
  };
}

// "2h 05m" / "45m" — the plan's one time format.
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}
