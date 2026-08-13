import type { MouseEvent, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Clock, FileText, PlayCircle, RotateCcw, SkipForward, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { patternById } from '@/data/patterns';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_MEANING } from '@/data/questionTypes';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch } from '@/store/hooks';
import {
  reviseQuestion,
  setConfidence,
  skipQuestion,
  solveQuestion,
  startQuestion,
  toggleBookmark,
} from '@/store/actions';
import type { Question, QuestionProgress, QuestionStatus } from '@/types';

export const STATUS_LABEL: Record<QuestionStatus, string> = {
  unsolved: 'Unsolved',
  in_progress: 'In Progress',
  solved: 'Solved',
  skipped: 'Skipped',
};

export const STATUS_ICON: Record<QuestionStatus, typeof Circle> = {
  unsolved: Circle,
  in_progress: PlayCircle,
  solved: CheckCircle2,
  skipped: SkipForward,
};

export interface QuestionCardProps {
  question: Question;
  progress: QuestionProgress;
  context?: 'today' | 'revision' | 'browse';
  onOpenDetail: (id: number) => void;
}

export function QuestionCard({ question, progress, context = 'browse', onOpenDetail }: QuestionCardProps) {
  const dispatch = useAppDispatch();
  const pattern = patternById[question.pattern];
  const StatusIcon = STATUS_ICON[progress.status];
  const hasNotes = progress.notes.trim() !== '';
  const today = useToday();
  const gradedToday = progress.lastReviewed === today;

  // Every action button calls this so its click never bubbles up to the card's own
  // onClick(onOpenDetail) — mutating a card shouldn't also pop the detail modal open.
  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Keydown from the nested action buttons (Solved / Pass / Fail / Bookmark…) bubbles up here;
    // without this guard, pressing Enter on "Solved" would ALSO pop the detail modal open —
    // the keyboard twin of the stopPropagation in act() above.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDetail(question.id);
    }
  }

  return (
    <motion.div layout whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}>
      <Card
        className="cursor-pointer p-4 transition-colors duration-150 ease-swift hover:border-primary/40"
        role="button"
        tabIndex={0}
        onClick={() => onOpenDetail(question.id)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{question.title}</h3>
          {progress.bookmarked && <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Bookmarked" role="img" />}
        </div>

        {/* What this question teaches, on the card itself. A list of 539 titles asks the reader
            to remember what each one was for; a list of 539 capability sentences does not.

            Clamped to 3 lines with the full sentence in `title`: these run to a median of ~156
            characters and the meaning tends to live in the tail, so a 2-line clamp cut most of
            them mid-clause at phone width. Three lines fits the large majority; the tooltip and
            the question sheet carry the rest. */}
        <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground" title={question.tests}>
          {question.tests}
        </p>

        {/* Difficulty, pattern, kind and cost describe ONE object, so they read as one line
            rather than as four boxed chips (DESIGN.md § Composition — "related facts look like
            one fact"). The estimate wears a tilde: it is a band, not a measurement. */}
        <Meta
          className="mt-2"
          items={[
            <DifficultyBadge key="difficulty" difficulty={question.difficulty} />,
            <PatternChip key="pattern" pattern={pattern} />,
            // The label alone is not decodable — "Variant" means nothing until you know the
            // taxonomy — so the meaning rides along on hover and for assistive tech.
            <span key="type" title={QUESTION_TYPE_MEANING[question.type]}>
              {QUESTION_TYPE_LABEL[question.type]}
            </span>,
            <span key="estimate" className="figures inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{question.estimatedTime} min
            </span>,
          ]}
        />

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <RevisionStagePips stage={progress.revisionStage} />
          <span className="inline-flex items-center gap-1">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {STATUS_LABEL[progress.status]}
          </span>
          {hasNotes && <FileText className="h-3.5 w-3.5" role="img" aria-label="Has notes" />}
          {progress.confidence !== null && <ConfidenceRating value={progress.confidence} />}
        </div>

        {context === 'today' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {progress.status === 'unsolved' && (
              <Button variant="outline" onClick={act(() => dispatch(startQuestion(question.id)))}>
                <PlayCircle /> Start
              </Button>
            )}
            <Button onClick={act(() => dispatch(solveQuestion(question.id)))}>
              <CheckCircle2 /> Solved
            </Button>
            <Button
              variant="outline"
              onClick={act(() => {
                dispatch(solveQuestion(question.id));
                dispatch(setConfidence(question.id, 2));
              })}
            >
              <RotateCcw /> Need Revision
            </Button>
            <Button variant="ghost" onClick={act(() => dispatch(skipQuestion(question.id)))}>
              <SkipForward /> Skip
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark'}
              onClick={act(() => dispatch(toggleBookmark(question.id)))}
            >
              {progress.bookmarked ? <BookmarkCheck /> : <Bookmark />}
            </Button>
          </div>
        )}

        {context === 'revision' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Grading is offered only if a grade would actually land. `reviseQuestion` is
                idempotent per calendar day, so after today's grade these buttons would dispatch
                into a no-op — a control that silently does nothing is worse than no control. */}
            {gradedToday ? (
              <p className="inline-flex items-center gap-1.5 self-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Reviewed today
              </p>
            ) : (
              <>
                <Button onClick={act(() => dispatch(reviseQuestion(question.id, true)))}>
                  <CheckCircle2 /> Pass
                </Button>
                <Button variant="outline" onClick={act(() => dispatch(reviseQuestion(question.id, false)))}>
                  <XCircle /> Fail
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark'}
              onClick={act(() => dispatch(toggleBookmark(question.id)))}
            >
              {progress.bookmarked ? <BookmarkCheck /> : <Bookmark />}
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
