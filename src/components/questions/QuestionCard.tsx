import type { MouseEvent, KeyboardEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Clock, FileText, PlayCircle, RotateCcw, SkipForward, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Meta, RuledItem } from '@/components/layout/Page';
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

/* ------------------------------------------------------------------------------------------- */
/* QuestionRow — how a question appears in a list you are browsing                               */
/* ------------------------------------------------------------------------------------------- */

const ROW_BUTTON =
  '-mx-2 flex w-full flex-col gap-1 rounded-md px-2 py-3.5 text-left transition-colors duration-150 ease-swift ' +
  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/**
 * `Meta`'s line, rendered from spans.
 *
 * A row's whole surface is one `<button>`, and `<div>` is not phrasing content — so the row can't
 * mount `Meta` itself. Same composition, same interpunct, same tokens; CompaniesPage's practice
 * rows hand-roll the identical line for the identical reason. Keep the two in step.
 */
function RowMeta({ items }: { items: (ReactNode | null | undefined | false)[] }) {
  const shown = items.filter((item): item is ReactNode => Boolean(item) && item !== '');
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {shown.map((item, i) => (
        // Index keys are correct here: the list is positional metadata with no identity of its own.
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-border">
              &middot;
            </span>
          )}
          {item}
        </span>
      ))}
    </span>
  );
}

export interface QuestionRowProps {
  question: Question;
  progress: QuestionProgress;
  onOpen: (id: number) => void;
}

/**
 * A browse row — the index entry for a question on `/patterns/:id` and `/bookmarks`.
 *
 * These pages used to map every question into a `QuestionCard`, which is built on `Card`, which
 * IS `.glass`: a pattern with thirty questions rendered thirty bordered rectangles of identical
 * weight, plus two bordered chips inside each of them. DESIGN.md § The plate rule is explicit —
 * "a list does not become plates" — and a row you are scanning is an index entry, not a liftable
 * object. So the row is hairline-ruled and open on the page ground, and its metadata wears the
 * borderless chip variants.
 *
 * What it carries is what you scan a list for: what the question is, what it teaches, what it
 * costs, how hard it is, which pattern it belongs to, and where you stand on it. The progress
 * instrumentation that used to ride along — the five revision pips, the five confidence dots —
 * is one click away in the question sheet, where it is read once rather than repeated thirty
 * times down a page. `/patterns/:id` already reports mastered / in-revision as counted facts in
 * its Ledger, which is the honest place for that information.
 */
export function QuestionRow({ question, progress, onOpen }: QuestionRowProps) {
  const pattern = patternById[question.pattern];
  const StatusIcon = STATUS_ICON[progress.status];
  const hasNotes = progress.notes.trim() !== '';

  return (
    <RuledItem padded={false}>
      {/* A real button, not a div with role="button": the whole row is the click target, and the
          native element brings Enter/Space, focus order and the focus ring with it. */}
      <button type="button" className={ROW_BUTTON} onClick={() => onOpen(question.id)}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{question.title}</span>
            {progress.bookmarked && (
              <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-primary" role="img" aria-label="Bookmarked" />
            )}
          </span>
          {/* A band for a typical first attempt, not a measurement of anyone — hence the tilde. */}
          <span className="figures shrink-0 text-xs text-muted-foreground">~{question.estimatedTime} min</span>
        </span>

        {/* What this question teaches, on the row itself. A list of 539 titles asks the reader to
            remember what each one was for; a list of 539 capability sentences does not. One line
            here (the card's three-line clamp was a card-shaped decision) with the full sentence in
            `title` and in the question sheet. */}
        <span className="line-clamp-1 text-sm text-muted-foreground" title={question.tests}>
          {question.tests}
        </span>

        <RowMeta
          items={[
            <DifficultyBadge key="difficulty" difficulty={question.difficulty} variant="bare" />,
            <PatternChip key="pattern" pattern={pattern} variant="bare" />,
            // The label alone is not decodable — "Variant" means nothing until you know the
            // taxonomy — so the meaning rides along on hover and for assistive tech.
            <span key="type" title={QUESTION_TYPE_MEANING[question.type]}>
              {QUESTION_TYPE_LABEL[question.type]}
            </span>,
            <span key="status" className="inline-flex items-center gap-1">
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {STATUS_LABEL[progress.status]}
            </span>,
            hasNotes && <FileText key="notes" className="h-3.5 w-3.5" role="img" aria-label="Has notes" />,
          ]}
        />
      </button>
    </RuledItem>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* QuestionCard — how a question appears when you can act on it                                  */
/* ------------------------------------------------------------------------------------------- */

export interface QuestionCardProps {
  question: Question;
  progress: QuestionProgress;
  /**
   * There is no `browse` context any more: a list you are scanning renders `QuestionRow`. A card
   * is a plate, and a plate has to earn itself — here it does, because the card carries the
   * day's solve controls or the session's grade controls.
   */
  context: 'today' | 'revision';
  onOpenDetail: (id: number) => void;
}

export function QuestionCard({ question, progress, context, onOpenDetail }: QuestionCardProps) {
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
        className="cursor-pointer p-5 transition-colors duration-150 ease-swift hover:border-primary/40"
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
            one fact"). Which is also why the difficulty and pattern go in borderless: a bordered
            chip inside a metadata line is a plate nested in plain text. The estimate wears a
            tilde: it is a band, not a measurement. */}
        <Meta
          className="mt-2"
          items={[
            <DifficultyBadge key="difficulty" difficulty={question.difficulty} variant="bare" />,
            <PatternChip key="pattern" pattern={pattern} variant="bare" />,
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
