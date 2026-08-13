import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, RotateCcw, Target, XCircle } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { FAMILIES, familyById } from '@/data/curriculum';
import { patternById } from '@/data/patterns';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
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

// Recognition drill: recall which technique fits before reading any explanation. The drill is
// seeded by the calendar date — one drill per day, stable across reloads, no persistence needed.
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
    <div className="flex flex-col gap-6">
      <header className="glass p-6">
        <h1 className="text-2xl font-bold text-gradient">Recognition drill</h1>
        <p className="text-sm text-muted-foreground">
          Name the technique before you look anything up — recognizing the pattern is the skill
          interviews actually test. A fresh set arrives each day.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No drill available"
          hint="Drills draw from the problem-family catalog; it appears to be empty."
        />
      ) : finished ? (
        <section className="glass flex flex-col items-start gap-3 p-6" aria-label="Drill result">
          <p className="text-lg font-medium">
            {correctCount} of {items.length} recognized
          </p>
          <p className="text-sm text-muted-foreground">
            {correctCount === items.length
              ? 'Every technique named correctly. Tomorrow brings a new set.'
              : 'Missed ones are worth a second look — open the problem and read its recognition cues.'}
          </p>
          {recordedToday && (
            <p className="figures text-sm text-muted-foreground">
              Recorded for today: {recordedToday.correct}/{recordedToday.total} — the first run of a day is
              what counts; reruns are practice.
            </p>
          )}
          {mostMissed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Most-missed patterns so far:{' '}
              {mostMissed
                .map(({ pattern, count }) => `${patternById[pattern as PatternId]?.name ?? pattern} (${count})`)
                .join(', ')}
              . Tomorrow's drill leans toward them.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={restart}>
            <RotateCcw /> Run it again
          </Button>
        </section>
      ) : item && question && family ? (
        <section className="glass flex flex-col gap-4 p-6" aria-label="Drill question">
          <div className="flex items-center justify-between gap-2">
            <p className="figures text-sm text-muted-foreground">
              {index + 1} / {items.length}
            </p>
            <p className="figures text-sm text-muted-foreground">{correctCount} correct</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{question.title}</h2>
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          {question.url && (
            <a
              href={question.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 transition-colors duration-150 ease-swift hover:text-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Read the statement first if the title alone isn't enough
            </a>
          )}

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
                  disabled={revealed}
                  onClick={() => choose(option)}
                  className={cn(
                    'glass flex items-center gap-2 rounded-md p-3 text-left text-sm transition-colors duration-150 ease-swift',
                    !revealed && 'hover:border-primary/40',
                    revealed && isCorrect && 'border-easy/60',
                    revealed && isPicked && !isCorrect && 'border-hard/60',
                    revealed && !isPicked && !isCorrect && 'opacity-60',
                  )}
                >
                  {revealed && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-easy" aria-hidden="true" />}
                  {revealed && isPicked && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-hard" aria-hidden="true" />}
                  <span className="font-medium">{patternById[option]?.name ?? option}</span>
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium">
                {picked === item.pattern ? 'Recognized.' : `This one is ${patternById[item.pattern]?.name ?? item.pattern}.`}{' '}
                <span className="text-muted-foreground">{family.name}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{family.idea}</p>
              <ul className="mt-2 space-y-1">
                {family.signals.map((signal) => (
                  <li key={signal} className="text-sm text-muted-foreground">
                    · {signal}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Watch out:</span> {family.trap}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => dispatch(activeQuestionSet(question.id))}>
                  Open question
                </Button>
                <Button size="sm" onClick={next}>
                  {index + 1 >= items.length ? 'Finish' : 'Next'} <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
