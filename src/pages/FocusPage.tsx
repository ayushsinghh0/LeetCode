import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { patternById } from '@/data/patterns';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setConfidence, skipQuestion, solveQuestion } from '@/store/actions';
import { selectQuestionById, selectRevisionQueueIds, selectTodaysNewQuestions } from '@/store/selectors';
import { initialProgress } from '@/utils/engine/spacedRepetition';

// Distraction-free session view — /focus is routed outside AppShell (see src/App.tsx), so this
// renders with no sidebar/nav chrome at all.
export default function FocusPage() {
  const dispatch = useAppDispatch();
  const today = useToday();

  const todaysQuestions = useAppSelector(selectTodaysNewQuestions);
  const progressById = useAppSelector((s) => s.progress.byId);
  const revisionIds = useAppSelector((s) => selectRevisionQueueIds(s, today));

  // Current question: first not-yet-solved item of today's slice (covers 'unsolved', 'in_progress'
  // and 'skipped' — anything today's slice still needs worked on), else the first due revision.
  const currentNew = todaysQuestions.find((q) => (progressById[q.id]?.status ?? 'unsolved') !== 'solved');
  const fallbackRevision = !currentNew && revisionIds.length > 0 ? selectQuestionById(revisionIds[0]) : undefined;
  const question = currentNew ?? fallbackRevision;
  const progress = question ? (progressById[question.id] ?? initialProgress()) : null;
  const pattern = question ? patternById[question.pattern] : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex justify-end">
        <Button asChild variant="ghost">
          <Link to="/today">
            <X /> Exit
          </Link>
        </Button>
      </div>

      {question && progress && pattern ? (
        <div className="glass flex flex-col items-center gap-5 p-10 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <DifficultyBadge difficulty={question.difficulty} />
            <PatternChip pattern={pattern} />
          </div>

          <h1 className="text-3xl font-bold text-gradient">{question.title}</h1>

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => dispatch(solveQuestion(question.id))}>
              <CheckCircle2 /> Solved
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                dispatch(solveQuestion(question.id));
                dispatch(setConfidence(question.id, 2));
              }}
            >
              <RotateCcw /> Need Revision
            </Button>
            <Button variant="ghost" onClick={() => dispatch(skipQuestion(question.id))}>
              <SkipForward /> Skip
            </Button>
          </div>

          <div className="w-full text-left">
            <p className="mb-1 text-sm font-medium">Notes</p>
            <NotesEditor questionId={question.id} initialNotes={progress.notes} />
          </div>
        </div>
      ) : (
        <div className="glass flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          <p>All caught up — nothing queued for focus right now.</p>
        </div>
      )}

      <div className="flex justify-center py-4">
        <PomodoroWidget variant="inline" />
      </div>
    </div>
  );
}
