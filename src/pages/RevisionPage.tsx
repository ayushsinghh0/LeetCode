import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Award, CheckCircle2, Clock, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { PatternChip } from '@/components/questions/PatternChip';
import { patternById } from '@/data/patterns';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectForecast,
  selectIsWeeklyDay,
  selectQuestionById,
  selectRevisionQueueIds,
} from '@/store/selectors';
import { overallRevisionPassRate } from '@/utils/engine/stats';
import { initialProgress, isMastered } from '@/utils/engine/spacedRepetition';
import { addDays, diffDays } from '@/utils/dates';
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

function overdueLabel(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} overdue`;
}

export default function RevisionPage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const isWeeklyDay = useAppSelector(selectIsWeeklyDay);
  const revisionIds = useAppSelector((state) => selectRevisionQueueIds(state, today));
  const forecast = useAppSelector((state) => selectForecast(state, today));
  // Single subscription to the whole byId map — every derived list below reads its own entries
  // out of it, instead of each row mounting its own useAppSelector (same pattern as TodayPage).
  const progressById = useAppSelector((state) => state.progress.byId);
  const dayLogs = useAppSelector((state) => state.progress.dayLogs);

  const openDetail = (id: number) => dispatch(activeQuestionSet(id));

  const revisionQuestions = revisionIds
    .map((id) => selectQuestionById(id))
    .filter((q): q is Question => q !== undefined);

  const passedThisWeek = useMemo(() => {
    let count = 0;
    for (let i = 0; i < PASSED_THIS_WEEK_DAYS; i++) {
      const log = dayLogs[addDays(today, -i)];
      if (log) count += log.revisionsPassed.length;
    }
    return count;
  }, [dayLogs, today]);

  const passRate = overallRevisionPassRate(progressById);
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

  const upcomingDays = forecast.filter((day) => day.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-gradient">Revision</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Due now" value={revisionIds.length} icon={Clock} />
          <StatCard label="Passed this week" value={passedThisWeek} icon={CheckCircle2} />
          <StatCard label="Overall pass rate" value={passRateLabel} icon={TrendingUp} />
          <StatCard label="Mastered" value={masteredQuestions.length} icon={Award} />
        </div>
      </header>

      {isWeeklyDay && (
        <div className="glass flex items-center gap-3 bg-accent-gradient p-4 text-white">
          <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-semibold">Weekly Revision Day — {revisionIds.length} revisions queued</p>
        </div>
      )}

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">Due Today ({revisionIds.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="mastered">Mastered</TabsTrigger>
        </TabsList>

        <TabsContent value="due">
          {revisionQuestions.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing due — future you says thanks" />
          ) : (
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
                        className="absolute right-3 top-3 z-10 border-amber-500 bg-amber-500/20 text-amber-500"
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
        </TabsContent>

        <TabsContent value="upcoming">
          {upcomingDays.length === 0 ? (
            <EmptyState icon={Sparkles} title="Nothing on the horizon" hint="No revisions forecast in the next 30 days" />
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingDays.map(({ date, count }) => {
                const titles = upcomingByDate[date] ?? [];
                const dateLabel = format(parseISO(date), 'EEE, MMM d');
                return (
                  <div key={date} role="group" aria-label={dateLabel} className="glass flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{dateLabel}</span>
                      <Badge variant="secondary">{count} due</Badge>
                    </div>
                    {titles.length > 0 && (
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mastered">
          {masteredQuestions.length === 0 ? (
            <EmptyState icon={Award} title="No mastered questions yet — pass the 30-day review to master one" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {masteredQuestions.map((question) => {
                const pattern = patternById[question.pattern];
                return (
                  <div key={question.id} className="glass flex items-center gap-3 p-3">
                    <Award className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
