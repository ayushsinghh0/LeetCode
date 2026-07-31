import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import CalendarPage from '@/pages/CalendarPage';
import { completeCourseSession, solveQuestion } from '@/store/actions';
import { SOLVE_XP } from '@/utils/engine/xp';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome" — easy
const question2 = questions.find((q) => q.id === 2)!; // "3Sum" — medium
const SOLVE_TOTAL_XP = SOLVE_XP[question1.difficulty] + SOLVE_XP[question2.difficulty]; // 10 + 20 = 30

const TODAY = '2026-07-30'; // Thursday, July 2026 — month starts on a Wednesday (3 leading pad cells)

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — mirrors src/pages/__tests__/today.test.tsx.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalendarPage', () => {
  test('renders the current month title, weekday header, and one button per day of the month', () => {
    renderWithStore(<CalendarPage />);

    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();

    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const dayButtons = screen.getAllByRole('button', { name: /2026 — \d+ activities$/ });
    expect(dayButtons).toHaveLength(31); // July has 31 days
  });

  test('a course-only day lights its cell and the dialog lists the session under Course', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1)); // stamped 2026-07-30, 20 XP

    renderWithStore(<CalendarPage />, store);

    const cell = screen.getByRole('button', { name: 'July 30, 2026 — 1 activities' });
    expect(cell.dataset.level).not.toBe('0');

    fireEvent.click(cell);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('0 solved · 0 revisions · 1 course · 20 XP · 0 focus min')).toBeInTheDocument();
    expect(within(dialog).getByText('Course')).toBeInTheDocument();
    expect(within(dialog).getByText('· Lecture')).toBeInTheDocument();
  });

  test('a fixture day (2 solves on 2026-07-30) shows an activity level and its dialog lists both titles, correct XP, and zero revisions', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));

    renderWithStore(<CalendarPage />, store);

    const cell = screen.getByRole('button', { name: 'July 30, 2026 — 2 activities' });
    expect(cell).not.toBeDisabled();
    expect(cell.dataset.level).not.toBe('0');

    fireEvent.click(cell);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Thursday, July 30, 2026')).toBeInTheDocument();
    expect(within(dialog).getByText(`2 solved · 0 revisions · 0 course · ${SOLVE_TOTAL_XP} XP · 0 focus min`)).toBeInTheDocument();
    expect(within(dialog).getByText(question1.title)).toBeInTheDocument();
    expect(within(dialog).getByText(question2.title)).toBeInTheDocument();
    expect(within(dialog).getByText(`${SOLVE_TOTAL_XP} XP`)).toBeInTheDocument();
  });

  test('clicking a past day with no logged activity shows the empty state inside the dialog', () => {
    renderWithStore(<CalendarPage />);

    const cell = screen.getByRole('button', { name: 'July 15, 2026 — 0 activities' });
    fireEvent.click(cell);

    // The phrase appears both as the DialogDescription (a11y summary) and the EmptyState title.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('No activity on this day').length).toBeGreaterThanOrEqual(2);
  });

  test('the previous-month chevron navigates back to "June 2026"', () => {
    renderWithStore(<CalendarPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument();
  });

  test('a future date button is disabled', () => {
    renderWithStore(<CalendarPage />);

    const futureCell = screen.getByRole('button', { name: 'July 31, 2026 — 0 activities' });
    expect(futureCell).toBeDisabled();
  });
});
