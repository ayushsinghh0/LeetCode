import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { STATUS_ICON, STATUS_LABEL } from '@/components/questions/QuestionCard';
import {
  ALL_STATUS_OPTIONS,
  QuestionFilterRow,
  type DifficultyFilterValue,
  type PatternFilterValue,
  type StatusFilterValue,
} from '@/components/shared/QuestionFilterRow';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet, searchOpenSet } from '@/store/slices/uiSlice';
import { useToday } from '@/hooks/useToday';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { filterQuestions } from '@/utils/filterQuestions';
import type { Question } from '@/types';

const questions = questionsData as Question[];

// Cap rendered rows for a broad/unfiltered query — the dataset is 539 questions and this dialog
// has no virtualization, so an unbounded render on e.g. a single-letter query would be sluggish.
const RESULTS_LIMIT = 50;

// Mount once (e.g. in AppShell) — a singleton controlled entirely by ui.searchOpen, mirroring
// QuestionDetailModal's activeQuestionId pattern. Owns the global Ctrl/Cmd+K hotkey itself so any
// other trigger (Sidebar's search button) only has to dispatch searchOpenSet(true).
export function SearchDialog() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const searchOpen = useAppSelector((s) => s.ui.searchOpen);
  const byId = useAppSelector((s) => s.progress.byId);

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilterValue>('all');
  const [status, setStatus] = useState<StatusFilterValue>('all');
  const [pattern, setPattern] = useState<PatternFilterValue>('all');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(searchOpenSet(true));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Every fresh open starts from a blank slate rather than remembering the last search.
  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setDifficulty('all');
      setStatus('all');
      setPattern('all');
    }
  }, [searchOpen]);

  const hasActiveFilter = query.trim() !== '' || difficulty !== 'all' || status !== 'all' || pattern !== 'all';

  const results = useMemo(() => {
    if (!hasActiveFilter) return [];
    return filterQuestions(
      questions,
      byId,
      {
        query: query || undefined,
        difficulty: difficulty === 'all' ? undefined : difficulty,
        status: status === 'all' ? undefined : status,
        pattern: pattern === 'all' ? undefined : pattern,
      },
      today,
    );
  }, [byId, query, difficulty, status, pattern, today, hasActiveFilter]);

  const visibleResults = results.slice(0, RESULTS_LIMIT);
  const hiddenCount = results.length - visibleResults.length;

  function handleOpenChange(open: boolean) {
    dispatch(searchOpenSet(open));
  }

  function openResult(id: number) {
    dispatch(activeQuestionSet(id));
    dispatch(searchOpenSet(false));
  }

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      {searchOpen && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Questions</DialogTitle>
            <DialogDescription>Search by title, or filter by difficulty, status, and pattern.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              placeholder="Search questions by title..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <QuestionFilterRow
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            status={status}
            onStatusChange={setStatus}
            statusOptions={ALL_STATUS_OPTIONS}
            pattern={pattern}
            onPatternChange={setPattern}
          />

          {!hasActiveFilter ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Type to search by title, or use a filter above to browse.
            </p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No questions match your search.</p>
          ) : (
            <div data-testid="search-results" className="flex flex-col gap-2">
              {visibleResults.map((q) => {
                const progress = byId[q.id] ?? initialProgress();
                const StatusIcon = STATUS_ICON[progress.status];
                return (
                  <button
                    key={q.id}
                    type="button"
                    className="glass flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors duration-150 ease-swift hover:border-primary/40"
                    onClick={() => openResult(q.id)}
                  >
                    <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 truncate font-medium">{q.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{STATUS_LABEL[progress.status]}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <PatternChip pattern={patternById[q.pattern]} />
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  Showing {visibleResults.length} of {results.length} — refine your search to see more.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

export default SearchDialog;
