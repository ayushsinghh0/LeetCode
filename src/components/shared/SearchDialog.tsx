import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Moon, Search, Sun, Timer, type LucideIcon } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { COURSE_WEEKS, type CourseWeek } from '@/data/aimlCourse';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { STATUS_ICON, STATUS_LABEL } from '@/components/questions/QuestionCard';
import { NAV_ITEMS } from '@/components/layout/navItems';
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
import { useTheme } from '@/contexts/ThemeContext';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { initialCourseProgress, isWeekDone, isWeekRetained } from '@/utils/engine/aimlCourse';
import { filterQuestions } from '@/utils/filterQuestions';
import { cn } from '@/utils/cn';
import type { CourseWeekProgress, Question } from '@/types';

const questions = questionsData as Question[];

// Caps keep the un-virtualized list snappy: the dataset is 539 questions, and a single-letter
// query would otherwise render most of it.
const QUESTION_LIMIT = 50;
const WEEK_LIMIT = 8;

type PaletteItem =
  | { kind: 'page'; label: string; icon: LucideIcon; to: string }
  | { kind: 'action'; label: string; icon: LucideIcon; run: () => void }
  | { kind: 'week'; week: CourseWeek }
  | { kind: 'question'; question: Question };

function weekLabel(week: CourseWeek): string {
  return week.optional ? week.title : `Week ${week.week} — ${week.title}`;
}

function weekState(week: CourseWeek, progress: CourseWeekProgress): string {
  if (isWeekRetained(progress)) return 'retained';
  if (isWeekDone(week, progress)) return 'cleared';
  return progress.day1DoneOn !== null ? 'in progress' : 'not started';
}

