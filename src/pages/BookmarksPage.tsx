import { useMemo, useState } from 'react';
import { Bookmark, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { QuestionCard } from '@/components/questions/QuestionCard';
import {
  QuestionFilterRow,
  type DifficultyFilterValue,
  type PatternFilterValue,
  type StatusFilterValue,
} from '@/components/shared/QuestionFilterRow';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectBookmarkedIds, selectQuestionById } from '@/store/selectors';
import { useToday } from '@/hooks/useToday';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { filterQuestions, type QuestionStatusFilter } from '@/utils/filterQuestions';
import type { Question } from '@/types';

// "bookmarked" is excluded here — every question on this page already is, so it would be a
// permanent no-op filter (see src/components/shared/QuestionFilterRow.tsx's ALL_STATUS_OPTIONS,
// which SearchDialog uses in full).
const STATUS_OPTIONS: QuestionStatusFilter[] = ['solved', 'unsolved', 'needs-revision'];

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
          <div className="glass p-4">
            <QuestionFilterRow
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              status={status}
              onStatusChange={setStatus}
              statusOptions={STATUS_OPTIONS}
              pattern={pattern}
              onPatternChange={setPattern}
            />
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
