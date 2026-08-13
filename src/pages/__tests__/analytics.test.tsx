import type { ReactElement } from 'react';
import { cloneElement } from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import AnalyticsPage from '@/pages/AnalyticsPage';
import { completeCourseSession, reviseCourseWeek, reviseQuestion, solveQuestion } from '@/store/actions';
import { selectStreaks } from '@/store/selectors';
import { MIN_PASS_RATE_ATTEMPTS } from '@/utils/engine/stats';

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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

/** The Ledger renders each figure as a `dt`/`dd` pair inside one wrapper div. */
function figure(label: string): HTMLElement {
  return screen.getByText(label).closest('div')!;
}

/** The ML-track section, whose facts are a Meta line rather than labelled figures. */
function mlTrack(): HTMLElement {
  return screen.getByRole('heading', { name: 'The ML track' }).closest('section')!;
}

describe('AnalyticsPage — the page is five questions, in decision order', () => {
  test('every section is one of the questions a learner actually has', () => {
    const store = makeStore();
    for (let id = 1; id <= 5; id++) store.dispatch(solveQuestion(id));
    renderWithStore(<AnalyticsPage />, store);

    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    for (const question of [
      'Am I showing up?',
      'Am I getting faster?',
      'Am I getting more accurate?',
      'Can I solve unfamiliar problems?',
      'What should I do next?',
    ]) {
      expect(screen.getByRole('heading', { name: question })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'The ML track' })).toBeInTheDocument();
  });

  test('the questions appear in decision order — "what next" is not the first thing read', () => {
    renderWithStore(<AnalyticsPage />);

    const order = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '');

    expect(order.indexOf('Am I showing up?')).toBeLessThan(order.indexOf('What should I do next?'));
    expect(order.indexOf('Can I solve unfamiliar problems?')).toBeLessThan(
      order.indexOf('What should I do next?'),
    );
  });
});

describe('AnalyticsPage — figures come from the same selectors as the rest of the app', () => {
  test('streak and active-days match the store, both tracks counted', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
    renderWithStore(<AnalyticsPage />, store);

    const streaks = selectStreaks(store.getState(), TODAY);

    expect(within(figure('Current streak')).getByText(String(streaks.current))).toBeInTheDocument();
    expect(within(figure('Current streak')).getByText(`longest ${streaks.longest}`)).toBeInTheDocument();
    expect(within(figure('Active days')).getByText('1 / 14')).toBeInTheDocument();
  });

  test('a course-only day is an active day and sustains the streak', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1)); // no DSA work at all today
    renderWithStore(<AnalyticsPage />, store);

    expect(within(figure('Active days')).getByText('1 / 14')).toBeInTheDocument();
    expect(within(figure('Current streak')).getByText('1')).toBeInTheDocument();
  });

  // The ML track is one Meta line rather than four serif figures: it is a secondary reading on a
  // page about the roadmap, and a 4-column ledger gave it the same weight as the questions above.
  // The facts asserted are unchanged — only the form they are read in.
  test('the ML track reports attendance and retention as separate things', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2)); // cleared — review due tomorrow
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(reviseCourseWeek('w00', true));
    renderWithStore(<AnalyticsPage />, store);

    const track = mlTrack();
    expect(track).toHaveTextContent('2 / 52 sessions attended');
    expect(track).toHaveTextContent('1 / 26 weeks cleared');
    expect(track).toHaveTextContent('100% of 1 graded review passed');
    // With every cleared week graded, the attendance figure is backed rather than standing alone.
    expect(screen.getByText(/backed by recall rather than standing on its own/)).toBeInTheDocument();
  });

  test('an unreviewed course reports no pass rate rather than a flattering one', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));
    renderWithStore(<AnalyticsPage />, store);

    expect(mlTrack()).toHaveTextContent('No week reviewed yet');
    // Attendance is not retention, and the page refuses to let one stand for the other.
    expect(screen.getByText(/Sessions completed is attendance/)).toBeInTheDocument();
  });
});

describe('AnalyticsPage — suppression over padding', () => {
  test('a fresh store answers "not yet, and here is what it would take" rather than showing zeros', () => {
    renderWithStore(<AnalyticsPage />);

    // Recognition names its own floor instead of reporting 0%.
    expect(within(figure('Recognition')).getByText(/needs \d+ recorded drill days/)).toBeInTheDocument();
    // Focus time distinguishes "not measured" from "zero".
    expect(within(figure('Focus time')).getByText(/not measured/)).toBeInTheDocument();
  });

  test('one graded recall is not a pass rate — the headline figure names its own shortfall', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(reviseQuestion(1, false));
    renderWithStore(<AnalyticsPage />, store);

    // A single failed recall used to print a confident "0%" as the largest figure in the
    // accuracy section, directly above a difficulty row correctly reporting "needs 5 reviews —
    // you have 1". One page, two answers to "has this been measured yet".
    const tile = figure('Recall pass rate');
    expect(within(tile).queryByText('0%')).toBeNull();
    expect(
      within(tile).getByText(`needs ${MIN_PASS_RATE_ATTEMPTS} reviews — you have 1`),
    ).toBeInTheDocument();
  });

  test('no pattern is called weak on a single observation', () => {
    renderWithStore(<AnalyticsPage />);

    const section = screen.getByRole('heading', { name: 'What should I do next?' }).closest('section')!;
    expect(within(section).getByText(/Nothing has failed on repeated evidence yet/)).toBeInTheDocument();
    expect(within(section).getByText(/one miss is a bad evening, not a weakness/)).toBeInTheDocument();
    expect(within(section).queryByRole('list', { name: 'Patterns to work on' })).not.toBeInTheDocument();
  });

  test('a weakness is never a bare number — every entry states why', () => {
    const store = makeStore();
    // Two failed recalls on one question is repeated evidence on its pattern.
    store.dispatch(solveQuestion(1));
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(reviseQuestion(1, false));
    vi.setSystemTime(new Date('2026-08-01T12:00:00'));
    store.dispatch(reviseQuestion(1, false));
    renderWithStore(<AnalyticsPage />, store);

    const list = screen.queryByRole('list', { name: 'Patterns to work on' });
    if (list) {
      // Whatever the model surfaces, it must explain itself in words, not in a score.
      for (const item of within(list).getAllByRole('listitem')) {
        expect(item.textContent ?? '').toMatch(/Because /);
        expect(item.textContent ?? '').not.toMatch(/score|0\.\d{2}|\brating\b/i);
      }
    }
  });
});

describe('AnalyticsPage — the charts that survived', () => {
  test('solved-per-day defaults to a full 30-day zero-filled series', () => {
    renderWithStore(<AnalyticsPage />);
    expect(screen.getByText(/Solved and revision counts for 30 days/)).toBeInTheDocument();
  });

  test('switching the range tab to 90 re-renders with a 90-day series', () => {
    renderWithStore(<AnalyticsPage />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /90/i }));

    expect(screen.getByText(/Solved and revision counts for 90 days/)).toBeInTheDocument();
    expect(screen.queryByText(/Solved and revision counts for 30 days/)).not.toBeInTheDocument();
  });

  test('the review-load forecast is framed as planning, not as debt', () => {
    renderWithStore(<AnalyticsPage />);

    const section = screen.getByRole('heading', { name: 'Review load ahead' }).closest('section')!;
    expect(within(section).getByText(/Reviewing early costs nothing on the ladder/)).toBeInTheDocument();
  });
});
