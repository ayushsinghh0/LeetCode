import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { PATTERNS, patternById } from '@/data/patterns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { STATUS_ICON, STATUS_LABEL } from '@/components/questions/QuestionCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet, searchOpenSet } from '@/store/slices/uiSlice';
import { useToday } from '@/hooks/useToday';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { filterQuestions, type QuestionStatusFilter } from '@/utils/filterQuestions';
import type { Difficulty, PatternId, Question } from '@/types';

const questions = questionsData as Question[];

// Cap rendered rows for a broad/unfiltered query — the dataset is 539 questions and this dialog
// has no virtualization, so an unbounded render on e.g. a single-letter query would be sluggish.
const RESULTS_LIMIT = 50;

type DifficultyFilterValue = 'all' | Difficulty;
type StatusFilterValue = 'all' | QuestionStatusFilter;
type PatternFilterValue = 'all' | PatternId;

const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_CHIP_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const STATUS_OPTIONS: QuestionStatusFilter[] = ['solved', 'unsolved', 'needs-revision', 'bookmarked'];
const STATUS_CHIP_LABEL: Record<QuestionStatusFilter, string> = {
  solved: 'Solved',
  unsolved: 'Unsolved',
  'needs-revision': 'Needs Revision',
  bookmarked: 'Bookmarked',
};

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

  function toggleDifficulty(value: Difficulty) {
    setDifficulty((current) => (current === value ? 'all' : value));
  }

  function toggleStatus(value: QuestionStatusFilter) {
    setStatus((current) => (current === value ? 'all' : value));
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
                    className="glass flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-white/5"
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
