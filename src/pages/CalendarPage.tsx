import { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
import { Eyebrow, Page, PageHeader, Section, Rule, Meta } from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectOtherTrackActivityByDate, selectPerDay, selectQuestionById } from '@/store/selectors';
import { isPerfectDay } from '@/utils/engine/streak';
import { useToday } from '@/hooks/useToday';
import { toISODate } from '@/utils/dates';
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

// `active` carries the work that is not a count — focus minutes, XP — so a day the page calls
// active is never drawn as an empty one.
function activityLevel(count: number, active: boolean): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return active ? 1 : 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

function dayLogCount(log: DayLog | undefined): number {
  return log ? log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length : 0;
}

/**
 * The one definition of "active" on this page — used by the cell shading, the cell's label, the
 * month caption and the day dialog alike. A day is active when its ledger holds anything the day
 * dialog can show you: a solve, a revision, course work, focus minutes, or XP.
 *
 * `hasActivity` in engine/streak.ts answers a deliberately narrower question — solves and
 * revisions only — because it is the *streak* rule, shared with the dashboard heatmap; widening
 * it would move the goalposts on every streak in the app. So the calendar states its own rule
 * rather than borrowing one written for something else, and the two differ on purpose: a
 * pomodoro is a day you worked, not a day you practiced.
 *
 * The bug this closes: two pomodoros and nothing else creates a DayLog, so the dialog read
 * "0 solved · … · 50 focus min" while the cell behind it was empty and the caption said
 * "0 active days".
 */
function dayIsActive(log: DayLog | undefined, courseCount: number): boolean {
  if (courseCount > 0) return true;
  if (!log) return false;
  return dayLogCount(log) > 0 || log.focusMinutes > 0 || log.xpEarned > 0;
}

