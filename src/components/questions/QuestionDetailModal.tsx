import { Bookmark, BookmarkCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { STATUS_LABEL } from '@/components/questions/QuestionCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setConfidence, toggleBookmark } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// Mount once (e.g. in AppShell) — it is a singleton controlled entirely by ui.activeQuestionId.
export function QuestionDetailModal() {
  const dispatch = useAppDispatch();
  const activeId = useAppSelector((s) => s.ui.activeQuestionId);
  const progress = useAppSelector((s) => (activeId !== null ? (s.progress.byId[activeId] ?? initialProgress()) : null));

  const question = activeId !== null ? (questionById.get(activeId) ?? null) : null;

  function handleOpenChange(open: boolean) {
    if (!open) dispatch(activeQuestionSet(null));
  }

  const pattern = question ? patternById[question.pattern] : null;

  return (
    <Dialog open={question !== null && progress !== null} onOpenChange={handleOpenChange}>
      {question && progress && pattern && (
        <DialogContent key={question.id} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{question.title}</DialogTitle>
            <DialogDescription>
              {pattern.name} pattern &middot; {question.difficulty} difficulty
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={question.difficulty} />
            <PatternChip pattern={pattern} />
            <RevisionStagePips stage={progress.revisionStage} />
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {question.estimatedTime} min
            </span>
            <span className="text-sm text-muted-foreground">{STATUS_LABEL[progress.status]}</span>
            {/* Where this question sits on the ladder — the schedule shouldn't require the
                Revision page to discover. */}
            {progress.status === 'solved' && (
              <span className="text-sm text-muted-foreground">
                {progress.nextRevision
                  ? `· next review ${format(parseISO(progress.nextRevision), 'MMM d')}`
                  : '· mastered'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-medium">Confidence</p>
              <ConfidenceRating value={progress.confidence} onChange={(v) => dispatch(setConfidence(question.id, v))} />
            </div>
            <Button
              size="sm"
              variant={progress.bookmarked ? 'secondary' : 'outline'}
              onClick={() => dispatch(toggleBookmark(question.id))}
            >
              {progress.bookmarked ? <BookmarkCheck /> : <Bookmark />}
              {progress.bookmarked ? 'Bookmarked' : 'Bookmark'}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Notes</p>
            <NotesEditor questionId={question.id} initialNotes={progress.notes} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Revision History</p>
            {progress.revisionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet.</p>
            ) : (
              <ul className="space-y-1">
                {progress.revisionHistory.map((ev, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {ev.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-hard" aria-hidden="true" />
                    )}
                    <span>{format(parseISO(ev.date), 'MMM d, yyyy')}</span>
                    <span>{ev.passed ? 'Passed' : 'Failed'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
