import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Page, PageHeader, Section } from '@/components/layout/Page';
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
 * Composition: masthead, then exactly one plate — the next action — then open sections. The page
 * previously stacked five bordered boxes of near-identical weight (goal bar, plan, course, tasks,
 * and a solid-ink weekly banner sitting *above* the hero), so the recommendation the whole surface
 * exists to deliver was one rectangle among many. There is now a single `Lead` and nothing else
 * may match it; the size difference is the hierarchy. See DESIGN.md § Composition.
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
    <Page>
      <PageHeader
        eyebrow={`${format(parseISO(today), 'EEEE, MMMM d')} · Day ${currentDay} of ${totalDays}`}
        title="Today"
        support="One recommendation at a time, and a plan cut to the hours you actually have."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/focus">Focus mode</Link>
          </Button>
        }
      />

      {/* Day-level context, grouped so two notes never sit a full section apart. Both are quiet
          by design: neither is more important than the recommendation below them. */}
      {(isWeeklyDay || returning || intentions.length > 0) && (
        <div className="flex flex-col gap-5">
          {isWeeklyDay && <WeeklyRevisionBanner count={revisionIds.length} />}
          {returning && <ReturnNotice daysAway={daysAway} plannedMinutes={plannedMinutes} />}
          {/* The learner's own routines, quiet above the hero — a reminder, never a headline, and
              never more prominent than the day's one recommendation below it. */}
          <PracticeIntentionsRail intentions={intentions} />
        </div>
      )}

      {/* The page's one plate. */}
      {ranked.length > 0 ? (
        <NextActionCard ranked={ranked} />
      ) : (
        <DayCleared solvedToday={solvedToday} minutesToday={minutesToday} />
      )}

      <SessionPlan ranked={ranked} />

      {/* A bar and its caption, ruled off. It needs no heading — "3 / 8 solved today" is its own
          label — and no box, because a progress bar already draws one edge and a plate would add
          a second. */}
      <Section aria-label="Daily goal" divider>
        <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />
      </Section>

      <CourseTodayCard />

      {/* One quiet line while a company target is set, in the coverage vocabulary the company page
          already uses — never the weakness vocabulary, which is claimed in exactly one place, and
          never a readiness figure, which no evidence here could support. It is a pointer, not a
          recommendation: the day's one recommendation is above, and a second thing competing with
          it is the failure the hero exists to prevent. */}
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

      <TodayTasks />

      <p className="text-sm text-muted-foreground">
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
    </Page>
  );
}
