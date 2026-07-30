import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import PatternsPage, { sortStats } from '@/pages/PatternsPage';
import PatternDetailPage, { filterPatternQuestions } from '@/pages/PatternDetailPage';
import { solveQuestion } from '@/store/actions';
import { PATTERNS } from '@/data/patterns';
import { weakestPatterns } from '@/utils/engine/recommendations';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress, PatternId } from '@/types';
import type { PatternStat } from '@/utils/engine/stats';

const questions = questionsData as Question[];
const TOTAL_PATTERNS = PATTERNS.length; // 28
const twoPointersQuestions = questions.filter((q) => q.pattern === 'two-pointers'); // ids 1-34

const TODAY = '2026-07-30';

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — mirrors src/pages/__tests__/roadmap.test.tsx.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderWithStore(ui: ReactNode, store: AppStore = makeStore(), initialPath = '/patterns') {
  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]} future={routerFutureFlags}>
            {ui}
          </MemoryRouter>
        </TooltipProvider>
      </Provider>,
    ),
  };
}

function renderDetail(patternId: string, store: AppStore = makeStore()) {
  return renderWithStore(
    <Routes>
      <Route path="/patterns/:patternId" element={<PatternDetailPage />} />
    </Routes>,
    store,
    `/patterns/${patternId}`,
  );
}

describe('PatternsPage', () => {
  test('renders 28 pattern cards, and the two-pointers card shows "34 Questions"', () => {
    renderWithStore(<PatternsPage />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(TOTAL_PATTERNS);

    const card = screen.getByText('Two Pointers').closest('a')!;
    expect(within(card).getByText('34 Questions')).toBeInTheDocument();
  });

  test('fresh store: every card shows 0%', () => {
    renderWithStore(<PatternsPage />);

    expect(screen.getAllByText('0%')).toHaveLength(TOTAL_PATTERNS);
  });

  test('after solving ids 1-3 (all two-pointers), the two-pointers card shows 3 solved', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));
    store.dispatch(solveQuestion(3));
    renderWithStore(<PatternsPage />, store);

    const card = screen.getByText('Two Pointers').closest('a')!;
    expect(within(card).getByLabelText('3 solved')).toBeInTheDocument();
  });
});

describe('PatternDetailPage', () => {
  test('two-pointers detail page lists all 34 questions as browse cards', () => {
    renderDetail('two-pointers');

    // Each QuestionCard's root is role="button" (browse context renders no action buttons),
    // so counting buttons counts rendered cards.
    expect(screen.getAllByRole('button')).toHaveLength(twoPointersQuestions.length);
    expect(screen.getByText(twoPointersQuestions[0].title)).toBeInTheDocument();
  });

  test('invalid patternId shows a "Pattern not found" empty state with a link back to /patterns', () => {
    renderDetail('nope');

    expect(screen.getByText('Pattern not found')).toBeInTheDocument();
    expect(screen.queryByText(twoPointersQuestions[0].title)).not.toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /patterns/i });
    expect(backLink).toHaveAttribute('href', '/patterns');
  });
});

