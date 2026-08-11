import { screen, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import DashboardPage from '@/pages/DashboardPage';
import { solveQuestion } from '@/store/actions';
import { quoteForDate } from '@/data/quotes';
import { seededRandomQuestion } from '@/utils/engine/recommendations';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardPage', () => {
  test('fresh store: shows "Day 1 of 68", "0 / 539", and today\'s quote; hero renders', () => {
    renderWithStore(<DashboardPage />);

    // The hero heading styles "of 68" in a nested span, so match on the element's full text.
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === 'Day 1 of 68'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 / 539')).toBeInTheDocument();
    expect(screen.getByText(quoteForDate(TODAY))).toBeInTheDocument();
    // hero current-position line for day 1's first (unsolved) question, "Valid Palindrome" (two-pointers/easy)
    expect(screen.getByText(/you're in/i)).toBeInTheDocument();
    expect(screen.getByText('Two Pointers')).toBeInTheDocument();
  });

  test('after solving 8 questions via thunks, shows "Day 2 of 68" and "8 / 539"', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) {
      store.dispatch(solveQuestion(id));
    }
    renderWithStore(<DashboardPage />, store);

    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === 'Day 2 of 68'),
    ).toBeInTheDocument();
    expect(screen.getByText('8 / 539')).toBeInTheDocument();
  });

  test('random-question button dispatches activeQuestionSet with the deterministic engine id', () => {
    const store = makeStore();
    renderWithStore(<DashboardPage />, store);

    const button = screen.getByRole('button', { name: /random question/i });
    fireEvent.click(button);

    const expectedId = seededRandomQuestion(questions, TODAY).id;
    expect(store.getState().ui.activeQuestionId).toBe(expectedId);
  });

  test('roadmap-complete fallback: hero shows completion message once every question is solved', () => {
    // Preloaded directly (rather than 539 solveQuestion dispatches) — only .status is read by
    // the selectors under test here, and this keeps the test fast and deterministic.
    const byId: Record<number, QuestionProgress> = {};
    for (const q of questions) {
      byId[q.id] = { ...initialProgress(), status: 'solved' };
    }
    const store = makeStore({ progress: { byId, dayLogs: {}, startDate: null } });
    renderWithStore(<DashboardPage />, store);

    expect(screen.getByText(/roadmap complete/i)).toBeInTheDocument();
    expect(screen.getByText(`${questions.length} / ${questions.length}`)).toBeInTheDocument();
    // Regression guard: the stale "You're in: <pattern>" current-position line must not linger
    // once every question is solved — it should be fully replaced by the completion message.
    expect(screen.queryByText(/You're in:/)).not.toBeInTheDocument();
  });
});
