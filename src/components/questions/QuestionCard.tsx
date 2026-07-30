import type { MouseEvent, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Clock, FileText, PlayCircle, RotateCcw, SkipForward, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { patternById } from '@/data/patterns';
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

  // Every action button calls this so its click never bubbles up to the card's own
  // onClick(onOpenDetail) — mutating a card shouldn't also pop the detail modal open.
  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDetail(question.id);
    }
  }

  return (
    <motion.div layout whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
      <Card
        className="glass cursor-pointer p-4"
        role="button"
        tabIndex={0}
        onClick={() => onOpenDetail(question.id)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{question.title}</h3>
          {progress.bookmarked && <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Bookmarked" role="img" />}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={question.difficulty} />
          <PatternChip pattern={pattern} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {question.estimatedTime} min
          </span>
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
              <Button size="sm" variant="outline" onClick={act(() => dispatch(startQuestion(question.id)))}>
                <PlayCircle /> Start
              </Button>
            )}
            <Button size="sm" onClick={act(() => dispatch(solveQuestion(question.id)))}>
              <CheckCircle2 /> Solved
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={act(() => {
                dispatch(solveQuestion(question.id));
                dispatch(setConfidence(question.id, 2));
              })}
            >
              <RotateCcw /> Need Revision
            </Button>
            <Button size="sm" variant="ghost" onClick={act(() => dispatch(skipQuestion(question.id)))}>
              <SkipForward /> Skip
            </Button>
            <Button
              size="sm"
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
            <Button size="sm" onClick={act(() => dispatch(reviseQuestion(question.id, true)))}>
              <CheckCircle2 /> Pass
            </Button>
            <Button size="sm" variant="outline" onClick={act(() => dispatch(reviseQuestion(question.id, false)))}>
              <XCircle /> Fail
            </Button>
            <Button
              size="sm"
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