function titleFor(id: number): string {
  return selectQuestionById(id)?.title ?? `#${id}`;
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
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

/**
 * The month's course work, split the way the day dialog already splits it.
 *
 * `courseActivityByDate` collapses two different things into one number: a session stamp
 * (day1DoneOn/day2DoneOn) and a graded review. A month with no new sessions and four reviews was
 * captioned "4 course sessions" — a claim this page's own dialog contradicts one click later,
 * where all four rows read "Review". The traversal here is deliberately identical to
 * `courseActivityByDate`'s (every week id in the map, whether or not the week still exists), so
 * `sessions + reviews` is exactly the total the cells are shaded from.
 */
function courseTotalsIn(
  byWeekId: Record<string, CourseWeekProgress>,
  dates: ReadonlySet<string>,
): { sessions: number; reviews: number } {
  let sessions = 0;
  let reviews = 0;
  for (const p of Object.values(byWeekId)) {
    if (p.day1DoneOn !== null && dates.has(p.day1DoneOn)) sessions++;
    if (p.day2DoneOn !== null && dates.has(p.day2DoneOn)) sessions++;
    for (const review of p.revisionHistory) if (dates.has(review.date)) reviews++;
  }
  return { sessions, reviews };
}

/**
 * Calendar — one month of activity, read as a page of the course reader rather than a stack of
 * cards. The month name *is* the page title (the stepper in the masthead changes which month
 * you're reading), the grid sits on the page ground because 31 outlined cells already draw their
 * own structure, and the month totals are a ruled caption under it — not a fourth plate.
 */
export default function CalendarPage() {
  const dispatch = useAppDispatch();
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const courseByWeekId = useAppSelector((s) => s.course.byWeekId);
  const courseActivity = useAppSelector(selectOtherTrackActivityByDate);
  const perDay = useAppSelector(selectPerDay);
  // useToday (not a raw todayISO() read at render) so a calendar left open across midnight
  // rolls over like every other page.
  const today = useToday();
  // A date handed over by another surface (e.g. clicking a heatmap cell on the dashboard)
  // opens straight onto that day, with its month in view.
  const locationState = useLocation().state as { date?: unknown } | null;
  const handedDate = typeof locationState?.date === 'string' ? locationState.date : null;
  const [viewMonth, setViewMonth] = useState<Date>(() => parseISO(handedDate ?? today));
  const [selectedDate, setSelectedDate] = useState<string | null>(handedDate);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingOffset = getDay(monthStart);

  const selectedLog = selectedDate ? dayLogs[selectedDate] : undefined;
  const selectedCourseEvents = selectedDate ? courseEventsOn(courseByWeekId, selectedDate) : [];
  const selectedHasActivity = dayIsActive(selectedLog, selectedCourseEvents.length);

  const monthDates = new Set<string>();
  let activeDays = 0;
  let totalSolves = 0;
  let totalRevisions = 0;
  let totalXp = 0;
  let totalFocusMin = 0;
  for (const day of days) {
    const iso = toISODate(day);
    monthDates.add(iso);
    const log = dayLogs[iso];
    if (dayIsActive(log, courseActivity.get(iso) ?? 0)) activeDays++;
    if (log) {
      totalSolves += log.solvedIds.length;
      totalRevisions += log.revisionsPassed.length + log.revisionsFailed.length;
      totalXp += log.xpEarned;
      totalFocusMin += log.focusMinutes;
    }
  }
  const course = courseTotalsIn(courseByWeekId, monthDates);

  // One caption line, not a strip of boxed stats. Every value is a counted fact, so every value
  // wears `.figures`; the words around them stay in the reading voice. Focus minutes are here
  // because they are one of the things that makes a day count as active — a month reading
  // "1 active day" with nothing but zeros beside it would be unreadable.
  const monthTotals: { value: number; label: string }[] = [
    { value: activeDays, label: plural(activeDays, 'active day') },
    { value: totalSolves, label: plural(totalSolves, 'solve') },
    { value: totalRevisions, label: plural(totalRevisions, 'revision') },
    { value: course.sessions, label: plural(course.sessions, 'course session') },
    { value: course.reviews, label: plural(course.reviews, 'course review') },
    { value: totalFocusMin, label: 'focus min' },
    { value: totalXp, label: 'XP' },
  ];

  function handleDialogOpenChange(open: boolean) {
    if (!open) setSelectedDate(null);
  }

  return (
    // The default measure, like every other page. `wide` was the only use of it in the app, and
    // all it bought was 150×64 cells: one date numeral and an 8px dot spread across a gutter that
    // matched nothing else in the product.
    <Page>
      <PageHeader
        eyebrow="Calendar"
        title={format(viewMonth, 'MMMM yyyy')}
        support="Every solve, revision and course session, day by day. Open a day to read what you did."
        action={
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight />
            </Button>
            <Button variant="secondary" onClick={() => setViewMonth(parseISO(today))}>
              Today
            </Button>
          </>
        }
      />

      <Section aria-label="Month activity">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-7 gap-2 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <Eyebrow key={label}>{label}</Eyebrow>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leadingOffset }).map((_, i) => (
              <div key={`pad-${i}`} aria-hidden="true" />
            ))}
            {days.map((day) => {
              const iso = toISODate(day);
              const log = dayLogs[iso];
              const courseCount = courseActivity.get(iso) ?? 0;
              const count = dayLogCount(log) + courseCount;
              const focusMin = log?.focusMinutes ?? 0;
              const level = activityLevel(count, dayIsActive(log, courseCount));
              const future = isAfter(day, parseISO(today));
              const isToday = iso === today;
              const perfect = isPerfectDay(log, perDay);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={future}
                  data-level={level}
                  // Focus minutes are named only when there are some: they are not activities
                  // (they are not a count of anything graded), but a lit cell whose label says
                  // "0 activities" is the same contradiction in a screen reader's voice.
                  aria-label={`${format(day, 'MMMM d, yyyy')} — ${count} activities${
                    focusMin > 0 ? `, ${focusMin} focus min` : ''
                  }${perfect ? ' — perfect day' : ''}`}
                  onClick={() => setSelectedDate(iso)}
                  className={cn(
                    // Square at every width. The landscape variant above `sm` stretched one date
                    // numeral and one 8px dot across 150×64 — tiny information in a large area,
                    // and a shape nothing else in the product uses.
                    'relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-transparent text-sm transition-colors duration-150 ease-swift',
                    future ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted',
                    isToday && 'border-primary',
                    perfect && 'ring-2 ring-primary',
                  )}
                >
                  <span className="figures">{format(day, 'd')}</span>
                  <span className={cn('h-2 w-2 rounded-full', LEVEL_CLASS[level])} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <Rule />

        <Meta
          items={monthTotals.map((total) => (
            <span key={total.label}>
              <span className="figures text-foreground">{total.value}</span> {total.label}
            </span>
          ))}
        />
      </Section>

      <Dialog open={selectedDate !== null} onOpenChange={handleDialogOpenChange}>
        {selectedDate && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription className={cn(selectedHasActivity && 'figures')}>
                {selectedHasActivity
                  ? `${selectedLog?.solvedIds.length ?? 0} solved · ${
                      (selectedLog?.revisionsPassed.length ?? 0) +
                      (selectedLog?.revisionsFailed.length ?? 0)
                    } revisions · ${selectedCourseEvents.length} course · ${
                      selectedLog?.xpEarned ?? 0
                    } XP · ${selectedLog?.focusMinutes ?? 0} focus min`
                  : 'No activity on this day'}
              </DialogDescription>
            </DialogHeader>

            {!selectedHasActivity ? (
              <EmptyState icon={CalendarX} title="No activity on this day" />
            ) : (
              <div className="flex flex-col gap-5">
                {selectedLog && selectedLog.solvedIds.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Eyebrow>Solved</Eyebrow>
                    <ul className="flex flex-col gap-1.5">
                      {selectedLog.solvedIds.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            className="text-left text-sm text-primary underline-offset-2 hover:underline"
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
                  <div className="flex flex-col gap-2">
                    <Eyebrow>Revisions</Eyebrow>
                    <ul className="flex flex-col gap-1.5">
                      {selectedLog.revisionsPassed.map((id) => (
                        <li key={`p-${id}`} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />
                          {titleFor(id)}
                        </li>
                      ))}
                      {selectedLog.revisionsFailed.map((id) => (
                        <li key={`f-${id}`} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 shrink-0 text-hard" aria-hidden="true" />
                          {titleFor(id)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedCourseEvents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Eyebrow>Course</Eyebrow>
                    <ul className="flex flex-col gap-1.5">
                      {selectedCourseEvents.map((event) => (
                        <li key={event.key} className="flex items-center gap-2 text-sm">
                          {event.kind === 'Review' ? (
                            event.passed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-hard" aria-hidden="true" />
                            )
                          ) : (
                            <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span>{event.title}</span>
                          <span className="text-muted-foreground">· {event.kind}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLog && (
                  <div className="flex flex-col gap-3">
                    <Rule />
                    <div className="figures flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4" aria-hidden="true" />
                        {selectedLog.xpEarned} XP
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Timer className="h-4 w-4" aria-hidden="true" />
                        {selectedLog.focusMinutes} focus min
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </Page>
  );
}
