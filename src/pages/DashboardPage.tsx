import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DailyGoalProgress } from '@/components/shared/DailyGoalProgress';
import { Heatmap } from '@/components/shared/Heatmap';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { XpBadge } from '@/components/gamification/XpBadge';
import type { LedgerItem } from '@/components/layout/Page';
import { Ledger, Meta, Page, PageHeader, RuledItem, RuledList, Section } from '@/components/layout/Page';
import { patternById } from '@/data/patterns';
import { reflectionForDate } from '@/data/reflections';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectCourseDueReviewIds,
  selectCourseNextSession,
  selectCourseProjectedFinish,
  selectCourseStats,
  selectCurrentDay,
  selectDaysAway,
  selectHeatmapData,
  selectLevelInfo,
  selectPerDay,
  selectProductivityScore,
  selectQuestions,
  selectRankedWork,
  selectRevisionQueueIds,
  selectSolvedNewCount,
  selectStreaks,
  selectTodayLog,
  selectTodaysNewQuestions,
  selectTotalDays,
  selectPatternWeakness,
} from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';
import { seededRandomQuestion } from '@/utils/engine/recommendations';
import { formatMinutes, formatProjection } from '@/utils/engine/planner';
import { finishProjection } from '@/utils/engine/roadmap';
import type { WorkItem } from '@/utils/engine/nextAction';

/**
 * Dashboard — the overview, read as one document rather than a wall of plates.
 *
 * The page has one purpose: where does the whole course stand today. It deliberately does not
 * compete with Today for "what do I do next" — Today owns that decision, and the masthead's one
 * action hands off to it. Everything here is the record: a figure band, then open sections for
 * progress, the queue, the weak spot, the other track, and the year of activity.
 *
 * Composition follows DESIGN.md § Composition: the ground is the surface, sections are separated
 * by space rather than by outlines, counted facts live in a `Ledger` instead of stat cards, and
 * gamification is context at the foot of the page rather than three objects above the fold. There
 * is no `Lead` plate, because a page whose job is "look at the state of things" has no single
 * action worth that much size.
 */
