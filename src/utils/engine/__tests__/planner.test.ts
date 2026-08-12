import {
  buildDailyPlan,
  formatMinutes,
  COURSE_REVIEW_MINUTES,
  COURSE_SESSION_MINUTES,
  DEFAULT_TASK_MINUTES,
  REVISION_MINUTES,
} from '@/utils/engine/planner';
import type { DailyTask, Question } from '@/types';

const q = (id: number, difficulty: 'easy' | 'medium' | 'hard', estimatedTime: number): Question => ({
  id, title: `Q${id}`, pattern: 'two-pointers', difficulty, estimatedTime,
});

const task = (id: string, overrides: Partial<DailyTask> = {}): DailyTask => ({
  id, title: `Task ${id}`, category: 'project', date: '2026-07-30', done: false,
  completedOn: null, estMinutes: null, notes: '', ...overrides,
});

test('buildDailyPlan: sums question estimates, per-unit revision/course estimates, and task estimates', () => {
  const plan = buildDailyPlan({
    remainingNewQuestions: [q(1, 'easy', 15), q(2, 'medium', 25)],
    dueRevisionCount: 3,
    courseSessionPending: true,
    courseReviewsDue: 2,
    openTasks: [task('t1', { estMinutes: 30 }), task('t2')], // t2 falls back to the default
    capacityMin: 180,
  });

  expect(plan.lines.map((l) => l.kind)).toEqual([
    'new-questions', 'revisions', 'course-session', 'course-reviews', 'task', 'task',
  ]);
  expect(plan.totalMinutes).toBe(
    15 + 25 + 3 * REVISION_MINUTES + COURSE_SESSION_MINUTES + 2 * COURSE_REVIEW_MINUTES + 30 + DEFAULT_TASK_MINUTES,
  );
  expect(plan.overCapacity).toBe(plan.totalMinutes > 180);
});

test('buildDailyPlan: empty day produces no lines and never reads as over capacity', () => {
  const plan = buildDailyPlan({
    remainingNewQuestions: [],
    dueRevisionCount: 0,
    courseSessionPending: false,
    courseReviewsDue: 0,
    openTasks: [],
    capacityMin: 60,
  });
  expect(plan.lines).toEqual([]);
  expect(plan.totalMinutes).toBe(0);
  expect(plan.overCapacity).toBe(false);
});

test('buildDailyPlan: flags over-capacity exactly when the total exceeds the budget', () => {
  const base = {
    remainingNewQuestions: [q(1, 'hard', 40)],
    dueRevisionCount: 0,
    courseSessionPending: false,
    courseReviewsDue: 0,
    openTasks: [],
  };
  expect(buildDailyPlan({ ...base, capacityMin: 40 }).overCapacity).toBe(false); // exactly at budget is fine
  expect(buildDailyPlan({ ...base, capacityMin: 39 }).overCapacity).toBe(true);
});

test('task lines carry their taskId so the UI can act on them', () => {
  const plan = buildDailyPlan({
    remainingNewQuestions: [],
    dueRevisionCount: 0,
    courseSessionPending: false,
    courseReviewsDue: 0,
    openTasks: [task('t7')],
    capacityMin: 60,
  });
  expect(plan.lines[0]).toMatchObject({ kind: 'task', taskId: 't7', label: 'Task t7' });
});

test('formatMinutes: minutes under an hour, exact hours, and mixed', () => {
  expect(formatMinutes(45)).toBe('45m');
  expect(formatMinutes(60)).toBe('1h');
  expect(formatMinutes(125)).toBe('2h 05m');
});
