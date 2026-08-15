import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Heatmap } from '@/components/shared/Heatmap';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { XpBadge } from '@/components/gamification/XpBadge';
import { NextActionCard } from '@/components/today/NextActionCard';
import type { FigureItem, LedgerItem } from '@/components/layout/Page';
import {
  Figures,
  Ledger,
  Meta,
  Page,
  PageColumns,
  PageHeader,
  RuledItem,
  RuledList,
  Section,
} from '@/components/layout/Page';
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
 * Dashboard — the command surface.
 *
 * It used to be a report: eight full-width bands of descending importance, stacked head to toe, so
 * the first thing a learner saw on opening the app was a masthead, a poem and four figures, and
 * the first thing they could *act on* began 818px down, in the smallest type register on the page.
 * A page that answers "how are things going" but not "what do I do" hands the prioritising back to
 * the person who opened it in order to avoid prioritising.
 *
 * It now answers four questions, in this order and at this weight:
 *
 *   1. **What should I do?** — the `Lead`, and the only plate. It is `NextActionCard`, the exact
 *      component Today uses, reading the exact list Today reads (`selectRankedWork`). This is not
 *      a second recommender: CLAUDE.md's invariant is one *ranker*, and there is still one. What
 *      changed is that the landing surface stopped refusing to show its answer.
 *   2. **Why?** — the hero's own reason line, then the two items behind it.
 *   3. **Where am I?** — one `Figures` line and a bar, in the main column under the work.
 *   4. **What needs attention?** — the rail, top-first: the weakest pattern, then the record.
 *
 * Composition is `PageColumns`: work on the left, context on the right. Everything in the rail was
 * previously a full-width band competing with the decision above it; none of it is gone, and none
 * of it is a plate. The activity year sits below the grid at full width because it is 792px of
 * reference data and a rail would make it scroll sideways.
 *
 * Deliberately absent: an overdue-debt counter. `revision.test.tsx` pins the rule that a due
 * backlog is never promoted to a headline, and a red number on the landing page is that headline
 * by another name. Attention is carried by the hero's reason, which already says what is at risk.
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
  // The one ranked list. Today's hero, Today's session plan and this page's hero all read it.
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
  // items pulled forward whose next review is still in the future.
  //
  // It is labelled "Reviews queued", NOT "Revisions queued", and the one word is the whole point.
  // This number spans both ladders (questions + course weeks); Today's weekly banner says
  // "N revisions queued" counting the question ladder alone. The two were rendering the identical
  // phrase over two different totals, so on any weekly day with course work due, Today said 12 and
  // Dashboard said 15 about what read as the same fact. The `sub` below already separates the two
  // ladders; the label now stops claiming to be the same sentence Today prints.
  const queuedTotal = revisionQueueIds.length + courseDueReviews.length;
  const courseNextWeek = courseNext ? courseWeekById.get(courseNext.weekId) : undefined;

  // Projected finish, with the basis it was computed from — a figure taken from the
  // questions-per-day setting must not be labelled "your current pace", and once the roadmap is
  // finished there is no estimate to make, so the cell leaves rather than renders today's date.
  const finish = useMemo(
    () => finishProjection(today, remaining, dayLogs, perDay, startDate),
    [today, remaining, dayLogs, perDay, startDate],
  );

  // Orientation, as one line rather than as a row of monuments. These three facts describe one
  // thing — how far through the course you are — so they read as one sentence. The `Ledger` voice
  // (1.75rem serif) is reserved for the rail's record, where the number genuinely is the point.
  const standing: FigureItem[] = [
    { value: `${solvedCount} / ${totalQuestions}`, label: 'solved' },
    { value: `${completionPct}%`, label: 'complete' },
    { value: remaining, label: 'to go' },
  ];

  // The record. Two counted facts that the learner checks rather than acts on, so they sit in the
  // rail — and only two, because a third and fourth at the same weight is the stat-card wall
  // wearing hairlines instead of borders.
  const ledgerItems: LedgerItem[] = [
    {
      label: 'Reviews queued',
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

  // The hero takes ranked[0]; this is what is behind it. Two rows, not five — the point of a
  // command surface is that the queue is visible, not that it is exhaustive. /today owns the
  // full plan and /revision owns the full queue.
  const behind = ranked.slice(1, 3);

  return (
    <Page width="wide">
      {/* The date rides the eyebrow beside the day number, exactly as Today's masthead sets it.
          It was the `support` line — a second register for one fact, in the slot reserved for
          "what this page is for" — which cost 32px above the hero and made the two landing
          surfaces open in two different shapes for no reason a reader could name. */}
      <PageHeader
        eyebrow={`${format(parseISO(today), 'EEEE, MMMM d')} · Day ${currentDay} of ${totalDays}`}
        title="Dashboard"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/today">Open Today</Link>
          </Button>
        }
      />

      <PageColumns railLabel="Standing and record" rail={<>
        {/* Attention first. A pattern only appears here after repeated negative evidence, so its
            presence is itself the signal — which is why it opens the rail rather than sitting
            fifth in a stack of equally-weighted bands. */}
        <Section
          title="Weakest pattern"
          // States its basis as well as its threshold. The compressed version kept "repeated
          // negative evidence" but dropped what the evidence *is*, which leaves the page naming a
          // learner's weakest pattern without saying what measured it — the one claim on this
          // surface that most needs its provenance attached.
          support="Measured from recall, drills and pace — named only after repeated negative evidence."
          action={
            weakestEntry ? (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/patterns/${weakestEntry.id}`}>Practise</Link>
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
              <p className="text-sm text-muted-foreground">{weakestEntry.summary}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing has enough evidence against it yet. Recall failures, drill misses and slow
              solves are what score a pattern here.
            </p>
          )}
        </Section>

        <Section title="The record">
          <Ledger items={ledgerItems} columns={2} />
          <Meta items={[<>Productivity <span className="figures">{productivity} / 100</span></>, 'last 14 days']} />
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
              <>
                <span className="figures">
                  {courseStats.sessionsDone} / {courseStats.sessionsTotal}
                </span>{' '}
                sessions
              </>,
              courseNextWeek && `Next: Week ${courseNextWeek.week} — ${courseNextWeek.title}`,
              courseFinish && `Finish ${formatProjection(courseFinish, today)}`,
              courseDueReviews.length > 0 &&
                `${courseDueReviews.length} review${courseDueReviews.length === 1 ? '' : 's'} due`,
              courseNext === null && 'Complete',
            ]}
          />
        </Section>

        {/* The epigraph. A rail, not a plate — one reflection is not a component. The corpus rule
            (src/data/reflections.ts) is absolute: a quotation shows its verbatim text and its
            attribution; an original note shows no attribution at all. One line per day, never
            more. It closes the context column, which is where a marginal note belongs. */}
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="font-serif italic text-muted-foreground">{reflection.text}</blockquote>
          {reflection.attribution && (
            <figcaption className="mt-1 text-xs text-muted-foreground">— {reflection.attribution}</figcaption>
          )}
        </figure>
      </>}>
        {/* The page's one plate, and the first thing in the reading order. */}
        {ranked.length > 0 ? (
          <NextActionCard ranked={ranked} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Today&apos;s plan is clear — nothing is queued.
          </p>
        )}

        {behind.length > 0 && (
          <Section
            title="Behind it"
            action={
              <Button variant="ghost" size="sm" onClick={handleRandomQuestion}>
                <Dices /> Random question
              </Button>
            }
          >
            <RuledList>
              {behind.map((item) => (
                <RuledItem key={item.id} padded={false}>
                  {/* The row's own control carries the padding, so the hover and focus surfaces
                      fill the row they appear to fill — and the tap target is the full 44px rather
                      than the height of the text inside it. */}
                  <button
                    type="button"
                    onClick={() => openWork(item)}
                    className="flex w-full min-h-11 flex-col gap-0.5 py-2.5 text-left transition-colors duration-150 ease-swift hover:text-primary"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                      <span className="figures shrink-0 text-xs text-muted-foreground">
                        ~{formatMinutes(item.minutes)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{item.why}</span>
                  </button>
                </RuledItem>
              ))}
            </RuledList>
          </Section>
        )}

        {/* Where am I — one section, not a parent heading over two subsections over two bars.
            The old shape spent ~150px of heading machinery to deliver 16px of data. */}
        <Section title="Progress" aria-label="Progress">
          <Figures items={standing} />
          <Progress value={completionPct} aria-label="Roadmap completion" />
          {roadmapComplete ? (
            <p className="text-sm font-medium">Roadmap complete — every question solved.</p>
          ) : currentQuestion && currentPattern ? (
            // The roadmap position, which is not the same fact as the hero's pattern: the next
            // best action is often a recall of something learned weeks ago, while this says where
            // the course itself has got to.
            <Meta
              items={[
                <>
                  You&apos;re in: <span className="text-foreground">{currentPattern.name}</span>
                </>,
                // The difficulty inks, like everywhere else. This line printed the bare word with
                // no difficulty token at all — the one place in the app where difficulty rendered
                // as plain text. `bare` because it sits in a `Meta` line.
                <DifficultyBadge difficulty={currentQuestion.difficulty} variant="bare" />,
              ]}
            />
          ) : null}
          {/* `DailyGoalProgress` is deliberately NOT here. It is Today's frame — the same bar with
              the same "N / M solved today" caption, from the same two selectors — and Today puts
              it in its first 300px. Rendering it under Dashboard's roadmap-scale bar stacked two
              progress bars 16px apart with one heading over both, which reads as one bar drawn
              twice rather than as two different denominators. This section answers "how far
              through the course am I"; the day is Today's question. */}
        </Section>
      </PageColumns>

      {/* Full width, below the grid, and last. The year is 792px of reference data: in a rail it
          would scroll sideways, and in the main column it would be the largest object on a page
          whose largest object should be the decision. */}
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
            <>Longest <span className="figures">{streaks.longest}</span></>,
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
