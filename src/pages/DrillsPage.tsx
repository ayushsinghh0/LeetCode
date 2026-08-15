import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowRight, CheckCircle2, ExternalLink, RotateCcw, Target, XCircle } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { FAMILIES, familyById } from '@/data/curriculum';
import { patternById } from '@/data/patterns';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Page, PageHeader, Section, Lead, Rule, Meta, Eyebrow } from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectMissCounts, selectMostMissedPatterns } from '@/store/slices/drillsSlice';
import { logDrillResult } from '@/store/actions';
import { useToday } from '@/hooks/useToday';
import { buildDrill } from '@/utils/engine/drills';
import { cn } from '@/utils/cn';
import type { PatternId, Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

const DRILL_SIZE = 8;

/**
 * Recognition drill: recall which technique fits before reading any explanation. The drill is
 * seeded by the calendar date — one drill per day, stable across reloads, no persistence needed.
 *
 * Composition: the drill is the only thing on this page, so it takes the page's single `Lead`
 * plate and everything inside it — options, verdict, teaching block — is separated by hairlines
 * and type registers rather than by more plates. The options are bordered buttons, not surfaces.
 */
export default function DrillsPage() {
  const dispatch = useAppDispatch();
  const today = useToday();
  // Weights exclude today so recording today's attempt can't reshuffle today's own drill.
  const missWeights = useAppSelector((s) => selectMissCounts(s, today));
  const recordedToday = useAppSelector((s) => s.drills.byDate[today]);
  const mostMissed = useAppSelector(selectMostMissedPatterns);

  const items = useMemo(
    () => buildDrill(FAMILIES, questionById, today, DRILL_SIZE, missWeights),
    [today, missWeights],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<PatternId | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<PatternId[]>([]);
  const [finished, setFinished] = useState(false);

  const item = items[index];
  const question = item ? questionById.get(item.questionId) : undefined;
  const family = item ? familyById[item.familyId] : undefined;

  function choose(option: PatternId) {
    if (picked !== null || !item) return;
    setPicked(option);
    if (option === item.pattern) setCorrectCount((c) => c + 1);
    else setMissed((m) => [...m, item.pattern]);
  }

  function next() {
    if (index + 1 >= items.length) {
      // The slice keeps only the first attempt per date — rerun dispatches are no-ops there.
      dispatch(logDrillResult(correctCount, items.length, missed));
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }

  function restart() {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setMissed([]);
    setFinished(false);
  }

  return (
    <Page width="reading">
      <PageHeader
        eyebrow={format(parseISO(today), 'EEEE, MMMM d')}
        title="Recognition drill"
        support="Name the technique before you look anything up — recognizing the pattern is the skill interviews actually test. A fresh set arrives each day."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No drill available"
          hint="Drills draw from the problem-family catalog; it appears to be empty."
        />
      ) : finished ? (
          <Lead aria-label="Drill result">
            <div className="flex flex-col gap-3">
              <Eyebrow>Result</Eyebrow>
              {/* The score is the point, so it wears the stat voice (DESIGN.md § Hierarchy) —
                  the largest thing in the plate, and still a step below the page title. */}
              <p className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight">
                {correctCount} of {items.length} recognized
              </p>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {correctCount === items.length
                  ? 'Every technique named correctly. Tomorrow brings a new set.'
                  : 'Missed ones are worth a second look — open the problem and read its recognition cues.'}
              </p>
            </div>

            {(recordedToday || mostMissed.length > 0) && (
              <div className="flex flex-col gap-3">
                <Rule />
                {recordedToday && (
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Recorded for today:{' '}
                    <span className="figures text-foreground">
                      {recordedToday.correct}/{recordedToday.total}
                    </span>{' '}
                    — the first run of a day is what counts; reruns are practice.
                  </p>
                )}
                {mostMissed.length > 0 && (
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Most-missed patterns so far:{' '}
                    {mostMissed
                      .map(({ pattern, count }) => `${patternById[pattern as PatternId]?.name ?? pattern} (${count})`)
                      .join(', ')}
                    . Tomorrow's drill leans toward them.
                  </p>
                )}
              </div>
            )}

            <div>
              <Button onClick={restart}>
                <RotateCcw /> Run it again
              </Button>
            </div>
          </Lead>
      ) : item && question && family ? (
        <>
          <Lead aria-label="Drill question">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <Eyebrow>
                  {index + 1} / {items.length}
                </Eyebrow>
                <Eyebrow>{correctCount} correct</Eyebrow>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold md:text-2xl">{question.title}</h2>
                <Meta
                  items={[
                    <DifficultyBadge difficulty={question.difficulty} />,
                    question.url && (
                      <a
                        href={question.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 underline-offset-2 transition-colors duration-150 ease-swift hover:text-foreground hover:underline"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Read the statement first if the title alone isn't enough
                      </a>
                    ),
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Which technique fits?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Technique options">
                {item.options.map((option) => {
                  const isCorrect = option === item.pattern;
                  const isPicked = option === picked;
                  const revealed = picked !== null;
                  return (
                    <button
                      key={option}
                      type="button"
                      // aria-disabled rather than disabled: a real `disabled` drops the button the
                      // learner just activated out of the focus order, so keyboard focus lands on
                      // <body> the instant they answer. The click guard in `choose` is what
                      // actually makes the answer final.
                      aria-disabled={revealed || undefined}
                      onClick={() => choose(option)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border border-border px-3.5 py-3 text-left text-sm transition-colors duration-150 ease-swift',
                        !revealed && 'hover:border-primary/40 hover:bg-muted/60',
                        revealed && 'cursor-default',
                        revealed && isCorrect && 'border-easy/60',
                        revealed && isPicked && !isCorrect && 'border-hard/60',
                        revealed && !isPicked && !isCorrect && 'opacity-60',
                      )}
                    >
                      {revealed && isCorrect && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />
                      )}
                      {revealed && isPicked && !isCorrect && (
                        <XCircle className="h-4 w-4 shrink-0 text-hard" aria-hidden="true" />
                      )}
                      <span className="font-medium">{patternById[option]?.name ?? option}</span>
                      {revealed && isCorrect && <span className="sr-only">(correct answer)</span>}
                      {revealed && isPicked && !isCorrect && <span className="sr-only">(your answer)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Always mounted so assistive tech has the region registered before the verdict
                lands in it; the visible teaching block below stays ordinary reading content. */}
            <p className="sr-only" role="status">
              {picked === null
                ? ''
                : picked === item.pattern
                  ? `Correct — ${family.name}.`
                  : `Incorrect — the technique is ${patternById[item.pattern]?.name ?? item.pattern}.`}
            </p>

          </Lead>

          {/* The reveal is a SIBLING of the plate, not its tail. Inside it, the `Lead` grew from
              ~310px to ~700px the instant the learner answered — the plate stopped being "the one
              thing the page wants you to do" and became a border drawn around the entire page,
              which is the defect ContestPage's own header comment records fixing there. This is
              reading material: a verdict, the family's idea, its signals, its trap. Reading
              material sits on the page ground.

              The verdict is the section's `title`, so it is a real `<h2>` rather than the `<p>` it
              was — it is the largest claim on screen after the question, and the page had no
              heading for it. The action row stays at the foot: the whole value of a drill is the
              explanation, and hoisting "Next" above it would invite skipping the only part that
              teaches anything. */}
          {picked !== null && (
            <Section
              divider
              title={
                <>
                  {picked === item.pattern
                    ? 'Recognized.'
                    : `This one is ${patternById[item.pattern]?.name ?? item.pattern}.`}{' '}
                  <span className="font-normal text-muted-foreground">{family.name}</span>
                </>
              }
            >
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{family.idea}</p>

              <ul className="flex flex-col gap-1.5 border-l-2 border-border pl-3.5">
                {family.signals.map((signal) => (
                  <li key={signal} className="max-w-prose text-sm text-muted-foreground">
                    {signal}
                  </li>
                ))}
              </ul>

              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Watch out:</span> {family.trap}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => dispatch(activeQuestionSet(question.id))}>
                  Open question
                </Button>
                <Button onClick={next}>
                  {index + 1 >= items.length ? 'Finish' : 'Next'} <ArrowRight />
                </Button>
              </div>
            </Section>
          )}
        </>
      ) : null}
    </Page>
  );
}
