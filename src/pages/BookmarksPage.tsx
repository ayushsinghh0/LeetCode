import { useMemo, useState } from 'react';
import { Bookmark, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PATTERNS } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectBookmarkedIds, selectQuestionById } from '@/store/selectors';
import { useToday } from '@/hooks/useToday';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { filterQuestions, type QuestionStatusFilter } from '@/utils/filterQuestions';
import type { Difficulty, PatternId, Question } from '@/types';

type DifficultyFilterValue = 'all' | Difficulty;
// "bookmarked" is excluded here — every question on this page already is, so it would be a
// no-op filter (see src/utils/filterQuestions.ts for the full status union used by SearchDialog).
type BookmarksStatusFilter = Exclude<QuestionStatusFilter, 'bookmarked'>;
type StatusFilterValue = 'all' | BookmarksStatusFilter;
type PatternFilterValue = 'all' | PatternId;

const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_CHIP_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const STATUS_OPTIONS: BookmarksStatusFilter[] = ['solved', 'unsolved', 'needs-revision'];
const STATUS_CHIP_LABEL: Record<BookmarksStatusFilter, string> = {
  solved: 'Solved',
  unsolved: 'Unsolved',
  'needs-revision': 'Needs Revision',
};

export default function BookmarksPage() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const progressById = useAppSelector((s) => s.progress.byId);
  const bookmarkedIds = useAppSelector(selectBookmarkedIds);

  const [difficulty, setDifficulty] = useState<DifficultyFilterValue>('all');
  const [status, setStatus] = useState<StatusFilterValue>('all');
  const [pattern, setPattern] = useState<PatternFilterValue>('all');

  const bookmarkedQuestions = useMemo(
    () =>
      bookmarkedIds
        .map((id) => selectQuestionById(id))
        .filter((q): q is Question => q !== undefined)
        .sort((a, b) => a.id - b.id),
    [bookmarkedIds],
  );

  const filtered = useMemo(
    () =>
      filterQuestions(
        bookmarkedQuestions,
        progressById,
        {
          difficulty: difficulty === 'all' ? undefined : difficulty,
          status: status === 'all' ? undefined : status,
          pattern: pattern === 'all' ? undefined : pattern,
        },
        today,
      ),
    [bookmarkedQuestions, progressById, difficulty, status, pattern, today],
  );

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  function toggleDifficulty(value: Difficulty) {
    setDifficulty((current) => (current === value ? 'all' : value));
  }

  function toggleStatus(value: BookmarksStatusFilter) {
    setStatus((current) => (current === value ? 'all' : value));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="glass p-6">
        <h1 className="text-2xl font-bold text-gradient">Bookmarks</h1>
        <p className="text-sm text-muted-foreground">
          {bookmarkedQuestions.length} bookmarked question{bookmarkedQuestions.length === 1 ? '' : 's'}
        </p>
      </header>

      {bookmarkedQuestions.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          hint="Bookmark a question from its detail view to save it here for quick access."
        />
      ) : (
        <>
          <div className="glass flex flex-wrap items-center gap-4 p-4">
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
              {STATUS_OPTIONS.map((s) => (
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
              <Select value={pattern} onValueChange={(v) => setPattern(v as PatternFilterValue)}>
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

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="No bookmarks match these filters" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  progress={progressById[q.id] ?? initialProgress()}
                  context="browse"
                  onOpenDetail={openQuestion}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
