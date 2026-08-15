// `QuestionCard` itself is gone, and its absence is the point.
//
// It was a `Card` (= `.glass`) at `p-5` carrying a hover lift, a 3-line clamp, revision pips, a
// confidence rating and up to five buttons — the "repeated giant card" that the V9 recomposition
// exists to remove from question lists. Every one of its call sites had already migrated to
// `QuestionRow` below, so by the end of the pass it rendered nowhere: 166 lines of dead plate.
//
// DESIGN.md § Figures, not stat cards records deleting `StatCard` on exactly this reasoning — "a
// dead plate primitive is a re-entry point for the box problem" — and this one was the worse of
// the two, because it is the *question* plate. The next surface needing a question in a list would
// have found it and used it, and the box problem would grow back from its own component library.
//
// What survives is what is actually used: the two status maps (also read by SearchDialog) and
// `QuestionRow`, the dense editorial row that replaced the card.
import type { ReactNode } from 'react';
import { BookmarkCheck, CheckCircle2, Circle, FileText, PlayCircle, SkipForward } from 'lucide-react';
import { RuledItem } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { patternById } from '@/data/patterns';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_MEANING } from '@/data/questionTypes';
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

// `py-2 gap-0.5`, down from `py-3.5 gap-1`. This is the most repeated surface in the product —
// 539 questions render through it — so 20px off one row is a full extra row in every viewport of
// every list. The row stays three readable lines and a ~73px tap target, comfortably past 44px;
// what got cut is only the padding that made an index entry read like a small card.
const ROW_BUTTON =
  '-mx-2 flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors duration-150 ease-swift ' +
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
            `title` and in the question sheet.

            From `sm` up only: at 375px this line was 22% of every row on a page the learner
            scans, and a clamped fragment of a 156-character sentence carries little at that
            width. The sentence is one tap away in the sheet; scanning is what a phone list is
            for. (`hidden` + `sm:line-clamp-1` works because responsive variants sort after base
            utilities, so the clamp's display wins at sm+.) */}
        <span className="hidden text-xs text-muted-foreground sm:line-clamp-1" title={question.tests}>
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
