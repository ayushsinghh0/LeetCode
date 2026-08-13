import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import CalendarPage from '@/pages/CalendarPage';
import { completeCourseSession, logFocusSession, solveQuestion } from '@/store/actions';
import { courseRevisionLogged } from '@/store/slices/courseSlice';
import { SOLVE_XP } from '@/utils/engine/xp';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome" — easy
const question2 = questions.find((q) => q.id === 2)!; // "3Sum" — medium
const SOLVE_TOTAL_XP = SOLVE_XP[question1.difficulty] + SOLVE_XP[question2.difficulty]; // 10 + 20 = 30

const TODAY = '2026-07-30'; // Thursday, July 2026 — month starts on a Wednesday (3 leading pad cells)

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

  test('the month caption totals the visible month, every figure in the tabular voice', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));

    renderWithStore(<CalendarPage />, store);

    const month = screen.getByRole('region', { name: 'Month activity' });

    const solves = within(month).getByText('solves');
    expect(solves).toHaveTextContent('2 solves');
    // DESIGN.md § Typography: "anything counted, timed, or dated" wears `.figures`. The old
    // full-width totals plate rendered these as plain bold text.
    expect(solves.querySelector('.figures')).toHaveTextContent('2');

    expect(within(month).getByText('active day')).toHaveTextContent('1 active day');
    expect(within(month).getByText('revisions')).toHaveTextContent('0 revisions');
    expect(within(month).getByText('course sessions')).toHaveTextContent('0 course sessions');
    expect(within(month).getByText('course reviews')).toHaveTextContent('0 course reviews');
    expect(within(month).getByText('focus min')).toHaveTextContent('0 focus min');
    expect(within(month).getByText('XP')).toHaveTextContent(`${SOLVE_TOTAL_XP} XP`);
  });

  test('graded course reviews are counted as reviews, not as course sessions', () => {
    const store = makeStore();
    // Two graded week reviews and not one new session — the case that used to caption
    // "2 course sessions" while the day dialog labelled both of them "Review".
    store.dispatch(courseRevisionLogged({ weekId: 'w00', date: TODAY, passed: true }));
    store.dispatch(courseRevisionLogged({ weekId: 'w01', date: TODAY, passed: false }));

    renderWithStore(<CalendarPage />, store);

    const month = screen.getByRole('region', { name: 'Month activity' });
    expect(within(month).getByText('course sessions')).toHaveTextContent('0 course sessions');
    expect(within(month).getByText('course reviews')).toHaveTextContent('2 course reviews');

    // The caption and the dialog are reading the same two events, so they must call them the
    // same thing.
    fireEvent.click(screen.getByRole('button', { name: 'July 30, 2026 — 2 activities' }));
    expect(within(screen.getByRole('dialog')).getAllByText('· Review')).toHaveLength(2);
  });

  test('a session and a review on the same day are counted apart', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(courseRevisionLogged({ weekId: 'w01', date: TODAY, passed: true }));

    renderWithStore(<CalendarPage />, store);

    const month = screen.getByRole('region', { name: 'Month activity' });
    expect(within(month).getByText('course session')).toHaveTextContent('1 course session');
    expect(within(month).getByText('course review')).toHaveTextContent('1 course review');
  });

  test('a focus-only day is active everywhere on the page — cell, label, caption and dialog', () => {
    const store = makeStore();
    store.dispatch(logFocusSession(50)); // two pomodoros on 2026-07-30, nothing solved

    renderWithStore(<CalendarPage />, store);

    // focusMinutesAdded creates a DayLog, so the dialog always had something to show. The cell
    // rendered level 0 and the caption said "0 active days" — one page, two answers.
    const cell = screen.getByRole('button', { name: 'July 30, 2026 — 0 activities, 50 focus min' });
    expect(cell.dataset.level).toBe('1');

    const month = screen.getByRole('region', { name: 'Month activity' });
    expect(within(month).getByText('active day')).toHaveTextContent('1 active day');
    expect(within(month).getByText('focus min')).toHaveTextContent('50 focus min');

    fireEvent.click(cell);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('0 solved · 0 revisions · 0 course · 0 XP · 50 focus min')).toBeInTheDocument();
    expect(within(dialog).queryByText('No activity on this day')).not.toBeInTheDocument();
  });

  test('the page spends no plate on itself — the grid sits on the page ground', () => {
    const { container } = renderWithStore(<CalendarPage />);

    // DESIGN.md § The plate rule: a plate must earn itself. A month nav, a calendar grid and a
    // totals line are one object, and none of them is liftable — this page used to box all three.
    expect(container.querySelectorAll('.glass')).toHaveLength(0);
  });
});
