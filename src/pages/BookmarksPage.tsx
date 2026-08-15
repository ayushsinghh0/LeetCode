import { useMemo, useState } from 'react';
import { Bookmark, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Panel, RuledList, Screen, ScreenBody, ScreenHeader } from '@/components/layout/Page';
import { QuestionRow } from '@/components/questions/QuestionCard';
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

  const count = bookmarkedQuestions.length;

  return (
    <Screen>
      {/* One purpose clause. The support's first sentence — "Questions you flagged to come back
          to" — was the eyebrow's "N bookmarked questions" said again in the reading voice, and a
          masthead that states a fact twice teaches the reader to skip it. What survives is the
          only part the eyebrow doesn't carry: what to do with the list. */}
      <ScreenHeader
        eyebrow={`${count} bookmarked question${count === 1 ? '' : 's'}`}
        title="Bookmarks"
        support="Narrow the list, then open one to work on it."
      />

      {count === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          hint="Bookmark a question from its detail view to save it here for quick access."
        />
      ) : (
        // The filter row is chrome for the list below it, so it sits on the page ground directly
        // under the masthead rule. It draws its own boundary out of chips and a select; wrapping
        // that in a plate was a second outline around something already outlined.
        // The landmark stays a real labelled region. `ScreenBody` is layout, not semantics — it
        // takes no `aria-label`, so replacing the old `Section` with it silently dropped the
        // "Bookmarked questions" region. A named section inside the body keeps both.
        <ScreenBody>
          <section
            aria-label="Bookmarked questions"
            className="flex flex-col gap-4 md:min-h-0 md:flex-1"
          >
          <QuestionFilterRow
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_OPTIONS}
            pattern={pattern}
            onPatternChange={setPattern}
          />

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="No bookmarks match these filters" />
          ) : (
            // Hairline-ruled rows, not a grid of cards. A bookmark list is something you scan and
            // pick from, so each entry is an index row on the page ground — boxing every one of
            // them was the "list becomes plates" defect DESIGN.md § The plate rule names.
            // The filter row stays put while the list scrolls beneath it — the control that
            // narrows a list should not scroll away from the list it narrows.
            <Panel>
              <RuledList>
                {filtered.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    progress={progressById[q.id] ?? initialProgress()}
                    onOpen={openQuestion}
                  />
                ))}
              </RuledList>
            </Panel>
          )}
          </section>
        </ScreenBody>
      )}
    </Screen>
  );
}
