import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addTask, deferTaskToTomorrow, deleteTask, toggleTask } from '@/store/actions';
import { selectTasksForDate } from '@/store/slices/tasksSlice';
import { formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';
import type { TaskCategory } from '@/types';

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  study: 'Study',
  project: 'Project',
  communication: 'Communication',
  admin: 'Admin',
};

/**
 * The learner's own list for today.
 *
 * Scoped to tasks alone: the workload arithmetic that used to share this plate now lives in the
 * session plan, which is the surface that actually spends the time budget. Two plates each
 * printing their own version of "what today costs" was one number too many.
 *
 * Tasks still count toward the session plan — they enter the same ranked list as everything
 * else, at the bottom, because the learner knows their urgency better than the ranker does.
 */
export function TodayTasks() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const tasks = useAppSelector((s) => selectTasksForDate(s, today));

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [estimate, setEstimate] = useState('');

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const est = Number(estimate);
    dispatch(addTask({ title, category, estMinutes: Number.isInteger(est) && est > 0 ? est : null }));
    setTitle('');
    setEstimate('');
  }

  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Your tasks">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
        <h2 className="text-base font-medium">Your tasks</h2>
        {openTasks.length > 0 && (
          <p className="figures text-sm text-muted-foreground">
            {openTasks.length} open
            {doneTasks.length > 0 && ` · ${doneTasks.length} done`}
          </p>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing of your own on today&apos;s list — add anything that shares the day with study.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {[...openTasks, ...doneTasks].map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                aria-label={task.done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
                aria-pressed={task.done}
                onClick={() => dispatch(toggleTask(task.id))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground"
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
