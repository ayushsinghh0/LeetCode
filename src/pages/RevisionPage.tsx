import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Award, CheckCircle2, Clock, GraduationCap, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { WeeklyRevisionBanner } from '@/components/shared/WeeklyRevisionBanner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { PatternChip } from '@/components/questions/PatternChip';
import { CourseReviewList } from '@/components/course/CourseReviewList';
import { patternById } from '@/data/patterns';
import { CORE_WEEKS } from '@/data/aimlCourse';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectCourseDueReviewIds,
  selectForecast,
  selectIsWeeklyDay,
  selectQuestionById,
  selectRevisionQueueIds,
} from '@/store/selectors';
import { overallRevisionPassRate } from '@/utils/engine/stats';
import { initialProgress, isMastered } from '@/utils/engine/spacedRepetition';
import { initialCourseProgress, isWeekDone, isWeekRetained } from '@/utils/engine/aimlCourse';
import { addDays, diffDays } from '@/utils/dates';
import { overdueLabel } from '@/utils/overdueLabel';
import type { Question } from '@/types';

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const PASSED_THIS_WEEK_DAYS = 7;
const UPCOMING_HORIZON_DAYS = 30;

export default function RevisionPage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const isWeeklyDay = useAppSelector(selectIsWeeklyDay);
  const revisionIds = useAppSelector((state) => selectRevisionQueueIds(state, today));
  const courseDueIds = useAppSelector((state) => selectCourseDueReviewIds(state, today));
  const forecast = useAppSelector((state) => selectForecast(state, today));
  // Single subscription to the whole byId map — every derived list below reads its own entries
  // out of it, instead of each row mounting its own useAppSelector (same pattern as TodayPage).
  const progressById = useAppSelector((state) => state.progress.byId);
  const courseByWeekId = useAppSelector((state) => state.course.byWeekId);
  const dayLogs = useAppSelector((state) => state.progress.dayLogs);

  const openDetail = (id: number) => dispatch(activeQuestionSet(id));

  const revisionQuestions = revisionIds
    .map((id) => selectQuestionById(id))
    .filter((q): q is Question => q !== undefined);

  const dueCount = revisionIds.length + courseDueIds.length;

  // Question revisions come from the day ledger; course review grades from week histories.
  const passedThisWeek = useMemo(() => {
    let count = 0;
    const windowStart = addDays(today, -(PASSED_THIS_WEEK_DAYS - 1));
    for (let i = 0; i < PASSED_THIS_WEEK_DAYS; i++) {
      const log = dayLogs[addDays(today, -i)];
      if (log) count += log.revisionsPassed.length;
    }
    for (const progress of Object.values(courseByWeekId)) {
      for (const review of progress.revisionHistory) {
        if (review.passed && review.date >= windowStart && review.date <= today) count++;
      }
    }
    return count;
  }, [dayLogs, courseByWeekId, today]);

  const passRate = overallRevisionPassRate([
    ...Object.values(progressById),
    ...Object.values(courseByWeekId),
  ]);
  const passRateLabel = passRate === null ? '—' : `${Math.round(passRate * 100)}%`;

  const masteredQuestions = useMemo(
    () =>
      Object.entries(progressById)
        .filter(([, p]) => isMastered(p))
        .map(([id]) => selectQuestionById(Number(id)))
        .filter((q): q is Question => q !== undefined)
        .sort((a, b) => a.id - b.id),
    [progressById],
  );

  const retainedWeeks = useMemo(
    () => CORE_WEEKS.filter((week) => isWeekRetained(courseByWeekId[week.id] ?? initialCourseProgress())),
    [courseByWeekId],
  );

  // Cleared, unretained weeks whose review lands strictly after today, within the horizon.
  const upcomingCourseByDate = useMemo(() => {
    const map: Record<string, { weekId: string; label: string }[]> = {};
    const horizonEnd = addDays(today, UPCOMING_HORIZON_DAYS);
    for (const week of CORE_WEEKS) {
      const progress = courseByWeekId[week.id] ?? initialCourseProgress();
      if (!isWeekDone(week, progress) || isWeekRetained(progress)) continue;
      if (progress.nextRevision === null || progress.nextRevision <= today || progress.nextRevision > horizonEnd) continue;
      const list = map[progress.nextRevision] ?? (map[progress.nextRevision] = []);
      list.push({ weekId: week.id, label: `Week ${week.week} — ${week.title}` });
    }
    return map;
  }, [courseByWeekId, today]);

  // Actual currently-scheduled questions per date, for solved-not-mastered items whose
  // nextRevision falls strictly after today and within the forecast horizon. The forecast
  // (selectForecast) simulates hypothetical future passes too, so its per-day counts can exceed
  // the number of actual titles found here for the same date — both are shown side by side.
  const upcomingByDate = useMemo(() => {
    const map: Record<string, { id: number; title: string }[]> = {};
    const horizonEnd = addDays(today, UPCOMING_HORIZON_DAYS);
    for (const [idStr, p] of Object.entries(progressById)) {
      if (p.status !== 'solved' || isMastered(p) || p.nextRevision === null) continue;
      if (p.nextRevision <= today || p.nextRevision > horizonEnd) continue;
      const question = selectQuestionById(Number(idStr));
      if (!question) continue;
      const list = map[p.nextRevision] ?? (map[p.nextRevision] = []);
      list.push({ id: question.id, title: question.title });
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.id - b.id);
    return map;
  }, [progressById, today]);

  const forecastByDate = useMemo(() => new Map(forecast.map((d) => [d.date, d.count])), [forecast]);
  const upcomingDates = useMemo(
    () =>
      [
        ...new Set([
          ...forecast.filter((d) => d.count > 0).map((d) => d.date),
          ...Object.keys(upcomingCourseByDate),
        ]),
      ].sort(),
    [forecast, upcomingCourseByDate],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-gradient">Revision</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Due now" value={dueCount} icon={Clock} />
          <StatCard label="Passed this week" value={passedThisWeek} icon={CheckCircle2} />
          <StatCard label="Overall pass rate" value={passRateLabel} icon={TrendingUp} />
          <StatCard label="Mastered" value={masteredQuestions.length + retainedWeeks.length} icon={Award} />
        </div>
      </header>

      {isWeeklyDay && <WeeklyRevisionBanner count={revisionIds.length} />}

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">Due Today ({dueCount})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="mastered">Mastered</TabsTrigger>
        </TabsList>

        <TabsContent value="due">
          {revisionQuestions.length === 0 && courseDueIds.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing due — future you says thanks" />
          ) : (
            <div className="flex flex-col gap-4">
              {revisionQuestions.length > 0 && (
                <motion.div
                  className="grid grid-cols-1 gap-4 xl:grid-cols-2"
                  variants={gridVariants}
                  initial="hidden"
                  animate="show"
                >
                  {revisionQuestions.map((question) => {
                    const progress = progressById[question.id] ?? initialProgress();
                    const overdueDays = progress.nextRevision ? diffDays(today, progress.nextRevision) : 0;
                    return (
                      <motion.div key={question.id} variants={cardVariants} className="relative">
                        {overdueDays > 0 && (
                          <Badge
                            variant="outline"
                            className="absolute right-3 top-3 z-10 border-medium bg-medium/15 text-medium"
                          >
                            {overdueLabel(overdueDays)}
                          </Badge>
                        )}
                        <QuestionCard question={question} progress={progress} context="revision" onOpenDetail={openDetail} />
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {courseDueIds.length > 0 && (
                <section className="glass flex flex-col gap-3 p-4" aria-label="Course reviews">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Course reviews</h2>
                    <Badge variant="secondary">{courseDueIds.length}</Badge>
                  </div>
                  <CourseReviewList weekIds={courseDueIds} byWeekId={courseByWeekId} />
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {upcomingDates.length === 0 ? (
            <EmptyState icon={Sparkles} title="Nothing on the horizon" hint="No revisions forecast in the next 30 days" />
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingDates.map((date) => {
                const titles = upcomingByDate[date] ?? [];
                const courseItems = upcomingCourseByDate[date] ?? [];
                const count = (forecastByDate.get(date) ?? 0) + courseItems.length;
                const dateLabel = format(parseISO(date), 'EEE, MMM d');
                return (
                  <div key={date} role="group" aria-label={dateLabel} className="glass flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{dateLabel}</span>
                      <Badge variant="secondary">{count} due</Badge>
                    </div>
                    {(titles.length > 0 || courseItems.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {titles.map(({ id, title }) => (
                          <button
                            key={id}
                            type="button"
                            className="rounded-md border px-2.5 py-1 text-left text-sm hover:bg-muted"
                            onClick={() => openDetail(id)}
                          >
                            {title}
                          </button>
                        ))}
                        {courseItems.map(({ weekId, label }) => (
                          <Link
                            key={weekId}
                            to="/aiml"
                            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-sm hover:bg-muted"
                          >
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            {label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mastered">
          {masteredQuestions.length === 0 && retainedWeeks.length === 0 ? (
            <EmptyState icon={Award} title="Nothing mastered yet — pass the 30-day review to master one" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {masteredQuestions.map((question) => {
                const pattern = patternById[question.pattern];
                return (
                  <div key={question.id} className="glass flex items-center gap-3 p-3">
                    <Award className="h-5 w-5 shrink-0 text-medium" aria-hidden="true" />
                    <div className="flex flex-1 flex-col items-start gap-1">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => openDetail(question.id)}
                      >
                        {question.title}
                      </button>
                      <PatternChip pattern={pattern} />
                    </div>
                  </div>
                );
              })}
              {retainedWeeks.map((week) => (
                <div key={week.id} className="glass flex items-center gap-3 p-3">
                  <GraduationCap className="h-5 w-5 shrink-0 text-medium" aria-hidden="true" />
                  <div className="flex flex-1 flex-col items-start gap-1">
                    <Link to="/aiml" className="text-left font-medium hover:underline">
                      Week {week.week} — {week.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">Course week · retained</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
