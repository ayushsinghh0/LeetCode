import type { ReactElement } from 'react';
import { cloneElement } from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import AnalyticsPage from '@/pages/AnalyticsPage';
import { completeCourseSession, reviseCourseWeek, solveQuestion } from '@/store/actions';
import { selectStreaks, selectProductivityScore, selectWeakestPatterns } from '@/store/selectors';
import { consistency } from '@/utils/engine/stats';
import { PATTERNS, patternById } from '@/data/patterns';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

// --- Recharts + jsdom -------------------------------------------------------------------------
// jsdom has no layout engine, so ResponsiveContainer always measures its parent as 0x0 (Recharts
// then renders an empty chart body and logs a "width(0) and height(0) ... cannot be < 0" warning
// on every render). A plain CSS-sized wrapper div does NOT fix this — jsdom still reports 0 for
// offsetWidth/getBoundingClientRect regardless of inline/CSS width/height. The one thing that
// works: Recharts' chart roots (BarChart/AreaChart/...) accept explicit *numeric* width/height
// props directly and use those instead of measuring, which is exactly what ResponsiveContainer
// normally computes and injects for them. So this file (only this file — application code is
// untouched) replaces ResponsiveContainer with a component that clones its single child with a
// fixed width/height, producing real, fully-rendered chart SVGs and zero console warnings.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 800, height: 400 }),
  };
});

// --- "zero-filled series reached the chart" assertion strategy -------------------------------
// Rather than counting Recharts-internal DOM nodes (a `.recharts-bar-rectangle` class query would
// depend on Recharts' internal markup, effectively snapshotting SVG structure — explicitly what
// the task brief says not to do), every chart in src/components/charts renders a visually-hidden
// (`sr-only`) caption stating its exact data-point count and date range. That caption is real,
// accessible content (a textual equivalent of the chart, per the dataviz skill's "a table view
// exists" accessibility requirement) and also gives tests a stable, implementation-detail-free
// hook: asserting on it proves the full N-point zero-filled series actually reached the chart
// component, without asserting on rendered SVG.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AnalyticsPage', () => {
  test('renders every section heading on a seeded store', () => {
    const store = makeStore();
    for (let id = 1; id <= 5; id++) store.dispatch(solveQuestion(id));
    renderWithStore(<AnalyticsPage />, store);

    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /solved per day/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pattern completion/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /difficulty breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /revision success rate/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /revision forecast/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /strong & weak patterns/i })).toBeInTheDocument();
  });

  test('stat cards show streak/active-days/productivity numbers computed via the same selectors', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
    renderWithStore(<AnalyticsPage />, store);

    const state = store.getState();
    const streaks = selectStreaks(state, TODAY);
    const productivity = selectProductivityScore(state, TODAY);
    const activeDays = Math.round(consistency(state.progress.dayLogs, TODAY) * 14);

    const currentCard = screen.getByText('Current streak').closest('div')!;
    expect(within(currentCard).getByText(String(streaks.current))).toBeInTheDocument();

    const longestCard = screen.getByText('Longest streak').closest('div')!;
    expect(within(longestCard).getByText(String(streaks.longest))).toBeInTheDocument();

    const activeCard = screen.getByText('Active days (14d)').closest('div')!;
    expect(within(activeCard).getByText(String(activeDays))).toBeInTheDocument();

    const productivityCard = screen.getByText('Productivity score').closest('div')!;
    expect(within(productivityCard).getByText(`${productivity} / 100`)).toBeInTheDocument();
  });

  test('course row shows sessions, cleared weeks, and pass rate; course reviews blend into the success rate', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2)); // cleared — review due tomorrow
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(reviseCourseWeek('w00', true));
    renderWithStore(<AnalyticsPage />, store);

    expect(screen.getByRole('heading', { name: /ai\/ml course/i })).toBeInTheDocument();

    const sessionsCard = screen.getByText('Course sessions').closest('div')!;
    expect(within(sessionsCard).getByText('2 / 52')).toBeInTheDocument();

    const weeksCard = screen.getByText('Weeks cleared').closest('div')!;
    expect(within(weeksCard).getByText('1 / 26')).toBeInTheDocument();

    const passCard = screen.getByText('Review pass rate').closest('div')!;
    expect(within(passCard).getByText('100%')).toBeInTheDocument();

    // The blended success-rate chart counts the course review as a pass.
    expect(screen.getByText('Overall pass rate (1 passed / 0 failed)')).toBeInTheDocument();
  });

  test('a course-only day counts toward Active days (14d), matching the unified streak', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1)); // course-only activity today
    renderWithStore(<AnalyticsPage />, store);

    const activeCard = screen.getByText('Active days (14d)').closest('div')!;
    expect(within(activeCard).getByText('1')).toBeInTheDocument();

    const streakCard = screen.getByText('Current streak').closest('div')!;
    expect(within(streakCard).getByText('1')).toBeInTheDocument();
  });

  test('solved-per-day chart defaults to a full 30-day zero-filled series', () => {
    renderWithStore(<AnalyticsPage />);
    expect(screen.getByText(/Solved and revision counts for 30 days/)).toBeInTheDocument();
  });

  test('switching the range tab to 90 re-renders solved-per-day with a 90-day series', () => {
    renderWithStore(<AnalyticsPage />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /90/i }));

    expect(screen.getByText(/Solved and revision counts for 90 days/)).toBeInTheDocument();
    expect(screen.queryByText(/Solved and revision counts for 30 days/)).not.toBeInTheDocument();
  });

  test('strong/weak patterns card shows "Not enough data yet" on a fresh store', () => {
    renderWithStore(<AnalyticsPage />);

    const heading = screen.getByRole('heading', { name: /strong & weak patterns/i });
    const section = heading.closest('div')!;
    expect(within(section).getByText(/not enough data yet/i)).toBeInTheDocument();
  });

  test('strong/weak patterns split into disjoint Strongest/Weakest lists once 6 patterns are eligible', () => {
    // 6 eligible patterns (>=3 solves each, weakestPatterns' eligibility floor) is the smallest
    // count where the top-3/bottom-3 split (AnalyticsPage: weakest.slice(0,3) vs.
    // weakest.slice(-3).reverse()) is guaranteed disjoint, so each pattern's name is expected in
    // exactly one of the two lists rather than "show what exists" overlap with <6 eligible.
    const store = makeStore();
    for (const pattern of PATTERNS.slice(0, 6)) {
      const ids = questions
        .filter((q) => q.pattern === pattern.id)
        .slice(0, 3)
        .map((q) => q.id);
      for (const id of ids) store.dispatch(solveQuestion(id));
    }
    renderWithStore(<AnalyticsPage />, store);

    const eligible = selectWeakestPatterns(store.getState()); // ascending: weakest first
    expect(eligible.length).toBe(6);
    const expectedWeak = eligible.slice(0, 3);
    const expectedStrong = eligible.slice(-3).reverse();

    const heading = screen.getByRole('heading', { name: /strong & weak patterns/i });
    const section = heading.closest('div')!;
    const strongList = within(section).getByText(/strongest/i).closest('div')!;
    const weakList = within(section).getByText(/weakest/i).closest('div')!;

    for (const w of expectedStrong) {
      expect(within(strongList).getByText(patternById[w.pattern].name)).toBeInTheDocument();
    }
    for (const w of expectedWeak) {
      expect(within(weakList).getByText(patternById[w.pattern].name)).toBeInTheDocument();
    }
  });
});
