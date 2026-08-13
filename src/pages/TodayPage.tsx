import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DailyGoalProgress } from '@/components/shared/DailyGoalProgress';
import { WeeklyRevisionBanner } from '@/components/shared/WeeklyRevisionBanner';
import { TodayTasks } from '@/components/tasks/TodayTasks';
import { CourseTodayCard } from '@/components/course/CourseTodayCard';
import { NextActionCard } from '@/components/today/NextActionCard';
import { SessionPlan } from '@/components/today/SessionPlan';
import { ReturnNotice } from '@/components/today/ReturnNotice';
import { DayCleared } from '@/components/today/DayCleared';
import { useToday } from '@/hooks/useToday';
import { useAppSelector } from '@/store/hooks';
import {
  selectCurrentDay,
  selectDaysAway,
  selectIsWeeklyDay,
  selectPerDay,
  selectRankedWork,
  selectRevisionQueueIds,
  selectTodayLog,
  selectTotalDays,
} from '@/store/selectors';
import { buildSession } from '@/utils/engine/nextAction';

/**
 * Today — the daily execution surface.
 *
 * The page answers one question in its first screenful: what should I do right now, and why.
 * Everything below the hero is support for that answer, ordered by how much it changes the
 * decision. Full question inventories deliberately live on /roadmap and /revision rather than
 * here; listing the same eight problems on three surfaces was the thing that made this page read
 * as a dashboard rather than a plan.
 */
export default function TodayPage() {
  const today = useToday();

  const currentDay = useAppSelector(selectCurrentDay);
  const totalDays = useAppSelector(selectTotalDays);
  const isWeeklyDay = useAppSelector(selectIsWeeklyDay);
  const perDay = useAppSelector(selectPerDay);
  const revisionIds = useAppSelector((state) => selectRevisionQueueIds(state, today));
  const todayLog = useAppSelector((state) => selectTodayLog(state, today));
  const ranked = useAppSelector((state) => selectRankedWork(state, today));
  const daysAway = useAppSelector((state) => selectDaysAway(state, today));
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);

  const solvedToday = todayLog ? todayLog.solvedIds.length : 0;
  const minutesToday = todayLog ? todayLog.focusMinutes : 0;
  const activeToday = solvedToday > 0 || minutesToday > 0;

  // Shown only on a genuine return: two or more days away, and nothing logged yet today.
  const returning = daysAway !== null && daysAway >= 2 && !activeToday;
  const plannedMinutes = buildSession(capacityMin, ranked).totalMinutes;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Today</h1>
          <p className="figures text-sm text-muted-foreground">
            {format(parseISO(today), 'EEEE, MMMM d')} &middot; Day {currentDay} of {totalDays}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/focus">Focus mode</Link>
        </Button>
      </header>

      {returning && <ReturnNotice daysAway={daysAway} plannedMinutes={plannedMinutes} />}

      {isWeeklyDay && <WeeklyRevisionBanner count={revisionIds.length} />}

      {ranked.length > 0 ? (
        <NextActionCard ranked={ranked} />
      ) : (
        <DayCleared solvedToday={solvedToday} minutesToday={minutesToday} />
      )}

      <SessionPlan ranked={ranked} />

      <div className="glass p-5">
        <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />
      </div>

      <CourseTodayCard />

      <TodayTasks />

      <p className="text-center text-xs text-muted-foreground">
        Looking for the full lists?{' '}
        <Link to="/roadmap" className="underline underline-offset-2">
          Roadmap
        </Link>{' '}
        has every question,{' '}
        <Link to="/revision" className="underline underline-offset-2">
          Revision
        </Link>{' '}
        has the whole queue.
      </p>
    </div>
  );
}