// jsdom has no pointer-capture support, so Radix Select can't be driven open in tests (see
// src/components/ui/__tests__/primitives.test.tsx's Select smoke test). filterPatternQuestions is
// the pure helper the page delegates to, so the filter *logic* (status/difficulty cases 4 & 5 from
// the task brief) is unit-tested directly here instead of through Select DOM interaction.
describe('filterPatternQuestions', () => {
  test('status "solved": returns only the questions solved so far', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));
    const byId = store.getState().progress.byId;

    const result = filterPatternQuestions(twoPointersQuestions, byId, { status: 'solved', difficulty: 'all' }, TODAY);

    expect(result.map((q) => q.id).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  test('status "unsolved": excludes solved questions', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    const byId = store.getState().progress.byId;

    const result = filterPatternQuestions(twoPointersQuestions, byId, { status: 'unsolved', difficulty: 'all' }, TODAY);

    expect(result.some((q) => q.id === 1)).toBe(false);
    expect(result).toHaveLength(twoPointersQuestions.length - 1);
  });

  test('status "bookmarked": returns only bookmarked questions regardless of solve status', () => {
    const byId: Record<number, QuestionProgress> = {
      2: { ...emptyProgress(), bookmarked: true },
    };

    const result = filterPatternQuestions(twoPointersQuestions, byId, { status: 'bookmarked', difficulty: 'all' }, TODAY);

    expect(result.map((q) => q.id)).toEqual([2]);
  });

  test('status "needs-revision": solved AND due for revision, using isDue semantics', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // solved 2026-07-30; nextRevision = 2026-07-31 (not yet due)
    const byId = store.getState().progress.byId;

    const notDueYet = filterPatternQuestions(
      twoPointersQuestions, byId, { status: 'needs-revision', difficulty: 'all' }, '2026-07-30',
    );
    expect(notDueYet).toHaveLength(0);

    const dueNow = filterPatternQuestions(
      twoPointersQuestions, byId, { status: 'needs-revision', difficulty: 'all' }, '2026-07-31',
    );
    expect(dueNow.map((q) => q.id)).toEqual([1]);
  });

  test('difficulty "easy": returns only easy questions (count derived from the dataset, not hardcoded)', () => {
    const expectedCount = twoPointersQuestions.filter((q) => q.difficulty === 'easy').length;

    const result = filterPatternQuestions(twoPointersQuestions, {}, { status: 'all', difficulty: 'easy' }, TODAY);

    expect(result).toHaveLength(expectedCount);
    expect(result.every((q) => q.difficulty === 'easy')).toBe(true);
  });

  test('status + difficulty combine (AND, not OR)', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // id 1 is easy
    const byId = store.getState().progress.byId;

    const result = filterPatternQuestions(
      twoPointersQuestions, byId, { status: 'solved', difficulty: 'medium' }, TODAY,
    );

    expect(result).toHaveLength(0); // id 1 is solved but not medium
  });
});

// sortStats is a pure, dependency-free function (no jsdom/Select limitation applies here, unlike
// driving the sort-mode Select open via the DOM) — its three modes are unit-tested directly
// against a fixture mixing eligible and ineligible patterns (per weakestPatterns' eligibility
// rule: solved >= 3, OR at least one recorded revision attempt).
describe('sortStats', () => {
  function makeStat(overrides: Partial<PatternStat> & { pattern: PatternId }): PatternStat {
    return {
      total: 10,
      solved: 0,
      mastered: 0,
      inRevision: 0,
      remaining: 10,
      pct: 0,
      avgConfidence: null,
      revisionPassRate: null,
      ...overrides,
    };
  }

  // Course order: A, B, C, D, E.
  const statA = makeStat({ pattern: 'two-pointers', solved: 10, pct: 50, avgConfidence: 3, revisionPassRate: 0.6 }); // eligible (solved >= 3)
  const statB = makeStat({ pattern: 'sliding-window', solved: 1, pct: 20 }); // ineligible: solved < 3, no revision attempts
  const statC = makeStat({ pattern: 'intervals', solved: 6, pct: 50, avgConfidence: 4, revisionPassRate: 0.9 }); // eligible; ties statA on pct
  const statD = makeStat({ pattern: 'fast-slow-pointers', solved: 0, pct: 0 }); // ineligible: solved < 3, no revision attempts
  const statE = makeStat({ pattern: 'greedy', solved: 2, pct: 10, revisionPassRate: 0.2 }); // eligible via revisionPassRate !== null despite solved < 3

  const stats: PatternStat[] = [statA, statB, statC, statD, statE];

  test('"course": returns the input order unchanged', () => {
    expect(sortStats(stats, 'course')).toEqual(stats);
  });

  test('"completion": sorts by pct descending, with stable ties (A ties C on pct=50, A stays first)', () => {
    const result = sortStats(stats, 'completion');

    expect(result.map((s) => s.pattern)).toEqual([
      'two-pointers',   // pct 50, first of the tie in input order
      'intervals',      // pct 50, second of the tie
      'sliding-window', // pct 20
      'greedy',         // pct 10
      'fast-slow-pointers', // pct 0
    ]);
  });

  test('"weakest": eligible patterns in weakestPatterns() order, then ineligible patterns appended in course order', () => {
    const weakest = weakestPatterns(stats);
    // Sanity check on the fixture itself: greedy/two-pointers/intervals are eligible (in that
    // ascending-score order), sliding-window/fast-slow-pointers are not.
    expect(weakest.map((w) => w.pattern)).toEqual(['greedy', 'two-pointers', 'intervals']);

    const result = sortStats(stats, 'weakest');

    expect(result.map((s) => s.pattern)).toEqual([
      ...weakest.map((w) => w.pattern),   // eligible, ascending score (weakest first)
      'sliding-window', 'fast-slow-pointers', // ineligible, appended in course (input) order
    ]);
  });
});

function emptyProgress(): QuestionProgress {
  return {
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0,
  };
}
