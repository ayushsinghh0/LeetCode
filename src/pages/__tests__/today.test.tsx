import type { ReactNode } from 'react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import TodayPage from '@/pages/TodayPage';
import { useCelebration, __setConfettiForTests } from '@/hooks/useCelebration';
import { solveQuestion } from '@/store/actions';
import { celebrationShown } from '@/store/slices/uiSlice';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome"
const day1Titles = questions.slice(0, 8).map((q) => q.title);

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — mirrors src/components/layout/__tests__/shell.test.tsx.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

// Safety net mirroring the existing suites: fake timers must never leak between tests.
afterEach(() => {
  vi.useRealTimers();
});

function renderWithStore(ui: ReactNode, store: AppStore = makeStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter future={routerFutureFlags}>{ui}</MemoryRouter>
        </TooltipProvider>
      </Provider>,
    ),
  };
}

describe('TodayPage', () => {
  test('fresh store: shows all 8 of today\'s questions and "0 / 8 solved today"', () => {
    renderWithStore(<TodayPage />);

    for (const title of day1Titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText('0 / 8 solved today')).toBeInTheDocument();
  });

  test('weekly revision banner is absent on day 1', () => {
    renderWithStore(<TodayPage />);

    expect(screen.queryByText(/Weekly Revision Day/)).not.toBeInTheDocument();
  });

  test('solving question 1 updates the progress text and store state', () => {
    const store = makeStore();
    renderWithStore(<TodayPage />, store);

    const startButtonsBefore = screen.getAllByRole('button', { name: 'Start' });
    expect(startButtonsBefore).toHaveLength(8);

    act(() => {
      store.dispatch(solveQuestion(1));
    });

    expect(screen.getByText('1 / 8 solved today')).toBeInTheDocument();
    expect(store.getState().progress.byId[1].status).toBe('solved');
    // Solved questions no longer show a "Start" button — one fewer than before.
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(7);
  });

  test('daily goal crushed message appears once solvedToday reaches perDay', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) {
      store.dispatch(solveQuestion(id));
    }
    renderWithStore(<TodayPage />, store);

    expect(screen.getByText('8 / 8 solved today')).toBeInTheDocument();
    expect(screen.getByText(/Daily goal crushed/)).toBeInTheDocument();
  });

  test('revision due section lists a due card, then shows an overdue badge once past its due date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1)); // nextRevision = 2026-07-31

    renderWithStore(<TodayPage />, store);

    // Advance to the due date itself (useToday's setInterval polls every 60s).
    act(() => {
      vi.setSystemTime(new Date('2026-07-31T12:00:00'));
      vi.advanceTimersByTime(60_000);
    });

    let revisionSection = screen.getByRole('heading', { name: 'Revision Due' }).closest('section')!;
    expect(within(revisionSection).getByText(question1.title)).toBeInTheDocument();
    expect(within(revisionSection).queryByText(/overdue/)).not.toBeInTheDocument();

    // Advance one more day: now 1 day overdue (singular — shares RevisionPage's overdueLabel()
    // helper via src/utils/overdueLabel.ts, so this used to incorrectly read "1 days overdue").
    act(() => {
      vi.setSystemTime(new Date('2026-08-01T12:00:00'));
      vi.advanceTimersByTime(60_000);
    });

    revisionSection = screen.getByRole('heading', { name: 'Revision Due' }).closest('section')!;
    expect(within(revisionSection).getByText('1 day overdue')).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('empty state renders when there are no due revisions', () => {
    renderWithStore(<TodayPage />);

    expect(screen.getByText('No revisions due — enjoy the clean slate')).toBeInTheDocument();
  });

  test('AI/ML course card shows the next session and marks it done in place', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const { store } = renderWithStore(<TodayPage />);

    expect(screen.getByText('Week 0 — Orientation')).toBeInTheDocument();
    expect(screen.getByText('Day 1 · Lecture')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open plan' })).toHaveAttribute('href', '/aiml');

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));

    expect(store.getState().course.byWeekId.w00.day1DoneOn).toBe('2026-07-30');
    expect(store.getState().gamification.xp).toBe(20);
    expect(screen.getByText('Day 2 · Practice')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe('useCelebration', () => {
  function CelebrationHarness() {
    useCelebration();
    return null;
  }

  test('fires a single confetti burst on a "confetti" celebration and clears ui.celebration', () => {
    const confettiMock = vi.fn();
    __setConfettiForTests(confettiMock);

    const store = makeStore();
    renderWithStore(<CelebrationHarness />, store);

    act(() => {
      store.dispatch(celebrationShown('confetti'));
    });

    expect(confettiMock).toHaveBeenCalledTimes(1);
    expect(store.getState().ui.celebration).toBeNull();
  });

  test('fires 3 staggered bursts on a "fireworks" celebration', () => {
    vi.useFakeTimers();
    const confettiMock = vi.fn();
    __setConfettiForTests(confettiMock);

    const store = makeStore();
    renderWithStore(<CelebrationHarness />, store);

    act(() => {
      store.dispatch(celebrationShown('fireworks'));
    });
    expect(store.getState().ui.celebration).toBeNull();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(confettiMock).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  test('cancels pending fireworks timers on unmount so no bursts fire afterward', () => {
    vi.useFakeTimers();
    const confettiMock = vi.fn();
    __setConfettiForTests(confettiMock);

    const store = makeStore();
    const { unmount } = renderWithStore(<CelebrationHarness />, store);

    act(() => {
      store.dispatch(celebrationShown('fireworks'));
    });
    // None of the setTimeout-scheduled bursts (delays 0/300/600) have run yet — fake timers
    // only fire on an explicit advance.
    expect(confettiMock).not.toHaveBeenCalled();

    unmount();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    // All 3 pending timers were cancelled on unmount, so none fire even after their delays elapse.
    expect(confettiMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('a second "fireworks" celebration within 600ms replaces pending bursts instead of doubling them', () => {
    vi.useFakeTimers();
    const confettiMock = vi.fn();
    __setConfettiForTests(confettiMock);

    const store = makeStore();
    renderWithStore(<CelebrationHarness />, store);

    act(() => {
      store.dispatch(celebrationShown('fireworks'));
    });
    act(() => {
      vi.advanceTimersByTime(100); // only the t=0 burst of the first round has fired
    });
    expect(confettiMock).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(celebrationShown('fireworks')); // cancels the first round's remaining 2 bursts
    });
    act(() => {
      vi.advanceTimersByTime(600); // lets the second round's 3 bursts run to completion
    });

    // 1 (first round's t=0 burst) + 3 (second round, in full) = 4 — not 1 + 3 + the first
    // round's stale 300/600ms bursts (which would make 6 if they'd doubled up).
    expect(confettiMock).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
