import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Progress } from '@/components/ui/progress';
import { patternById } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectCurrentDay, selectPerDay, selectQuestions, selectTotalDays } from '@/store/selectors';
import { daySlice, isWeeklyRevisionDay } from '@/utils/engine/roadmap';
import type { Difficulty, Question, QuestionProgress } from '@/types';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'easy', medium: 'med', hard: 'hard' };
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

function difficultySummary(slice: Question[]): string {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of slice) counts[q.difficulty] += 1;
  return DIFFICULTY_ORDER.filter((d) => counts[d] > 0)
    .map((d) => `${counts[d]} ${DIFFICULTY_LABEL[d]}`)
    .join(' · ');
}

function patternNames(slice: Question[]): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const q of slice) {
    const name = patternById[q.pattern].name;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.join(' · ');
}

interface StatusNodeProps {
  day: number;
  isComplete: boolean;
  isCurrentDay: boolean;
}

function StatusNode({ day, isComplete, isCurrentDay }: StatusNodeProps) {
  const label = isComplete ? `Day ${day} complete` : isCurrentDay ? `Day ${day} current` : `Day ${day} upcoming`;

  return (
    <div
      className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background"
      role="img"
      aria-label={label}
      aria-current={isCurrentDay ? 'step' : undefined}
    >
      {isCurrentDay && !isComplete && (
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/50"
          aria-hidden="true"
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {isComplete ? (
        <CheckCircle2 className="h-6 w-6 text-easy" aria-hidden="true" />
      ) : isCurrentDay ? (
        <Circle className="relative h-6 w-6 fill-primary/20 text-primary" aria-hidden="true" />
      ) : (
        <Circle className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
      )}
    </div>
  );
}

interface RoadmapRowProps {
  day: number;
  slice: Question[];
  isCurrentDay: boolean;
  isExpanded: boolean;
  progressById: Record<number, QuestionProgress>;
  onToggle: (day: number) => void;
  onOpenQuestion: (id: number) => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

function RoadmapRow({ day, slice, isCurrentDay, isExpanded, progressById, onToggle, onOpenQuestion, rowRef }: RoadmapRowProps) {
  const solvedCount = slice.filter((q) => (progressById[q.id]?.status ?? 'unsolved') === 'solved').length;
  const isComplete = slice.length > 0 && solvedCount === slice.length;
  const progressPct = slice.length > 0 ? (solvedCount / slice.length) * 100 : 0;
  const weekly = isWeeklyRevisionDay(day);
  const patterns = patternNames(slice);
  const difficulty = difficultySummary(slice);

  return (
    <div ref={rowRef} className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <StatusNode day={day} isComplete={isComplete} isCurrentDay={isCurrentDay} />
        <div className="w-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="flex-1 pb-6">
        <button
          type="button"
          onClick={() => onToggle(day)}
          className="glass flex w-full flex-col gap-2 p-4 text-left transition-colors duration-150 ease-swift hover:border-primary/40"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Day {day}</span>
            {weekly && <Sparkles className="h-4 w-4 text-primary" aria-label="Weekly revision day" role="img" />}
          </div>
          {patterns !== '' && <p className="text-sm text-muted-foreground">{patterns}</p>}
          {difficulty !== '' && <p className="text-xs text-muted-foreground">{difficulty}</p>}
          <Progress value={progressPct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {solvedCount}/{slice.length} solved
          </p>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              layout
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ul className="mt-2 flex flex-col gap-1 rounded-xl border border-border bg-muted/30 p-2">
                {slice.map((question) => {
                  const solved = (progressById[question.id]?.status ?? 'unsolved') === 'solved';
                  return (
                    <li key={question.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenQuestion(question.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenQuestion(question.id);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          {solved ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                          )}
                          {question.title}
                        </span>
                        <DifficultyBadge difficulty={question.difficulty} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const dispatch = useAppDispatch();
  const questions = selectQuestions();
  const currentDay = useAppSelector(selectCurrentDay);
  const totalDays = useAppSelector(selectTotalDays);
  const perDay = useAppSelector(selectPerDay);
  // Single subscription to the whole byId map — rows read their own entries out of it below,
  // instead of each row mounting its own useAppSelector (mirrors TodayPage/DashboardPage).
  const progressById = useAppSelector((state) => state.progress.byId);

  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const currentRowRef = useRef<HTMLDivElement | null>(null);

  function toggleDay(day: number) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  // Auto-scroll the current day into view on mount. jsdom does not implement
  // HTMLElement.scrollIntoView, so it's guarded with optional chaining rather than relying on a
  // test-setup polyfill — the guard also makes the component robust in any environment where
  // scrollIntoView is unavailable.
  useEffect(() => {
    currentRowRef.current?.scrollIntoView?.({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-6">
      <header className="glass p-6">
        <h1 className="text-2xl font-bold text-gradient">Roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Day {currentDay} of {totalDays} &middot; {questions.length} questions total
        </p>
      </header>

      <div className="flex flex-col">
        {days.map((day) => {
          const slice = daySlice(questions, day, perDay);
          const isCurrentDay = day === currentDay;
          return (
            <RoadmapRow
              key={day}
              day={day}
              slice={slice}
              isCurrentDay={isCurrentDay}
              isExpanded={expandedDay === day}
              progressById={progressById}
              onToggle={toggleDay}
              onOpenQuestion={openQuestion}
              rowRef={isCurrentDay ? (el) => { currentRowRef.current = el; } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
