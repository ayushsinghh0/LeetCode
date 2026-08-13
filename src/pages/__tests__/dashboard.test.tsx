import { screen, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import DashboardPage from '@/pages/DashboardPage';
import { solveQuestion } from '@/store/actions';
import { quoteForDate } from '@/data/quotes';
import { seededRandomQuestion } from '@/utils/engine/recommendations';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import questionsData from '@/data/questions.json';
import type { DayLog, Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

const dayLog = (date: string, solvedIds: number[]): DayLog => ({
  date, solvedIds, revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
});

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
    // With nothing remaining there is no finish to estimate: the cell leaves the ledger rather
    // than presenting today's date as a projection.
    expect(screen.queryByText('Est. finish')).not.toBeInTheDocument();
  });

  test('estimate says "target pace" — not "current pace" — before there is any history', () => {
    renderWithStore(<DashboardPage />);

    expect(screen.getByText('Est. finish')).toBeInTheDocument();
    // The figure is the questions-per-day setting. Calling that "your current pace" is a claim
    // about a learner who has not solved anything yet.
    expect(screen.getByText('at your target pace')).toBeInTheDocument();
    expect(screen.queryByText('at your current pace')).not.toBeInTheDocument();
  });

  test('day 4 after three perfect days estimates from the days lived, not a flat 14', () => {
    // 24 solves across the three days since starting = 8/day. The old flat-14 divisor called it
    // 1.71/day and rendered "May 27" — a 2027 date stripped of its year, under "Day 4 of 68".
    const byId: Record<number, QuestionProgress> = {};
    for (let id = 1; id <= 24; id++) {
      byId[id] = { ...initialProgress(), status: 'solved', completedAt: '2026-07-30' };
    }
    const store = makeStore({
      progress: {
        byId,
        dayLogs: {
          '2026-07-28': dayLog('2026-07-28', [1, 2, 3, 4, 5, 6, 7, 8]),
          '2026-07-29': dayLog('2026-07-29', [9, 10, 11, 12, 13, 14, 15, 16]),
          '2026-07-30': dayLog('2026-07-30', [17, 18, 19, 20, 21, 22, 23, 24]),
        },
        startDate: '2026-07-28',
      },
    });
    renderWithStore(<DashboardPage />, store);

    // 515 remaining at 8/day = 65 days out, inside the same year, so no year is shown.
    expect(screen.getByText('Oct 3')).toBeInTheDocument();
    expect(screen.getByText('at your current pace')).toBeInTheDocument();
  });

  test('weekly revision day: the ledger says "queued", because top-ups are not due', () => {
    // 48 solves puts the roadmap on day 7. Every review is scheduled well ahead, so nothing is
    // due — the 15 in the ledger is entirely work the weekly top-up pulled forward.
    const byId: Record<number, QuestionProgress> = {};
    for (let id = 1; id <= 48; id++) {
      byId[id] = {
        ...initialProgress(),
        status: 'solved',
        revisionStage: 1,
        nextRevision: '2026-08-20',
        completedAt: '2026-07-29',
      };
    }
    const store = makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-07-01' } });
    renderWithStore(<DashboardPage />, store);

    expect(screen.getByText('Revisions queued')).toBeInTheDocument();
    expect(screen.getByText('15 questions · 0 course')).toBeInTheDocument();
    expect(screen.queryByText('Revisions due')).not.toBeInTheDocument();
  });
});
