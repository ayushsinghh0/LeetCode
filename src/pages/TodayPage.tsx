import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Panel, Screen, ScreenBody, ScreenHeader } from '@/components/layout/Page';
import { DailyGoalProgress } from '@/components/shared/DailyGoalProgress';
import { WeeklyRevisionBanner } from '@/components/shared/WeeklyRevisionBanner';
import { TodayTasks } from '@/components/tasks/TodayTasks';
import { CourseTodayCard } from '@/components/course/CourseTodayCard';
import { NextActionCard } from '@/components/today/NextActionCard';
import { SessionPlan } from '@/components/today/SessionPlan';
import { ReturnNotice } from '@/components/today/ReturnNotice';
import { PracticeIntentionsRail } from '@/components/today/PracticeIntentionsRail';
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
  selectTargetCompany,
  selectTargetCompanyCoverage,
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
 *
 * Composition: masthead, the day's own progress bar, then `PageColumns`. The work — hero and plan
 * — is the main column; the things that merely accompany a day (the other track, the learner's
 * own tasks, their standing routines, a company target) are the rail. Before this they were six
 * full-width bands below the hero, which is why a page with one recommendation on it ran to 2.4
 * viewports and put the day's own progress bar 1.7 screens from the top.
 *
 * There is still exactly one plate. The size difference between `Lead` and everything else *is*
 * the hierarchy, and moving blocks sideways does not license promoting any of them.
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
  const intentions = useAppSelector((s) => s.practice.intentions);
  const targetCompany = useAppSelector(selectTargetCompany);
  const targetCoverage = useAppSelector(selectTargetCompanyCoverage);

  const solvedToday = todayLog ? todayLog.solvedIds.length : 0;
  const minutesToday = todayLog ? todayLog.focusMinutes : 0;
  const activeToday = solvedToday > 0 || minutesToday > 0;

  // Shown only on a genuine return: two or more days away, and nothing logged yet today.
  const returning = daysAway !== null && daysAway >= 2 && !activeToday;
  const plannedMinutes = buildSession(capacityMin, ranked).totalMinutes;

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${format(parseISO(today), 'EEEE, MMMM d')} · Day ${currentDay} of ${totalDays}`}
        title="Today"
        support="One next action, sized to the time you have."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/focus">Focus mode</Link>
          </Button>
        }
      />

      {/* The day's own progress, directly under the masthead. It used to be the fifth block —
          1.7 viewports down — on the one page whose job is to report the day. A bar and its
          caption need no heading and no plate: "3 / 8 solved today" is its own label, and the bar
          already draws the only edge the block needs. */}
      <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />

      <ScreenBody cols="main-rail">
        {/* The work column. The hero is fixed-size; the plan is the one thing here that grows with
            the day, so it takes the leftover height in a `Panel` and scrolls inside itself. That is
            the sanctioned single content panel — the screen around it never moves. */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1">
          {/* Day-level framing, above the hero because it reframes the whole day rather than
              accompanying it. Both are rare and both are quiet. */}
          {isWeeklyDay && <WeeklyRevisionBanner count={revisionIds.length} />}
          {returning && <ReturnNotice daysAway={daysAway} plannedMinutes={plannedMinutes} />}

          {/* The screen's one plate. */}
          {ranked.length > 0 ? (
            <NextActionCard ranked={ranked} />
          ) : (
            <DayCleared solvedToday={solvedToday} minutesToday={minutesToday} />
          )}

          <Panel>
            <SessionPlan ranked={ranked} />
          </Panel>
        </div>

        {/* The context rail: the other track, the learner's own tasks, their standing routines, a
            company target. None of it is a decision, all of it accompanies the day. Main is first
            in the DOM, so below `lg` — and for every screen reader — the work still comes first. */}
        <aside
          aria-label="Today's context"
          className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
        >
          {/* The learner's own routines — a reminder, never a headline. In the rail it is beside
              the day rather than above the recommendation, which is where a reminder belongs. */}
          <PracticeIntentionsRail intentions={intentions} />

          <CourseTodayCard />

          <TodayTasks />

          {/* One quiet line while a company target is set, in the coverage vocabulary the company
              page already uses — never the weakness vocabulary, which is claimed in exactly one
              place, and never a readiness figure, which no evidence here could support. It is a
              pointer, not a recommendation. */}
          {targetCompany && targetCoverage && (
            <p className="text-sm text-muted-foreground">
              Preparing for {targetCompany.name}:{' '}
              <span className="figures">
                {targetCoverage.solved} of {targetCoverage.total}
              </span>{' '}
              solved across the {targetCoverage.patterns.length} patterns their own page names.{' '}
              <Link to={`/companies/${targetCompany.id}`} className="underline underline-offset-2">
                Open the set
              </Link>
              .
            </p>
          )}
        </aside>
      </ScreenBody>
    </Screen>
  );
}
