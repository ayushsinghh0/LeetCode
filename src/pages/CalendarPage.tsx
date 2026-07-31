import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  format,
  parseISO,
  isAfter,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Zap, Timer, CalendarX, GraduationCap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectCourseActivityByDate, selectPerDay, selectQuestionById } from '@/store/selectors';
import { hasActivity, isPerfectDay } from '@/utils/engine/streak';
import { toISODate, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import { courseWeekById } from '@/data/aimlCourse';
import type { CourseWeekProgress, DayLog } from '@/types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same 0-4 intensity scale as the heatmap (src/components/shared/Heatmap.tsx) — kept in sync by
// convention since Heatmap doesn't export its LEVEL_CLASS/level-bucketing helpers.
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/40',
  1: 'bg-primary/25',
  2: 'bg-primary/45',
  3: 'bg-primary/70',
  4: 'bg-primary',
};

function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

function dayLogCount(log: DayLog | undefined): number {
  return log ? log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length : 0;
}

function titleFor(id: number): string {
  return selectQuestionById(id)?.title ?? `#${id}`;
}

interface CourseDayEvent {
  key: string;
  title: string;
  kind: 'Lecture' | 'Practice' | 'Session' | 'Review';
  passed?: boolean; // reviews only
}

// Course work stamped on `date`, resolved to week titles for the day dialog.
function courseEventsOn(
  byWeekId: Record<string, CourseWeekProgress>,
  date: string,
): CourseDayEvent[] {
  const events: CourseDayEvent[] = [];
  for (const [weekId, p] of Object.entries(byWeekId)) {
    const week = courseWeekById.get(weekId);
    if (!week) continue;
    if (p.day1DoneOn === date) {
      events.push({ key: `${weekId}-d1`, title: week.title, kind: week.optional ? 'Session' : 'Lecture' });
    }
    if (p.day2DoneOn === date) {
      events.push({ key: `${weekId}-d2`, title: week.title, kind: 'Practice' });
    }
    p.revisionHistory.forEach((review, i) => {
      if (review.date === date) {
        events.push({ key: `${weekId}-r${i}`, title: week.title, kind: 'Review', passed: review.passed });
      }
    });
  }
  return events;
}

export default function CalendarPage() {
  const dispatch = useAppDispatch();
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const courseByWeekId = useAppSelector((s) => s.course.byWeekId);
  const courseActivity = useAppSelector(selectCourseActivityByDate);
  const perDay = useAppSelector(selectPerDay);
  const today = todayISO();
  const [viewMonth, setViewMonth] = useState<Date>(() => parseISO(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingOffset = getDay(monthStart);

  const selectedLog = selectedDate ? dayLogs[selectedDate] : undefined;
  const selectedCourseEvents = selectedDate ? courseEventsOn(courseByWeekId, selectedDate) : [];

  let activeDays = 0;
  let totalSolves = 0;
  let totalRevisions = 0;
  let totalCourse = 0;
  let totalXp = 0;
  for (const day of days) {
    const iso = toISODate(day);
    const log = dayLogs[iso];
    const courseCount = courseActivity.get(iso) ?? 0;
    if (hasActivity(log) || courseCount > 0) activeDays++;
    totalCourse += courseCount;
    if (log) {
      totalSolves += log.solvedIds.length;
      totalRevisions += log.revisionsPassed.length + log.revisionsFailed.length;
      totalXp += log.xpEarned;
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) setSelectedDate(null);
  }

  return (
    <div className="space-y-6">
      <header className="glass flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft />
          </Button>
          <h1 className="min-w-[10ch] text-center text-xl font-semibold">{format(viewMonth, 'MMMM yyyy')}</h1>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setViewMonth(parseISO(today))}>
          Today
        </Button>
      </header>

      <div className="glass p-4">
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-sm font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: leadingOffset }).map((_, i) => (
            <div key={`pad-${i}`} aria-hidden="true" />
          ))}
          {days.map((day) => {
            const iso = toISODate(day);
            const log = dayLogs[iso];
            const count = dayLogCount(log) + (courseActivity.get(iso) ?? 0);
            const level = activityLevel(count);
            const future = isAfter(day, parseISO(today));
            const isToday = iso === today;
            const perfect = isPerfectDay(log, perDay);

            return (
              <button
                key={iso}
                type="button"
                disabled={future}
                data-level={level}
                aria-label={`${format(day, 'MMMM d, yyyy')} — ${count} activities`}
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-transparent text-sm transition-colors',
                  future ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted',
                  isToday && 'border-primary',
                  perfect && 'ring-2 ring-primary',
                )}
              >
                <span>{format(day, 'd')}</span>
                <span className={cn('h-2 w-2 rounded-full', LEVEL_CLASS[level])} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
        <div>
          <span className="font-semibold text-foreground">{activeDays}</span>{' '}
          <span className="text-muted-foreground">active days</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">{totalSolves}</span>{' '}
          <span className="text-muted-foreground">solves</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">{totalRevisions}</span>{' '}
          <span className="text-muted-foreground">revisions</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">{totalCourse}</span>{' '}
          <span className="text-muted-foreground">course sessions</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">{totalXp}</span>{' '}
          <span className="text-muted-foreground">XP</span>
        </div>
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={handleDialogOpenChange}>
        {selectedDate && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription>
                {selectedLog || selectedCourseEvents.length > 0
                  ? `${selectedLog?.solvedIds.length ?? 0} solved · ${
                      (selectedLog?.revisionsPassed.length ?? 0) +
                      (selectedLog?.revisionsFailed.length ?? 0)
                    } revisions · ${selectedCourseEvents.length} course · ${
                      selectedLog?.xpEarned ?? 0
                    } XP · ${selectedLog?.focusMinutes ?? 0} focus min`
                  : 'No activity on this day'}
              </DialogDescription>
            </DialogHeader>

            {!selectedLog && selectedCourseEvents.length === 0 ? (
              <EmptyState icon={CalendarX} title="No activity on this day" />
            ) : (
              <div className="space-y-4">
                {selectedLog && selectedLog.solvedIds.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Solved</p>
                    <ul className="space-y-1">
                      {selectedLog.solvedIds.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline"
                            onClick={() => dispatch(activeQuestionSet(id))}
                          >
                            {titleFor(id)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLog && (selectedLog.revisionsPassed.length > 0 || selectedLog.revisionsFailed.length > 0) && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Revisions</p>
                    <ul className="space-y-1">
                      {selectedLog.revisionsPassed.map((id) => (
                        <li key={`p-${id}`} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                          {titleFor(id)}
                        </li>
                      ))}
                      {selectedLog.revisionsFailed.map((id) => (
                        <li key={`f-${id}`} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-hard" aria-hidden="true" />
                          {titleFor(id)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedCourseEvents.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Course</p>
                    <ul className="space-y-1">
                      {selectedCourseEvents.map((event) => (
                        <li key={event.key} className="flex items-center gap-2 text-sm">
                          {event.kind === 'Review' ? (
                            event.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                            ) : (
                              <XCircle className="h-4 w-4 text-hard" aria-hidden="true" />
                            )
                          ) : (
                            <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span>{event.title}</span>
                          <span className="text-muted-foreground">· {event.kind}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLog && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      {selectedLog.xpEarned} XP
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="h-4 w-4" aria-hidden="true" />
                      {selectedLog.focusMinutes} focus min
                    </span>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
