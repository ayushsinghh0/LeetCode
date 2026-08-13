import { screen, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
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

function renderDetail(patternId: string, store: AppStore = makeStore()) {
  return renderWithStore(
    <Routes>
      <Route path="/patterns/:patternId" element={<PatternDetailPage />} />
    </Routes>,
    store,
    `/patterns/${patternId}`,
  );
}

// Pins the clock to TODAY, same idiom as every other date-sensitive page suite (e.g.
// dashboard.test.tsx, calendar.test.tsx). Was missing here even though this file already defines
// TODAY and dispatches solveQuestion (which reads the real clock via todayISO()) — harmless while
// the real date happened to still be 2026-07-30, but a latent bug that broke the "needs-revision"
// test the moment the real date moved on, unrelated to this file's actual subject matter.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

// A pattern row carries one progression, not four: an icon, the name, one bar and one
// solved/total figure. The old four-column micro-table (solved / in revision / mastered /
// remaining) moved to the pattern's own page, so these assertions moved with it — see the
// "breakdown" test in the PatternDetailPage block below, which pins the same four numbers there.
describe('PatternsPage', () => {
  test('renders one row per pattern, and the two-pointers row accounts for all 34 of its questions', () => {
    renderWithStore(<PatternsPage />, makeStore(), '/patterns');

    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(TOTAL_PATTERNS);

    const row = screen.getByText('Two Pointers').closest('a')!;
    expect(within(row).getByText('0/34')).toBeInTheDocument();
  });

  test('fresh store: every row shows none of its questions solved', () => {
    renderWithStore(<PatternsPage />, makeStore(), '/patterns');

    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(TOTAL_PATTERNS);
    // Per row rather than a global count of "0%" strings: this also proves each row carries its
    // own figure, which a page-wide tally does not.
    for (const row of rows) {
      expect(within(row).getByText(/^0\/\d+$/)).toBeInTheDocument();
    }
  });

  test('after solving ids 1-3 (all two-pointers), the two-pointers row shows 3 of 34 solved', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));
    store.dispatch(solveQuestion(3));
    renderWithStore(<PatternsPage />, store, '/patterns');

    const row = screen.getByText('Two Pointers').closest('a')!;
    expect(within(row).getByText('3/34')).toBeInTheDocument();
    expect(within(row).getByLabelText('Two Pointers completion')).toHaveAttribute('aria-valuenow', '9');
  });
});

describe('PatternDetailPage', () => {
  test('two-pointers detail page lists all 34 questions as browse cards', () => {
    renderDetail('two-pointers');

    // Each QuestionCard's root is role="button" (browse context renders no action buttons),
    // so counting buttons counts rendered cards.
    expect(screen.getAllByRole('button')).toHaveLength(twoPointersQuestions.length);
    expect(screen.getByText(twoPointersQuestions[0]!.title)).toBeInTheDocument();
  });

  test('the progress region carries the breakdown the list rows dropped', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // a two-pointers question
    renderDetail('two-pointers', store);

    // Scoped to the region: "Solved" is also a QuestionCard status label further down the page.
    const progress = screen.getByRole('region', { name: 'Progress' });
    for (const label of ['Solved', 'Mastered', 'In revision', 'Pass rate']) {
      expect(within(progress).getByText(label)).toBeInTheDocument();
    }
    expect(within(progress).getByText('1/34')).toBeInTheDocument();
    expect(within(progress).getByText('no reviews yet')).toBeInTheDocument();
  });

  test('invalid patternId shows a "Pattern not found" empty state with a link back to /patterns', () => {
    renderDetail('nope');

    expect(screen.getByText('Pattern not found')).toBeInTheDocument();
    expect(screen.queryByText(twoPointersQuestions[0]!.title)).not.toBeInTheDocument();

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
