import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { BookOpen, CalendarClock, CheckCircle2, Dices, Gauge, Lightbulb, ListTodo, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DailyGoalProgress } from '@/components/shared/DailyGoalProgress';
import { StatCard } from '@/components/shared/StatCard';
import { Heatmap } from '@/components/shared/Heatmap';
import { EmptyState } from '@/components/shared/EmptyState';
import { LevelRing } from '@/components/gamification/LevelRing';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { XpBadge } from '@/components/gamification/XpBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { patternById } from '@/data/patterns';
import { quoteForDate } from '@/data/quotes';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectCourseDueReviewIds,
  selectCourseNextSession,
  selectCourseProjectedFinish,
  selectCourseStats,
  selectCurrentDay,
  selectEstimatedFinish,
  selectHeatmapData,
  selectLevelInfo,
  selectPatternStats,
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
  selectWeakestPatterns,
} from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';
import { seededRandomQuestion } from '@/utils/engine/recommendations';
import { formatMinutes } from '@/utils/engine/planner';

const heroVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

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
  const estFinish = useAppSelector((s) => selectEstimatedFinish(s, today));
  const productivity = useAppSelector((s) => selectProductivityScore(s, today));
  const weakest = useAppSelector(selectWeakestPatterns);
  const patternStats = useAppSelector(selectPatternStats);
  const revisionQueueIds = useAppSelector((s) => selectRevisionQueueIds(s, today));
  const todayLog = useAppSelector((s) => selectTodayLog(s, today));
  const courseStats = useAppSelector(selectCourseStats);
  const courseNext = useAppSelector(selectCourseNextSession);
  const courseFinish = useAppSelector((s) => selectCourseProjectedFinish(s, today));
  const courseDueReviews = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const todaysNew = useAppSelector(selectTodaysNewQuestions);
  const progressById = useAppSelector((s) => s.progress.byId);
  // The same ranked list Today's hero and session plan read — see the "Up next" plate below.
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

  const weakestEntry = weakest[0] ?? null;
  const weakestStat = weakestEntry ? patternStats.find((s) => s.pattern === weakestEntry.pattern) : undefined;

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  function handleRandomQuestion() {
    const question = seededRandomQuestion(questions, today);
    dispatch(activeQuestionSet(question.id));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Visually hidden — keeps the page's accessible heading name stable ("Dashboard") while
          the hero below carries the actual visual heading (day counter). */}
      <h1 className="sr-only">Dashboard</h1>

      <motion.div className="flex flex-col gap-6" variants={heroVariants} initial="hidden" animate="show">
        {/* Row 1: hero */}
        <motion.div
          variants={itemVariants}
          className="glass grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center"
        >
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
                Day {currentDay}{' '}
                <span className="text-[0.55em] font-normal italic text-muted-foreground">of {totalDays}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{format(parseISO(today), 'EEEE, MMMM d, yyyy')}</p>
            </div>

            <p className="max-w-prose border-l border-border pl-3 font-serif italic text-muted-foreground">
              {quoteForDate(today)}
            </p>

            {roadmapComplete ? (
              <p className="text-lg font-semibold">Roadmap complete — every question solved.</p>
            ) : currentQuestion && currentPattern ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">You&apos;re in:</span>
                <PatternChip pattern={currentPattern} />
                <DifficultyBadge difficulty={currentQuestion.difficulty} />
              </div>
            ) : null}

            {/* The semester arc as a quiet ruled bar — the contract's first-viewport progress. */}
            <div className="flex flex-col gap-1.5">
              <Progress value={completionPct} aria-label="Roadmap completion" />
              <p className="figures text-xs text-muted-foreground">
                {solvedCount} of {totalQuestions} solved
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link to="/today">Go to Today</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleRandomQuestion}>
                <Dices /> Random question
              </Button>
            </div>
          </div>

          <div className="flex flex-row items-center justify-center gap-4 lg:flex-col lg:items-end">
            <div className="flex flex-col items-center gap-1">
              <StreakFlame current={streaks.current} />
              <span className="text-xs text-muted-foreground">Longest: {streaks.longest}</span>
            </div>
            <LevelRing level={levelInfo.level} intoLevel={levelInfo.intoLevel} needed={levelInfo.needed} size={80} />
            <XpBadge xp={xp} />
          </div>
        </motion.div>

        {/* Row 2: stat cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Solved" value={`${solvedCount} / ${totalQuestions}`} icon={CheckCircle2} />
          <StatCard label="Remaining" value={remaining} icon={ListTodo} />
          <StatCard label="Completion" value={`${completionPct}%`} icon={BookOpen} />
          <StatCard
            label="Revisions Due"
            value={revisionQueueIds.length + courseDueReviews.length}
            icon={RotateCcw}
            accent={revisionQueueIds.length + courseDueReviews.length > 0}
          />
          <StatCard label="Est. Finish" value={format(parseISO(estFinish), 'MMM d')} icon={CalendarClock} />
          <StatCard label="Productivity" value={`${productivity} / 100`} icon={Gauge} />
        </motion.div>

        {/* Row 3: the AI/ML track, one quiet plate beside the DSA world. */}
        <motion.div variants={itemVariants} className="glass flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2">
            <h2 className="text-base font-medium">AI/ML Course</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/aiml">Continue</Link>
            </Button>
          </div>
          <Progress value={courseStats.pct} aria-label="AI/ML course completion" />
          <p className="figures text-sm text-muted-foreground">
            {courseStats.sessionsDone} / {courseStats.sessionsTotal} sessions
            {courseNext &&
              courseWeekById.get(courseNext.weekId) &&
              ` · next: Week ${courseWeekById.get(courseNext.weekId)!.week} — ${courseWeekById.get(courseNext.weekId)!.title}`}
            {courseFinish && ` · finish ${format(parseISO(courseFinish), 'MMM d')}`}
            {courseDueReviews.length > 0 &&
              ` · ${courseDueReviews.length} review${courseDueReviews.length === 1 ? '' : 's'} due`}
            {courseNext === null && ' · complete'}
          </p>
        </motion.div>

        {/* Row 4 */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass flex flex-col gap-3 p-5">
            <h2 className="border-b border-border/70 pb-2 text-base font-medium">Today&apos;s Progress</h2>
            <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />
          </div>

          <div className="glass flex flex-col gap-3 p-5">
            <h2 className="border-b border-border/70 pb-2 text-base font-medium">Weakest Pattern</h2>
            {weakestEntry && weakestStat ? (
              <>
                <p className="text-lg font-semibold">{patternById[weakestEntry.pattern].name}</p>
                <p className="text-sm text-muted-foreground">{weakestStat.pct}% solved</p>
                <Button asChild size="sm" variant="outline" className="self-start">
                  <Link to={`/patterns/${weakestEntry.pattern}`}>Practice this</Link>
                </Button>
              </>
            ) : (
              <EmptyState icon={Gauge} title="Not enough data yet" />
            )}
          </div>

          {/* Reads the same ranked list Today's hero and session plan read. The Dashboard used
              to run a second, category-level recommender, which could tell the learner to
              "practice your weakest pattern" while Today told them to revise a specific
              question — two surfaces disagreeing about the same decision. One ranker now. */}
          <div className="glass flex flex-col gap-3 p-5">
            <h2 className="border-b border-border/70 pb-2 text-base font-medium">Up next</h2>
            {ranked.length === 0 ? (
              <EmptyState icon={Lightbulb} title="Today's plan is clear" />
            ) : (
              <ul className="flex flex-col gap-3">
                {ranked.slice(0, 3).map((item, index) => (
                  <li key={item.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="figures text-xs text-muted-foreground">{index + 1}</span>
                      {item.questionId !== undefined ? (
                        <button
                          type="button"
                          onClick={() => openQuestion(item.questionId!)}
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
                        >
                          {item.title}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(item.href)}
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
                        >
                          {item.title}
                        </button>
                      )}
                      <span className="figures shrink-0 text-xs text-muted-foreground">
                        ~{formatMinutes(item.minutes)}
                      </span>
                    </div>
                    <p className="pl-5 text-xs text-muted-foreground">{item.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        {/* Row 5: heatmap */}
        <motion.div variants={itemVariants} className="glass p-5">
          <h2 className="mb-3 border-b border-border/70 pb-2 text-base font-medium">Activity</h2>
          <Heatmap data={heatmapData} onSelectDate={(date) => navigate('/calendar', { state: { date } })} />
        </motion.div>
      </motion.div>
    </div>
  );
}
