import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DailyGoalProgress } from '@/components/shared/DailyGoalProgress';
import { WeeklyRevisionBanner } from '@/components/shared/WeeklyRevisionBanner';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { CourseTodayCard } from '@/components/course/CourseTodayCard';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectCurrentDay,
  selectIsWeeklyDay,
  selectPerDay,
  selectQuestionById,
  selectRevisionQueueIds,
  selectTodayLog,
  selectTodaysNewQuestions,
  selectTotalDays,
} from '@/store/selectors';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { diffDays } from '@/utils/dates';
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

export default function TodayPage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const currentDay = useAppSelector(selectCurrentDay);
  const totalDays = useAppSelector(selectTotalDays);
  const isWeeklyDay = useAppSelector(selectIsWeeklyDay);
  const perDay = useAppSelector(selectPerDay);
  const newQuestions = useAppSelector(selectTodaysNewQuestions);
  const revisionIds = useAppSelector((state) => selectRevisionQueueIds(state, today));
  const todayLog = useAppSelector((state) => selectTodayLog(state, today));
  // Single subscription to the whole byId map — cards read their own entry out of it below,
  // instead of each card mounting its own useAppSelector.
  const progressById = useAppSelector((state) => state.progress.byId);

  const solvedToday = todayLog ? todayLog.solvedIds.length : 0;

  const openDetail = (id: number) => dispatch(activeQuestionSet(id));

  const revisionQuestions = revisionIds
    .map((id) => selectQuestionById(id))
    .filter((q): q is Question => q !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-gradient">Today</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">
              Day {currentDay} of {totalDays}
            </p>
            <p className="text-sm text-muted-foreground">{format(parseISO(today), 'EEEE, MMMM d')}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/focus">Focus mode</Link>
          </Button>
        </div>
      </header>

      {isWeeklyDay && <WeeklyRevisionBanner count={revisionIds.length} />}

      <div className="glass p-6">
        <DailyGoalProgress solvedToday={solvedToday} perDay={perDay} />
      </div>

      <CourseTodayCard />

      <section>
        <h2 className="mb-3 text-lg font-semibold">New Questions</h2>
        <motion.div
          className="grid grid-cols-1 gap-4 xl:grid-cols-2"
          variants={gridVariants}
          initial="hidden"
          animate="show"
        >
          {newQuestions.map((question) => (
            <motion.div key={question.id} variants={cardVariants}>
              <QuestionCard
                question={question}
                progress={progressById[question.id] ?? initialProgress()}
                context="today"
                onOpenDetail={openDetail}
              />
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Revision Due</h2>
          <Badge variant="secondary">{revisionIds.length}</Badge>
        </div>

        {revisionQuestions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            <p>No revisions due — enjoy the clean slate</p>
          </div>
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
      </section>
    </div>
  );
}
