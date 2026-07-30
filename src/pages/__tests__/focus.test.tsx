import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import FocusPage from '@/pages/FocusPage';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — mirrors src/pages/__tests__/today.test.tsx.
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

describe('FocusPage: new-question source (today\'s slice has an unsolved item)', () => {
  test('fresh store: shows the first unsolved question with Solved / Need Revision / Skip buttons', () => {
    renderWithStore(<FocusPage />);

    // Day 1's first question is id 1, "Valid Palindrome" (see dashboard/today test fixtures).
    expect(screen.getByRole('heading', { name: 'Valid Palindrome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Need Revision' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fail' })).not.toBeInTheDocument();
  });

  test('clicking Solved dispatches solveQuestion, marking the question solved', () => {
    const { store } = renderWithStore(<FocusPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Solved' }));

    expect(store.getState().progress.byId[1].status).toBe('solved');
  });
});

describe('FocusPage: revision-queue source (today\'s slice is fully solved, a revision is due)', () => {
  function revisionOnlyStore(): AppStore {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));

    // Every question marked solved (so today's day-68 slice — the last, partial day — has
    // nothing left unsolved) with a comfortably future nextRevision, except question 1, whose
    // nextRevision is set to today so it's the sole due revision. Preloaded directly rather than
    // via hundreds of solveQuestion dispatches, mirroring dashboard.test.tsx's
    // "roadmap-complete fallback" fixture — only .status/.revisionStage/.nextRevision are read by
    // the selectors under test here.
    const byId: Record<number, QuestionProgress> = {};
    for (const q of questions) {
      byId[q.id] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: '2026-08-15' };
    }
    byId[1] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: TODAY };

    return makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-01-01' } });
  }

  test('shows the due question with Pass / Fail buttons instead of Solved / Need Revision / Skip', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    expect(screen.getByRole('heading', { name: questions.find((q) => q.id === 1)!.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solved' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Need Revision' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  test('clicking Pass dispatches reviseQuestion(id, true), advancing the revision stage', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(store.getState().progress.byId[1].revisionStage).toBe(2); // 1 -> 2, not reset to 0
  });

  test('clicking Fail dispatches reviseQuestion(id, false), resetting the revision stage', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    expect(store.getState().progress.byId[1].revisionStage).toBe(0);
    expect(store.getState().progress.byId[1].nextRevision).toBe('2026-07-31'); // today + 1
  });
});
