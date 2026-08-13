import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export interface QuestionFilterRowProps {
  difficulty: DifficultyFilterValue;
  onDifficultyChange: (value: DifficultyFilterValue) => void;
  status: StatusFilterValue;
  onStatusChange: (value: StatusFilterValue) => void;
  statusOptions: QuestionStatusFilter[];
  pattern: PatternFilterValue;
  onPatternChange: (value: PatternFilterValue) => void;
}

// The group headings are visual only below sm. At 375px "Difficulty" + "Status" + "Pattern" cost
// ~150px of a ~343px line — enough to push the row from three wrapped lines to five before any
// content is visible — while saying nothing the chips ("Easy", "Solved") do not already say.
// They come back at sm, where there is room. Nothing is lost for assistive tech: each group is a
// labelled `role="group"` (which the loose <span> next to the chips never was), so the heading is
// announced whether or not it is painted, and it is aria-hidden when visible to avoid saying it
// twice. The container plate, if any, belongs to the calling page.
const GROUP_CLASS = 'flex flex-wrap items-center gap-1.5 sm:gap-2';
const GROUP_LABEL_CLASS = 'hidden text-sm text-muted-foreground sm:inline';

// Shared difficulty-chips + status-chips + pattern-select filter row, used by both SearchDialog
// and BookmarksPage so a label/styling/behavior change only has to be made in one place. Chips
// are single-select-with-clear: clicking the already-selected chip resets that field to "all"
// rather than requiring a separate "All" option.
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
          <Button
            key={d}
            type="button"
            size="sm"
            variant={difficulty === d ? 'default' : 'outline'}
            aria-pressed={difficulty === d}
            onClick={() => toggleDifficulty(d)}
          >
            {DIFFICULTY_CHIP_LABEL[d]}
          </Button>
        ))}
      </div>

      <div role="group" aria-label="Status" className={GROUP_CLASS}>
        <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
          Status
        </span>
        {statusOptions.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            aria-pressed={status === s}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_CHIP_LABEL[s]}
          </Button>
        ))}
      </div>

      {/* Full width on phones so the select gets its own line rather than overflowing one. */}
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
    </div>
  );
}
