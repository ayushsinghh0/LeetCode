import { format, parseISO } from 'date-fns';
import { BookOpenCheck, CheckCircle2, Circle, NotebookPen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CourseResourceChips } from '@/components/course/CourseResourceChips';
import { recallByWeekId } from '@/data/courseRecall';
import { cn } from '@/utils/cn';
import { useAppDispatch } from '@/store/hooks';
import { completeCourseSession } from '@/store/actions';
import type { CourseWeek } from '@/data/aimlCourse';
import type { CourseWeekProgress } from '@/types';
import {
  isWeekDone,
  isWeekRetained,
  sessionCount,
  type CourseDay,
  type WeekSchedule,
} from '@/utils/engine/aimlCourse';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

export interface CourseWeekRowProps {
  week: CourseWeek;
  progress: CourseWeekProgress;
  /** Planned dates for this week's pending sessions; undefined for extras (unscheduled). */
  planned?: WeekSchedule;
  /** True when this row holds the plan's next session. */
  isCurrent?: boolean;
  onOpenNotes: (week: CourseWeek) => void;
  onOpenRecall: (week: CourseWeek) => void;
}

function SessionControl({ week, day, progress }: { week: CourseWeek; day: CourseDay; progress: CourseWeekProgress }) {
  const dispatch = useAppDispatch();
  const doneOn = day === 1 ? progress.day1DoneOn : progress.day2DoneOn;
  const ariaName = week.optional ? `Mark ${week.title} done` : `Mark Week ${week.week} day ${day} done`;

  if (doneOn !== null) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="figures whitespace-nowrap">
          {week.optional ? monthDay(doneOn) : `Day ${day} · ${monthDay(doneOn)}`}
        </span>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={ariaName}
      onClick={() => dispatch(completeCourseSession(week.id, day))}
    >
      <Circle /> {week.optional ? 'Mark done' : `Day ${day}`}
    </Button>
  );
}

// One syllabus line: chapter numeral, title + meta + resource chips, session controls, notes.
//
// The row is flush to the page column and rules itself off through the `RuledList` parent's
// `divide-y`. It used to carry `p-4` plus its own `border-t … first:border-t-0` — both leftovers
// from when the syllabus lived inside a plate — so every week title sat 16px right of the
// "Syllabus" heading above it and every hairline was drawn twice.
export function CourseWeekRow({ week, progress, planned, isCurrent, onOpenNotes, onOpenRecall }: CourseWeekRowProps) {
  const done = isWeekDone(week, progress);
  const hasRecall = (recallByWeekId[week.id] ?? []).length > 0;

  const plannedLabel = (() => {
    if (done) return null;
    if (!planned) return null;
    if (planned.day1 && planned.day2) return `planned ${monthDay(planned.day1)} – ${monthDay(planned.day2)}`;
    const single = planned.day1 ?? planned.day2;
    return single ? `planned ${monthDay(single)}` : null;
  })();

  const clearedLabel = (() => {
    if (!done) return null;
    const last = week.optional ? progress.day1DoneOn : progress.day2DoneOn;
    const cleared = last ? `cleared ${monthDay(last)}` : null;
    if (week.optional) return cleared; // extras never enter the review ladder
    const retention = isWeekRetained(progress)
      ? 'retained'
      : progress.nextRevision
        ? `review ${monthDay(progress.nextRevision)}`
        : null;
    return [cleared, retention].filter(Boolean).join(' · ') || null;
  })();

  return (
    <li
      aria-current={isCurrent ? 'step' : undefined}
      className={cn(
        'flex flex-col gap-3 py-3.5 md:flex-row md:items-center',
        isCurrent && 'bg-muted/40',
      )}
    >
      {week.optional ? (
        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 md:mt-0" aria-hidden="true" />
      ) : (
        <span
          className={cn(
            'w-8 shrink-0 font-serif text-xl font-semibold leading-none',
            done ? 'text-muted-foreground/50' : isCurrent ? 'text-primary' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {week.week}
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={cn('font-medium', done && 'text-muted-foreground')}>{week.title}</p>
        <p className="figures text-xs text-muted-foreground/80">
          {week.taughtOn && `taught ${monthDay(week.taughtOn)}`}
          {week.taughtOn && (plannedLabel || clearedLabel) && ' · '}
          {plannedLabel ?? clearedLabel}
        </p>
        <CourseResourceChips resources={week.resources} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <SessionControl week={week} day={1} progress={progress} />
        {sessionCount(week) === 2 && <SessionControl week={week} day={2} progress={progress} />}
        {hasRecall && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Check yourself on ${week.optional ? week.title : `Week ${week.week}`}`}
            onClick={() => onOpenRecall(week)}
          >
            <BookOpenCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          // Add vs Edit tells AT users whether notes exist — visually that state is only the
          // icon's ink color.
          aria-label={`${progress.notes.trim() !== '' ? 'Edit' : 'Add'} notes for ${
            week.optional ? week.title : `Week ${week.week}`
          }`}
          onClick={() => onOpenNotes(week)}
        >
          <NotebookPen
            className={cn('h-4 w-4', progress.notes.trim() !== '' ? 'text-primary' : 'text-muted-foreground')}
            aria-hidden="true"
          />
        </Button>
      </div>
    </li>
  );
}
