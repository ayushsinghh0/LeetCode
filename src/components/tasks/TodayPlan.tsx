import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addTask, deferTaskToTomorrow, deleteTask, toggleTask } from '@/store/actions';
import {
  selectCourseDueReviewIds,
  selectCourseNextSession,
  selectRevisionQueueIds,
  selectTodaysNewQuestions,
} from '@/store/selectors';
import { selectTasksForDate } from '@/store/slices/tasksSlice';
import { buildDailyPlan, formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';
import type { TaskCategory } from '@/types';

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  study: 'Study',
  project: 'Project',
  communication: 'Communication',
  admin: 'Admin',
};

// The whole day on one plate: roadmap/course workload with explicit minute estimates, the
// user's own tasks beside it, summed against their capacity setting. Estimates are the
// planner's documented constants — hence the "~" on every total.
export function TodayPlan() {
  const dispatch = useAppDispatch();
  const today = useToday();

  const newQuestions = useAppSelector(selectTodaysNewQuestions);
  const progressById = useAppSelector((s) => s.progress.byId);
  const revisionIds = useAppSelector((s) => selectRevisionQueueIds(s, today));
  const courseNext = useAppSelector(selectCourseNextSession);
  const courseDueReviewIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);
  const tasks = useAppSelector((s) => selectTasksForDate(s, today));

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const plan = useMemo(() => {
    const remaining = newQuestions.filter((q) => {
      const status = progressById[q.id]?.status ?? 'unsolved';
      return status !== 'solved' && status !== 'skipped';
    });
    return buildDailyPlan({
      remainingNewQuestions: remaining,
      dueRevisionCount: revisionIds.length,
      courseSessionPending: courseNext !== null,
      courseReviewsDue: courseDueReviewIds.length,
      openTasks,
      capacityMin,
    });
  }, [newQuestions, progressById, revisionIds, courseNext, courseDueReviewIds, openTasks, capacityMin]);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [estimate, setEstimate] = useState('');

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const est = Number(estimate);
    dispatch(
      addTask({
        title,
        category,
        estMinutes: Number.isInteger(est) && est > 0 ? est : null,
      }),
    );
    setTitle('');
    setEstimate('');
  }

  const workloadLines = plan.lines.filter((l) => l.kind !== 'task');
  const pct = capacityMin > 0 ? Math.min(100, (plan.totalMinutes / capacityMin) * 100) : 0;

  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Today's plan">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
        <h2 className="text-base font-medium">Today&apos;s plan</h2>
        <p className="figures text-sm text-muted-foreground">
          ~{formatMinutes(plan.totalMinutes)} of {formatMinutes(plan.capacityMin)} capacity
        </p>
      </div>

      <Progress value={pct} className="h-1.5" aria-label="Planned workload against daily capacity" />
      {plan.overCapacity && (
        <p className="text-sm text-muted-foreground">
          More than your usual capacity — defer what can wait, or adjust capacity in{' '}
          <Link to="/settings" className="underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      )}

      {plan.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Everything&apos;s done — nothing left on today&apos;s plan.
        </p>
      ) : (
        workloadLines.length > 0 && (
          <ul className="flex flex-col gap-1">
            {workloadLines.map((line) => (
              <li key={line.kind} className="flex items-center justify-between gap-3 text-sm">
                <span>{line.label}</span>
                <span className="figures shrink-0 text-muted-foreground">~{formatMinutes(line.minutes)}</span>
              </li>
            ))}
          </ul>
        )
      )}

      {(openTasks.length > 0 || doneTasks.length > 0) && (
        <ul className="flex flex-col gap-1 border-t border-border/70 pt-2">
          {[...openTasks, ...doneTasks].map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                aria-label={task.done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
                aria-pressed={task.done}
                onClick={() => dispatch(toggleTask(task.id))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <span className={cn('min-w-0 flex-1 truncate', task.done && 'text-muted-foreground line-through')}>
                {task.title}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{CATEGORY_LABEL[task.category]}</span>
              {task.estMinutes !== null && (
                <span className="figures shrink-0 text-xs text-muted-foreground">{formatMinutes(task.estMinutes)}</span>
              )}
              {!task.done && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Defer "${task.title}" to tomorrow`}
                  onClick={() => dispatch(deferTaskToTomorrow(task.id))}
                >
                  <ArrowRight />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete "${task.title}"`}
                onClick={() => dispatch(deleteTask(task.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task for today…"
          aria-label="New task title"
          className="min-w-0 flex-1 basis-40"
        />
        <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
          <SelectTrigger aria-label="Task category" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          placeholder="min"
          aria-label="Estimated minutes (optional)"
          inputMode="numeric"
          className="w-16"
        />
        <Button type="submit" size="sm" disabled={title.trim() === ''}>
          <Plus /> Add
        </Button>
      </form>
    </section>
  );
}
