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
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Zap, Timer, CalendarX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPerDay, selectQuestionById } from '@/store/selectors';
import { hasActivity, isPerfectDay } from '@/utils/engine/streak';
import { toISODate, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { DayLog } from '@/types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same 0-4 intensity scale as the heatmap (src/components/shared/Heatmap.tsx) — kept in sync by
// convention since Heatmap doesn't export its LEVEL_CLASS/level-bucketing helpers.
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/40',
  1: 'bg-violet-900/40',
  2: 'bg-violet-700/50',
  3: 'bg-violet-500/70',
  4: 'bg-violet-400',
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

export default function CalendarPage() {
  const dispatch = useAppDispatch();
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const perDay = useAppSelector(selectPerDay);
  const today = todayISO();
  const [viewMonth, setViewMonth] = useState<Date>(() => parseISO(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingOffset = getDay(monthStart);

  const selectedLog = selectedDate ? dayLogs[selectedDate] : undefined;

  let activeDays = 0;
  let totalSolves = 0;
  let totalRevisions = 0;
  let totalXp = 0;
  for (const day of days) {
    const log = dayLogs[toISODate(day)];
    if (hasActivity(log)) activeDays++;
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
            const count = dayLogCount(log);
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
                  future ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent',
                  isToday && 'border-primary',
                  perfect && 'ring-2 ring-violet-400',
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
                {selectedLog
                  ? `${selectedLog.solvedIds.length} solved · ${
                      selectedLog.revisionsPassed.length + selectedLog.revisionsFailed.length
                    } revisions · ${selectedLog.xpEarned} XP · ${selectedLog.focusMinutes} focus min`
                  : 'No activity on this day'}
              </DialogDescription>
            </DialogHeader>

            {!selectedLog ? (
              <EmptyState icon={CalendarX} title="No activity on this day" />
            ) : (
              <div className="space-y-4">
                {selectedLog.solvedIds.length > 0 && (
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

                {(selectedLog.revisionsPassed.length > 0 || selectedLog.revisionsFailed.length > 0) && (
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
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
