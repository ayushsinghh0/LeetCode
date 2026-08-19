import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/utils/cn';
import { PATTERNS } from '@/data/patterns';
import type { QuestionStatusFilter } from '@/utils/filterQuestions';
import type { Difficulty, PatternId } from '@/types';

export type DifficultyFilterValue = 'all' | Difficulty;
export type StatusFilterValue = 'all' | QuestionStatusFilter;
export type PatternFilterValue = 'all' | PatternId;

export const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_CHIP_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// Every status the filter engine (src/utils/filterQuestions.ts) supports. Callers may render a
// subset via the `statusOptions` prop — e.g. BookmarksPage drops "Bookmarked" since every row
// there already is one, which would make that chip a permanent no-op.
export const ALL_STATUS_OPTIONS: QuestionStatusFilter[] = ['solved', 'unsolved', 'needs-revision', 'bookmarked'];
export const STATUS_CHIP_LABEL: Record<QuestionStatusFilter, string> = {
  solved: 'Solved',
  unsolved: 'Unsolved',
  'needs-revision': 'Needs Revision',
  bookmarked: 'Bookmarked',
};

interface QuestionFilterRowBaseProps {
  difficulty: DifficultyFilterValue;
  onDifficultyChange: (value: DifficultyFilterValue) => void;
  status: StatusFilterValue;
  onStatusChange: (value: StatusFilterValue) => void;
  statusOptions: QuestionStatusFilter[];
}

/**
 * The pattern select is optional, and the two halves travel together so a caller can't hand over
 * a value with no handler. A surface already scoped to one pattern (PatternDetailPage) has no use
 * for it: every choice but its own would narrow the list to nothing.
 */
type PatternFilterProps =
  | { pattern: PatternFilterValue; onPatternChange: (value: PatternFilterValue) => void }
  | { pattern?: never; onPatternChange?: never };

export type QuestionFilterRowProps = QuestionFilterRowBaseProps & PatternFilterProps;

// The group headings are visual only below sm. At 375px "Difficulty" + "Status" + "Pattern" cost
// ~150px of a ~343px line — enough to push the row from three wrapped lines to five before any
// content is visible — while saying nothing the chips ("Easy", "Solved") do not already say.
// They come back at sm, where there is room. Nothing is lost for assistive tech: each group is a
// labelled `role="group"` (which the loose <span> next to the chips never was), so the heading is
// announced whether or not it is painted, and it is aria-hidden when visible to avoid saying it
// twice. The container plate, if any, belongs to the calling page.
export const GROUP_CLASS = 'flex flex-wrap items-center gap-1.5 sm:gap-2';
// The register the app's other chip rows label themselves with (SessionPlan and RevisionPage's
// "How long have you got?" legends) — quieter than the chips it introduces, which is the point.
export const GROUP_LABEL_CLASS = 'hidden text-xs font-medium tracking-wide text-muted-foreground sm:inline';

// The app's chip idiom, shared with the capacity chips (SessionPlan) and the session-length chips
// (RevisionPage): a small `rounded-sm` hairline toggle in the figure face, ink-filled when active.
// These used to be full-size `Button size="sm"`s — up to seven h-9 bordered rectangles in a row,
// which read as a toolbar of primary actions rather than as filters on the list beneath them.
// `min-h-11` + `inline-flex items-center`: at `py-1` on `text-xs` these computed to 26px, and they
// are the primary control on /bookmarks and the pattern pages — the row you actually operate to
// find anything. The capacity and session-length chips they are the sibling of already carry
// `min-h-[44px]` for the same reason; this row was the one that did not.
//
// This is a min-height on the bordered element, so the DRAWN chip grows 26px → 44px, not just the
// hit area — a real increase in visual weight for a row of up to seven ink-fillable chips. That is
// accepted here because the row is a primary control rather than metadata; if a future surface
// needs the 26px look with a 44px target, the answer is a padded pseudo-element
// (`relative` + `after:absolute after:-inset-y-2`), not a smaller `min-h`.
// Exported (with the group classes above) so ContestPracticePage's filter groups are the SAME
// idiom rather than a third hand-written copy — ChipRadioRow's docstring records how duplicated
// chip idioms drift invisibly, and these classes were already the second declaration.
export const CHIP_CLASS =
  'figures inline-flex min-h-11 items-center rounded-sm border px-2.5 py-1 text-xs ' +
  'transition-colors duration-150 ease-swift focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
export const CHIP_ACTIVE = 'border-primary bg-primary text-primary-foreground';
export const CHIP_IDLE = 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground';

// Shared difficulty-chips + status-chips + optional pattern-select filter row, used by
// SearchDialog, BookmarksPage and PatternDetailPage so a label/styling/behavior change only has
// to be made in one place — and so two adjacent pages stop shipping two designs for one job.
// Chips are single-select-with-clear: clicking the already-selected chip resets that field to
// "all" rather than requiring a separate "All" option.
export function QuestionFilterRow({
  difficulty,
  onDifficultyChange,
  status,
  onStatusChange,
  statusOptions,
  pattern,
  onPatternChange,
}: QuestionFilterRowProps) {
  function toggleDifficulty(value: Difficulty) {
    onDifficultyChange(difficulty === value ? 'all' : value);
  }

  function toggleStatus(value: QuestionStatusFilter) {
    onStatusChange(status === value ? 'all' : value);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Difficulty" className={GROUP_CLASS}>
        <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
          Difficulty
        </span>
        {DIFFICULTY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={difficulty === d}
            onClick={() => toggleDifficulty(d)}
            className={cn(CHIP_CLASS, difficulty === d ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            {DIFFICULTY_CHIP_LABEL[d]}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Status" className={GROUP_CLASS}>
        <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
          Status
        </span>
        {statusOptions.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => toggleStatus(s)}
            className={cn(CHIP_CLASS, status === s ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            {STATUS_CHIP_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Full width on phones so the select gets its own line rather than overflowing one. */}
      {pattern !== undefined && onPatternChange && (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
            Pattern
          </span>
          <Select value={pattern} onValueChange={(v) => onPatternChange(v as PatternFilterValue)}>
            <SelectTrigger aria-label="Filter by pattern" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patterns</SelectItem>
              {PATTERNS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
