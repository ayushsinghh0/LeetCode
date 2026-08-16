import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Section, RuledList, RuledItem, Meta } from '@/components/layout/Page';
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
 * Scoped to tasks alone: the workload arithmetic that used to share this surface now lives in the
 * session plan, which is the surface that actually spends the time budget. Two blocks each
 * printing their own version of "what today costs" was one number too many.
 *
 * Tasks still count toward the session plan — they enter the same ranked list as everything
 * else, at the bottom, because the learner knows their urgency better than the ranker does.
 *
 * Composition note: the row used to be one line carrying a toggle, a title, a category, an
 * estimate and two icon buttons, which left roughly 150px for the title on a phone. The title now
 * owns its line and the category and estimate drop below it as one `Meta` line — they describe the
 * same task, so they should look like one fact rather than two competing columns.
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
    <Section
      aria-label="Your tasks"
      title="Your tasks"
      eyebrow={
        tasks.length > 0
          ? `${openTasks.length} open${doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ''}`
          : undefined
      }
    >
      {tasks.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing of your own on today&apos;s list — add anything that shares the day with study.
        </p>
      ) : (
        <RuledList aria-label="Today's tasks">
          {[...openTasks, ...doneTasks].map((task) => (
            <RuledItem key={task.id} padded={false} className="flex items-center gap-2 py-1.5">
              <button
                type="button"
                aria-label={task.done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
                aria-pressed={task.done}
                onClick={() => dispatch(toggleTask(task.id))}
                className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground"
              >
                {/* The tick settles in rather than snapping — the small completion moment the
                    row earns. `initial={false}` on the presence keeps a list of already-done
                    tasks from popping on mount: only a toggle animates. No `exit`, so reopening
                    swaps instantly (un-completing is not a moment). The scale half is suppressed
                    by MotionConfig reducedMotion="user"; the opacity half is gentle enough to
                    keep. */}
                <AnimatePresence initial={false}>
                  {task.done ? (
                    <motion.span
                      key="done"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      className="flex"
                    >
                      <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <Circle key="todo" className="h-4 w-4" aria-hidden="true" />
                  )}
                </AnimatePresence>
              </button>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    'truncate text-sm',
                    task.done && 'text-muted-foreground line-through',
                  )}
                >
                  {task.title}
                </span>
                <Meta
                  className="text-xs"
                  items={[
                    CATEGORY_LABEL[task.category],
                    task.estMinutes !== null ? (
                      <span className="figures">{formatMinutes(task.estMinutes)}</span>
                    ) : null,
                  ]}
                />
              </div>

              <div className="flex shrink-0 items-center">
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
              </div>
            </RuledItem>
          ))}
        </RuledList>
      )}

      {/* Title first and full width, then the qualifiers: at 375px the old single wrapping row put
          a 144px select beside a 40px number field and an Add button, and the title lost.
          The `sm:` row variant this used to carry is gone, and its absence is the point. Tailwind
          media queries are *viewport*-scoped; this form now lives in Today's context rail, which is
          240px at 1024–1279px and 320px above that — so `sm:flex-row` (active from a 640px
          viewport) laid a 144px select, a 64px estimate and a ~76px button side by side inside
          240px and pushed the button 86px past the rail, which scrolled the whole document
          sideways. A component that can be placed in a column narrower than the viewport cannot
          take the viewport as a proxy for its own width. */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task for today…"
          aria-label="New task title"
          className="min-w-0 flex-1"
        />
        <div className="flex min-w-0 items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
            <SelectTrigger aria-label="Task category" className="min-w-0 flex-1">
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
            className="w-16 shrink-0"
          />
          <Button type="submit" size="sm" disabled={title.trim() === ''} className="shrink-0">
            <Plus /> Add
          </Button>
        </div>
      </form>
    </Section>
  );
}
