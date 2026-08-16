import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Meta, Panel, RuledItem, RuledList, Screen, ScreenBody, ScreenHeader } from '@/components/layout/Page';
import { ChipRadioRow } from '@/components/shared/ChipRadioRow';
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
        <div className="relative flex w-9 shrink-0 justify-center pt-1">
          <div
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 w-px -translate-x-1/2 bg-border',
              isLast ? 'top-0 h-8' : 'inset-y-0',
            )}
          />
          <StatusNode day={day} isComplete={isComplete} isCurrentDay={isCurrentDay} />
        </div>

        <div className="min-w-0 flex-1 py-1.5">
          {/* One line, not three. "Day 25", its patterns, its difficulty mix and its count all
              describe the same day, and stacking them as three bands made every row ~100px —
              700px per open week, on a viewport that may be 590px tall (1080p at 150% scaling).
              The meta wraps under the day number at phone widths, where a taller row is the
              sanctioned trade; from `md` up the whole reading is one baseline plus the bar. */}
          <button
            type="button"
            onClick={() => onToggle(day)}
            aria-expanded={isExpanded}
            aria-controls={`roadmap-day-${day}-questions`}
            className="-mx-2 flex w-full flex-col gap-1 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 font-semibold">
                  Day {day}
                  {weekly && <Sparkles className="h-4 w-4 text-primary" aria-label="Weekly revision day" role="img" />}
                </span>
                <Meta className="text-xs" items={[patterns || null, difficulty || null]} />
              </span>
              <span className="figures shrink-0 text-xs text-muted-foreground">
                {solvedCount}/{slice.length}
              </span>
            </div>

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
  // Which week the detail panel shows. Starts on the week the learner is standing in; browsing
  // another week never moves the current-day marker, only the view.
  const [viewWeekIndex, setViewWeekIndex] = useState(() => Math.floor((currentDay - 1) / 7));

  function toggleDay(day: number) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

  function viewWeek(wi: number) {
    setViewWeekIndex(wi);
    // An expansion belongs to the week it was made in; carrying it across a week switch would
    // re-open a day the learner has stopped looking at.
    setExpandedDay(null);
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

  const viewDays = weeks[viewWeekIndex] ?? weeks[currentWeekIndex] ?? weeks[0]!;
  const viewSlices = viewDays.map((day) => daySlice(questions, day, perDay));
  const weekTallies = weeks.map((weekDays) => {
    let solved = 0;
    let total = 0;
    for (const day of weekDays) {
      const slice = daySlice(questions, day, perDay);
      total += slice.length;
      solved += slice.filter((q) => (progressById[q.id]?.status ?? 'unsolved') === 'solved').length;
    }
    return { solved, total };
  });

  return (
    <Screen>
      {/* No support line: "539 questions across 68 days, open a week, then a day" is what the
          list below demonstrates in its first two rows, and on a ~590px viewport the sentence
          pushed the current week's later days below the fold. */}
      <ScreenHeader eyebrow={`Day ${currentDay} of ${totalDays}`} title="Roadmap" />

      {/* MASTER–DETAIL, not a 10-disclosure stack. Ten stacked week disclosures put the open
          week's later days and every following week below a 590px fold — a long march down a
          page that is two-thirds empty sideways. The weeks are now a two-row tile strip (the
          capacity-chip radiogroup idiom — the one sanctioned place adjacent ink fills exist,
          because exactly one is active), and the chosen week's seven days render in two ruled
          columns beside each other. Fresh or mid-course, the whole route fits one ~590px
          viewport; on phones the columns stack back into the familiar single timeline. */}
      <ScreenBody>
        <Panel className="flex flex-col gap-4">
          <ChipRadioRow
            label="Week"
            options={weeks.map((_, wi) => wi)}
            value={viewWeekIndex}
            onSelect={viewWeek}
            format={(wi) => {
              const tally = weekTallies[wi]!;
              return (
                <span className="flex flex-col items-center gap-0.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    Week {wi + 1}
                    {wi === currentWeekIndex && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          wi === viewWeekIndex ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    )}
                  </span>
                  <span className="figures text-[11px] opacity-80">
                    {tally.solved}/{tally.total}
                  </span>
                </span>
              );
            }}
            optionLabel={(wi) => {
              const tally = weekTallies[wi]!;
              const here = wi === currentWeekIndex ? ', current week' : '';
              return `Week ${wi + 1}, days ${weeks[wi]![0]}–${weeks[wi]![weeks[wi]!.length - 1]}, ${tally.solved} of ${tally.total} solved${here}`;
            }}
            className="grid grid-cols-5 gap-1.5"
            chipClassName="px-1"
          />

          {/* The chosen week: days 1–4 beside days 5–7 from `md` up (a syllabus page sets its
              week in two columns; chronology reads down each column). One stacked timeline
              below `md`. `items-start` so an expanded day grows only its own column. */}
          <div className="border-t border-border md:grid md:grid-cols-2 md:items-start md:gap-x-10">
            {[viewDays.slice(0, 4), viewDays.slice(4)].map((columnDays, ci) => (
              // Stacked below `md`, the second list continues the first — its max-md border-t
              // draws the one hairline the divide-y pair cannot draw across two lists.
              <RuledList key={ci} className={cn('border-y-0', ci === 1 && 'max-md:border-t max-md:border-border')}>
                {columnDays.map((day) => {
                  const di = viewDays.indexOf(day);
                  return (
                    <RoadmapRow
                      key={day}
                      day={day}
                      slice={viewSlices[di]!}
                      isCurrentDay={day === currentDay}
                      // The rail stops at each column's last marker instead of trailing off.
                      isLast={day === columnDays[columnDays.length - 1]}
                      isExpanded={expandedDay === day}
                      progressById={progressById}
                      onToggle={toggleDay}
                      onOpenQuestion={openQuestion}
                    />
                  );
                })}
              </RuledList>
            ))}
          </div>
        </Panel>
      </ScreenBody>
    </Screen>
  );
}
