import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Disclosure, Meta, Page, PageHeader, RuledItem, RuledList } from '@/components/layout/Page';
import { Progress } from '@/components/ui/progress';
import { patternById } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectCurrentDay, selectPerDay, selectQuestions, selectTotalDays } from '@/store/selectors';
import { cn } from '@/utils/cn';
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
  // MotionConfig reducedMotion="user" only suppresses transform/layout values — the opacity
  // half of this infinite pulse would keep flashing forever, so the whole marker is skipped.
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background"
      role="img"
      aria-label={label}
      aria-current={isCurrentDay ? 'step' : undefined}
    >
      {isCurrentDay && !isComplete && !reducedMotion && (
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
  isLast: boolean;
  isExpanded: boolean;
  progressById: Record<number, QuestionProgress>;
  onToggle: (day: number) => void;
  onOpenQuestion: (id: number) => void;
}

/**
 * One day of the syllabus, ruled off from the next.
 *
 * It used to be a `.glass` plate sitting beside the rail, with a second bordered panel dropping
 * out below it when expanded — 68 rectangles fighting the one line that was already grouping
 * them, plus a nested plate the composition contract forbids. The rail and the hairline do the
 * grouping now; the row itself is ground.
 */
function RoadmapRow({
  day,
  slice,
  isCurrentDay,
  isLast,
  isExpanded,
  progressById,
  onToggle,
  onOpenQuestion,
}: RoadmapRowProps) {
  const reducedMotion = useReducedMotion();
  const solvedCount = slice.filter((q) => (progressById[q.id]?.status ?? 'unsolved') === 'solved').length;
  const isComplete = slice.length > 0 && solvedCount === slice.length;
  const progressPct = slice.length > 0 ? (solvedCount / slice.length) * 100 : 0;
  const weekly = isWeeklyRevisionDay(day);
  const patterns = patternNames(slice);
  const difficulty = difficultySummary(slice);

  return (
    <RuledItem className={cn('py-0', isCurrentDay && 'bg-muted/30')}>
      <div className="flex gap-4">
        {/* The rail spans the full height of every row so the timeline reads as one continuous
            line rather than 68 segments; the marker punches through it, and on the final day it
            stops at the marker instead of trailing off the end of the course. */}
        <div className="relative flex w-9 shrink-0 justify-center pt-3.5">
          <div
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 w-px -translate-x-1/2 bg-border',
              isLast ? 'top-0 h-8' : 'inset-y-0',
            )}
          />
          <StatusNode day={day} isComplete={isComplete} isCurrentDay={isCurrentDay} />
        </div>

        <div className="min-w-0 flex-1 py-4">
          <button
            type="button"
            onClick={() => onToggle(day)}
            aria-expanded={isExpanded}
            aria-controls={`roadmap-day-${day}-questions`}
            className="-mx-2 flex w-full flex-col gap-2 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Day {day}</span>
                {weekly && <Sparkles className="h-4 w-4 text-primary" aria-label="Weekly revision day" role="img" />}
              </span>
              <span className="figures shrink-0 text-xs text-muted-foreground">
                {solvedCount}/{slice.length}
              </span>
            </div>

            {/* Patterns and difficulty mix describe one thing — the day — so they read as one
                line, not as two near-identical stacked paragraphs. */}
            <Meta className="text-xs" items={[patterns || null, difficulty || null]} />

            <Progress value={progressPct} className="h-1" aria-label={`Day ${day} progress`} />
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                id={`roadmap-day-${day}-questions`}
                layout
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                // `height`/`opacity` are neither transforms nor layout, so `MotionConfig
                // reducedMotion="user"` does not suppress them and index.css's CSS-only zeroing
                // cannot reach a JS-driven animation. This file already gates its pulse on
                // `useReducedMotion` for exactly this reason; the expand was missed.
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="overflow-hidden"
              >
                {/* Was a hand-rolled copy of `RuledList` — `divide-y divide-border/70 border-t
                    border-border/70`, a second divider tone invented locally — wrapping a
                    `div role="button"` with a hand-written Enter/Space handler. A real `<button>`
                    brings both keys, the focus ring and the tab stop for free, and `min-h-11`
                    lifts the row from 38px to the 44px target the rest of the product keeps. */}
                <RuledList className="mt-3 border-y-0 border-t">
                  {slice.map((question) => {
                    const solved = (progressById[question.id]?.status ?? 'unsolved') === 'solved';
                    return (
                      <RuledItem key={question.id} padded={false}>
                        <button
                          type="button"
                          onClick={() => onOpenQuestion(question.id)}
                          className="-mx-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left transition-colors duration-150 ease-swift hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-sm">
                            {solved ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                            <span className="truncate">{question.title}</span>
                          </span>
                          {/* `bare`: DESIGN.md § Related facts — the bordered chip is for a badge
                              standing alone as an object, never one sitting in a row. It is also a
                              `<div>`, which is invalid inside a `<button>`. */}
                          <DifficultyBadge difficulty={question.difficulty} variant="bare" />
                        </button>
                      </RuledItem>
                    );
                  })}
                </RuledList>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </RuledItem>
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

  function toggleDay(day: number) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  // The mount-time scrollIntoView (and its ref plumbing) is gone with the week grouping. It
  // existed because the current day could sit 6,000px down a 68-row document; with the other
  // weeks collapsed, the open week begins at most ~10 summary rows below the masthead, and
  // auto-scrolling past the masthead to centre an element that is already on screen was the
  // louder disorientation.

  // Weeks are the course's own rhythm (day % 7 === 0 is the weekly revision day), so they are the
  // honest grouping unit — and the recomposition the page needed. Sixty-eight day rows at ~110px
  // was a 7,400px document to scroll no matter where you stood in it; ten week rows with only the
  // current one open is ~1,100px, and every other week is one tap away rather than gone. Only the
  // week the learner is standing in opens by default.
  const weeks: number[][] = [];
  for (let d = 1; d <= totalDays; d += 7) {
    weeks.push(Array.from({ length: Math.min(7, totalDays - d + 1) }, (_, i) => d + i));
  }
  const currentWeekIndex = Math.floor((currentDay - 1) / 7);

  return (
    <Page>
      <PageHeader
        eyebrow={`Day ${currentDay} of ${totalDays}`}
        title="Roadmap"
        support={`${questions.length} questions across ${totalDays} days, in course order. Open a week, then a day.`}
      />

      {/* Disclosures rule themselves (each carries border-b), so the stack needs only its opening
          rule; the inner RuledList drops border-y for the same reason — the week's own boundaries
          already exist, and paying for a boundary twice is the duplicate-separator problem. */}
      <div className="flex flex-col border-t border-border">
        {weeks.map((weekDays, wi) => {
          const firstDay = weekDays[0]!;
          const lastDay = weekDays[weekDays.length - 1]!;
          const slices = weekDays.map((day) => daySlice(questions, day, perDay));
          let solvedInWeek = 0;
          let totalInWeek = 0;
          for (const slice of slices) {
            totalInWeek += slice.length;
            solvedInWeek += slice.filter(
              (q) => (progressById[q.id]?.status ?? 'unsolved') === 'solved',
            ).length;
          }
          return (
            <Disclosure
              key={firstDay}
              defaultOpen={wi === currentWeekIndex}
              summary={
                <span className="flex items-baseline gap-3">
                  <span className="font-semibold">Week {wi + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    days {firstDay}–{lastDay}
                  </span>
                </span>
              }
              meta={`${solvedInWeek}/${totalInWeek}`}
            >
              <RuledList className="border-y-0">
                {weekDays.map((day, di) => {
                  const isCurrentDay = day === currentDay;
                  return (
                    <RoadmapRow
                      key={day}
                      day={day}
                      slice={slices[di]!}
                      isCurrentDay={isCurrentDay}
                      // The timeline is continuous within its week; the line stops at the week's
                      // last marker instead of trailing into the disclosure's padding.
                      isLast={day === lastDay}
                      isExpanded={expandedDay === day}
                      progressById={progressById}
                      onToggle={toggleDay}
                      onOpenQuestion={openQuestion}
                    />
                  );
                })}
              </RuledList>
            </Disclosure>
          );
        })}
      </div>
    </Page>
  );
}