// Mount once (e.g. in AppShell) — a singleton controlled entirely by ui.searchOpen, mirroring
// QuestionDetailModal's activeQuestionId pattern. Owns the global Ctrl/Cmd+K hotkey itself so any
// other trigger (Sidebar's search button) only has to dispatch searchOpenSet(true).
//
// This is the app's command palette: page commands and actions surface on open, course weeks
// and questions match as you type, and ArrowUp/ArrowDown + Enter drive the whole list
// (combobox + listbox semantics; the input keeps focus, aria-activedescendant tracks the row).
export function SearchDialog() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const today = useToday();
  const searchOpen = useAppSelector((s) => s.ui.searchOpen);
  const byId = useAppSelector((s) => s.progress.byId);
  const courseByWeekId = useAppSelector((s) => s.course.byWeekId);

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilterValue>('all');
  const [status, setStatus] = useState<StatusFilterValue>('all');
  const [pattern, setPattern] = useState<PatternFilterValue>('all');
  const [activeIndex, setActiveIndex] = useState(0);

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
      setActiveIndex(0);
    }
  }, [searchOpen]);

  const trimmed = query.trim().toLowerCase();
  const hasQuestionFilter = difficulty !== 'all' || status !== 'all' || pattern !== 'all';
  const hasActiveFilter = trimmed !== '' || hasQuestionFilter;

  // Pages and actions list on open and narrow as you type; the question filter chips signal
  // question-browsing intent, so commands and weeks step aside while any chip is set.
  const pageItems = useMemo((): PaletteItem[] => {
    if (hasQuestionFilter) return [];
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(trimmed)).map((item) => ({
      kind: 'page',
      label: item.label,
      icon: item.icon,
      to: item.to,
    }));
  }, [trimmed, hasQuestionFilter]);

  const actionItems = useMemo((): PaletteItem[] => {
    if (hasQuestionFilter) return [];
    const actions: Extract<PaletteItem, { kind: 'action' }>[] = [
      {
        kind: 'action',
        label: 'Start focus mode',
        icon: Timer,
        run: () => navigate('/focus'),
      },
      {
        kind: 'action',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: theme === 'dark' ? Sun : Moon,
        run: toggleTheme,
      },
    ];
    return actions.filter((a) => a.label.toLowerCase().includes(trimmed));
  }, [trimmed, hasQuestionFilter, theme, toggleTheme, navigate]);

  const weekItems = useMemo((): PaletteItem[] => {
    if (trimmed === '' || hasQuestionFilter) return [];
    return COURSE_WEEKS.filter((week) => weekLabel(week).toLowerCase().includes(trimmed))
      .slice(0, WEEK_LIMIT)
      .map((week) => ({ kind: 'week', week }));
  }, [trimmed, hasQuestionFilter]);

  const questionResults = useMemo(() => {
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

  const visibleQuestions = questionResults.slice(0, QUESTION_LIMIT);
  const hiddenCount = questionResults.length - visibleQuestions.length;

  const questionItems = useMemo(
    (): PaletteItem[] => visibleQuestions.map((question) => ({ kind: 'question', question })),
    [visibleQuestions],
  );

  const items = useMemo(
    () => [...pageItems, ...actionItems, ...weekItems, ...questionItems],
    [pageItems, actionItems, weekItems, questionItems],
  );

  // Typing or filtering re-anchors the highlight to the first row.
  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed, difficulty, status, pattern]);

  useEffect(() => {
    document.getElementById(`palette-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  function handleOpenChange(open: boolean) {
    dispatch(searchOpenSet(open));
  }

  function selectItem(item: PaletteItem) {
    if (item.kind === 'page') {
      navigate(item.to);
    } else if (item.kind === 'action') {
      item.run();
    } else if (item.kind === 'week') {
      navigate('/aiml');
    } else {
      dispatch(activeQuestionSet(item.question.id));
    }
    dispatch(searchOpenSet(false));
  }

  function handleInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[Math.min(activeIndex, items.length - 1)];
      if (item) selectItem(item);
    }
  }

  // Flat index across all sections so one activedescendant walks the whole palette.
  const actionOffset = pageItems.length;
  const weekOffset = actionOffset + actionItems.length;
  const questionOffset = weekOffset + weekItems.length;

  const optionRowClass = (index: number) =>
    cn(
      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ease-swift',
      index === activeIndex ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      {searchOpen && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Jump to a page, run an action, or search questions and course weeks.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-listbox"
              aria-activedescendant={items.length > 0 ? `palette-option-${activeIndex}` : undefined}
              aria-autocomplete="list"
              placeholder="Search questions, course weeks, pages..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
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

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches your search.</p>
          ) : (
            <div id="palette-listbox" role="listbox" aria-label="Search results" className="flex flex-col gap-3">
              {pageItems.length > 0 && (
                <div role="group" aria-label="Go to" className="flex flex-col gap-1">
                  <p aria-hidden="true" className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Go to
                  </p>
                  {pageItems.map((item, i) => {
                    if (item.kind !== 'page') return null;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        type="button"
                        role="option"
                        id={`palette-option-${i}`}
                        aria-selected={i === activeIndex}
                        className={optionRowClass(i)}
                        onClick={() => selectItem(item)}
                        onMouseMove={() => setActiveIndex(i)}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {actionItems.length > 0 && (
                <div role="group" aria-label="Actions" className="flex flex-col gap-1">
                  <p aria-hidden="true" className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Actions
                  </p>
                  {actionItems.map((item, i) => {
                    if (item.kind !== 'action') return null;
                    const index = actionOffset + i;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        role="option"
                        id={`palette-option-${index}`}
                        aria-selected={index === activeIndex}
                        className={optionRowClass(index)}
                        onClick={() => selectItem(item)}
                        onMouseMove={() => setActiveIndex(index)}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {weekItems.length > 0 && (
                <div role="group" aria-label="Course weeks" className="flex flex-col gap-1">
                  <p aria-hidden="true" className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Course weeks
                  </p>
                  {weekItems.map((item, i) => {
                    if (item.kind !== 'week') return null;
                    const index = weekOffset + i;
                    const progress = courseByWeekId[item.week.id] ?? initialCourseProgress();
                    return (
                      <button
                        key={item.week.id}
                        type="button"
                        role="option"
                        id={`palette-option-${index}`}
                        aria-selected={index === activeIndex}
                        className={optionRowClass(index)}
                        onClick={() => selectItem(item)}
                        onMouseMove={() => setActiveIndex(index)}
                      >
                        <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate font-medium">{weekLabel(item.week)}</span>
                        <span className="figures text-xs">{weekState(item.week, progress)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {questionItems.length > 0 && (
                <div role="group" aria-label="Questions" data-testid="search-results" className="flex flex-col gap-2">
                  {(pageItems.length > 0 || actionItems.length > 0 || weekItems.length > 0) && (
                    <p aria-hidden="true" className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Questions
                    </p>
                  )}
                  {questionItems.map((item, i) => {
                    if (item.kind !== 'question') return null;
                    const index = questionOffset + i;
                    const q = item.question;
                    const progress = byId[q.id] ?? initialProgress();
                    const StatusIcon = STATUS_ICON[progress.status];
                    return (
                      <button
                        key={q.id}
                        type="button"
                        role="option"
                        id={`palette-option-${index}`}
                        aria-selected={index === activeIndex}
                        className={cn(
                          'glass flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors duration-150 ease-swift',
                          index === activeIndex ? 'border-primary/40 bg-muted' : 'hover:border-primary/40',
                        )}
                        onClick={() => selectItem(item)}
                        onMouseMove={() => setActiveIndex(index)}
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
                      Showing {visibleQuestions.length} of {questionResults.length} — refine your search to see more.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

export default SearchDialog;
