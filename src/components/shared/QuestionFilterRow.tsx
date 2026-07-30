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
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Difficulty</span>
        {DIFFICULTY_OPTIONS.map((d) => (
          <Button
            key={d}
            type="button"
            size="sm"
            variant={difficulty === d ? 'default' : 'outline'}
            onClick={() => toggleDifficulty(d)}
          >
            {DIFFICULTY_CHIP_LABEL[d]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        {statusOptions.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_CHIP_LABEL[s]}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Pattern</span>
        <Select value={pattern} onValueChange={(v) => onPatternChange(v as PatternFilterValue)}>
          <SelectTrigger aria-label="Filter by pattern" className="w-48">
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