export default function DashboardPage() {
  const today = useToday();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const questions = selectQuestions();
  const currentDay = useAppSelector(selectCurrentDay);
  const totalDays = useAppSelector(selectTotalDays);
  const solvedCount = useAppSelector(selectSolvedNewCount);
  const perDay = useAppSelector(selectPerDay);
  const levelInfo = useAppSelector(selectLevelInfo);
  const xp = useAppSelector((s) => s.gamification.xp);
  const streaks = useAppSelector((s) => selectStreaks(s, today));
  const heatmapData = useAppSelector((s) => selectHeatmapData(s, today));
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const startDate = useAppSelector((s) => s.progress.startDate);
  const productivity = useAppSelector((s) => selectProductivityScore(s, today));
  const weakest = useAppSelector((s) => selectPatternWeakness(s, today));
  const revisionQueueIds = useAppSelector((s) => selectRevisionQueueIds(s, today));
  const todayLog = useAppSelector((s) => selectTodayLog(s, today));
  const daysAway = useAppSelector((s) => selectDaysAway(s, today));
  const courseStats = useAppSelector(selectCourseStats);
  const courseNext = useAppSelector(selectCourseNextSession);
  const courseFinish = useAppSelector((s) => selectCourseProjectedFinish(s, today));
  const courseDueReviews = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const todaysNew = useAppSelector(selectTodaysNewQuestions);
  const progressById = useAppSelector((s) => s.progress.byId);
  // The same ranked list Today's hero and session plan read — see the "Up next" section below.
  const ranked = useAppSelector((s) => selectRankedWork(s, today));

  const totalQuestions = questions.length;
  const remaining = totalQuestions - solvedCount;
  const completionPct = totalQuestions > 0 ? Math.round((solvedCount / totalQuestions) * 100) : 0;
  const roadmapComplete = solvedCount >= totalQuestions;

  // First not-yet-solved question in today's slice; falls back to the slice's first entry, or
  // to nothing at all once the whole roadmap is solved (handled by the roadmapComplete branch).
  const currentQuestion = roadmapComplete
    ? null
    : (todaysNew.find((q) => (progressById[q.id]?.status ?? 'unsolved') !== 'solved') ?? todaysNew[0] ?? null);
  const currentPattern = currentQuestion ? patternById[currentQuestion.pattern] : null;

  const solvedToday = todayLog ? todayLog.solvedIds.length : 0;

  // Same gate as Today's ReturnNotice: two or more days away, nothing logged yet today. The
  // epigraph swaps its pool on a genuine return — it never adds a second line.
  const minutesToday = todayLog ? todayLog.focusMinutes : 0;
  const returning = daysAway !== null && daysAway >= 2 && solvedToday === 0 && minutesToday === 0;
  const reflection = reflectionForDate(today, returning);

  const weakestEntry = weakest[0] ?? null;

  // The revision figure is the *queue*, not the due set: on a weekly revision day it includes
  // items pulled forward whose next review is still in the future. Today says "N revisions
  // queued" for this same number, and the label here says the same word for the same reason.
  const queuedTotal = revisionQueueIds.length + courseDueReviews.length;
  const courseNextWeek = courseNext ? courseWeekById.get(courseNext.weekId) : undefined;

  // Projected finish, with the basis it was computed from — a figure taken from the
  // questions-per-day setting must not be labelled "your current pace", and once the roadmap is
  // finished there is no estimate to make, so the cell leaves rather than renders today's date.
  const finish = useMemo(
    () => finishProjection(today, remaining, dayLogs, perDay, startDate),
    [today, remaining, dayLogs, perDay, startDate],
  );

  const ledgerItems: LedgerItem[] = [
    {
      label: 'Solved',
      value: `${solvedCount} / ${totalQuestions}`,
      sub: `${completionPct}% · ${remaining} to go`,
    },
    {
      label: 'Revisions queued',
      value: queuedTotal,
      sub:
        queuedTotal === 0
          ? 'nothing queued today'
          : `${revisionQueueIds.length} question${revisionQueueIds.length === 1 ? '' : 's'} · ${courseDueReviews.length} course`,
    },
    ...(finish.date !== null
      ? [
          {
            label: 'Est. finish',
            value: formatProjection(finish.date, today),
            sub: finish.basis === 'measured' ? 'at your current pace' : 'at your target pace',
          },
        ]
      : []),
    {
      label: 'Productivity',
      value: `${productivity} / 100`,
      sub: 'last 14 days',
    },
  ];

  function openWork(item: WorkItem) {
    if (item.questionId !== undefined) {
      dispatch(activeQuestionSet(item.questionId));
      return;
    }
    navigate(item.href);
  }

  function handleRandomQuestion() {
    const question = seededRandomQuestion(questions, today);
    dispatch(activeQuestionSet(question.id));
  }

  return (
    <Page>
      <PageHeader
        eyebrow={`Day ${currentDay} of ${totalDays}`}
        title="Dashboard"
        support={`${format(parseISO(today), 'EEEE, MMMM d, yyyy')}. Today carries the plan; this page keeps the record.`}
        action={
          <Button asChild size="sm">
            <Link to="/today">Go to Today</Link>
          </Button>
        }
      />

      {/* The epigraph. A rail, not a plate — one reflection is not a component. The corpus rule
          (src/data/reflections.ts) is absolute: a quotation shows its verbatim text and its
          attribution; an original note shows no attribution at all. One line per day, never more. */}
      <figure className="max-w-prose border-l-2 border-border pl-4">
        <blockquote className="font-serif italic text-muted-foreground">{reflection.text}</blockquote>
        {reflection.attribution && (
          <figcaption className="mt-1 text-xs text-muted-foreground">— {reflection.attribution}</figcaption>
        )}
      </figure>

      <Ledger items={ledgerItems} columns={ledgerItems.length === 3 ? 3 : 4} />

      <Section title="Progress">
        <Section
          level={3}
          title="Roadmap"
          action={
            <p className="figures text-xs text-muted-foreground">
              {solvedCount} of {totalQuestions} solved · {completionPct}%
            </p>
          }
        >
          {/* The semester arc as a quiet ruled bar — the contract's first-viewport progress. */}
          <Progress value={completionPct} aria-label="Roadmap completion" />
          {roadmapComplete ? (
            <p className="text-sm font-medium">Roadmap complete — every question solved.</p>
          ) : currentQuestion && currentPattern ? (
            // Pattern and difficulty describe one object — the question you are standing on — so
            // they read as one line rather than as two chips.
            <Meta
              items={[
                <>
                  You&apos;re in: <span className="text-foreground">{currentPattern.name}</span>
                </>,
                <span className="capitalize">{currentQuestion.difficulty}</span>,
              ]}
            />
          ) : null}
        </Section>

        <Section level={3} title="Today">
          <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />
        </Section>
      </Section>

      {/* Reads the same ranked list Today's hero and session plan read. The Dashboard used to run
          a second, category-level recommender, which could tell the learner to "practice your
          weakest pattern" while Today told them to revise a specific question — two surfaces
          disagreeing about the same decision. One ranker now. */}
      <Section
        title="Up next"
        support="The top of the same queue Today works from."
        action={
          <Button variant="ghost" size="sm" onClick={handleRandomQuestion}>
            <Dices /> Random question
          </Button>
        }
      >
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Today&apos;s plan is clear.</p>
        ) : (
          <RuledList>
            {ranked.slice(0, 3).map((item, index) => (
              <RuledItem key={item.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3">
                  <span className="figures text-xs text-muted-foreground">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => openWork(item)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
                  >
                    {item.title}
                  </button>
                  <span className="figures shrink-0 text-xs text-muted-foreground">
                    ~{formatMinutes(item.minutes)}
                  </span>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">{item.why}</p>
              </RuledItem>
            ))}
          </RuledList>
        )}
      </Section>

      <Section
        title="Weakest pattern"
        support="Measured from recall, drills and pace — a pattern needs repeated negative evidence before it is named at all."
        action={
          weakestEntry ? (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/patterns/${weakestEntry.id}`}>Practice this</Link>
            </Button>
          ) : undefined
        }
      >
        {weakestEntry ? (
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium">{weakestEntry.name}</p>
            {/* The model's own because-clause, not a coverage figure. Low coverage is not
                weakness: an unstarted pattern is unmeasured, and saying otherwise sent learners
                to practise the thing they had simply not reached yet. */}
            <p className="max-w-prose text-sm text-muted-foreground">{weakestEntry.summary}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing has enough evidence against it yet. Recall failures, drill misses and slow
            solves are what score a pattern here.
          </p>
        )}
      </Section>

      <Section
        title="AI/ML course"
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/aiml">Continue</Link>
          </Button>
        }
      >
        <Progress value={courseStats.pct} aria-label="AI/ML course completion" />
        <Meta
          items={[
            <span className="figures">
              {courseStats.sessionsDone} / {courseStats.sessionsTotal} sessions
            </span>,
            courseNextWeek && `Next: Week ${courseNextWeek.week} — ${courseNextWeek.title}`,
            courseFinish && `Finish ${formatProjection(courseFinish, today)}`,
            courseDueReviews.length > 0 &&
              `${courseDueReviews.length} review${courseDueReviews.length === 1 ? '' : 's'} due`,
            courseNext === null && 'Complete',
          ]}
        />
      </Section>

      {/* Gamification is context, not the lead: one quiet line under the year of activity it
          actually describes, rather than three competing objects in the first screenful. */}
      <Section
        divider
        title="Activity"
        support="Solves, revisions and course sessions over the last year."
      >
        <Meta
          items={[
            <span className="inline-flex items-center gap-1.5">
              <StreakFlame current={streaks.current} /> day streak
            </span>,
            <span className="figures">Longest {streaks.longest}</span>,
            <span>
              Level {levelInfo.level},{' '}
              <span className="figures">
                {levelInfo.intoLevel} / {levelInfo.needed}
              </span>{' '}
              XP to the next
            </span>,
            <XpBadge xp={xp} />,
          ]}
        />
        <Heatmap data={heatmapData} onSelectDate={(date) => navigate('/calendar', { state: { date } })} />
      </Section>
    </Page>
  );
}
