import { act } from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import ContestPage from '@/pages/ContestPage';
import { patternById } from '@/data/patterns';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderContest(store: AppStore = makeStore()) {
  return renderWithStore(<ContestPage />, store);
}

function problemRows() {
  return within(screen.getByRole('list', { name: 'Contest problems' })).getAllByRole('listitem');
}

function startViaUi() {
  fireEvent.click(screen.getByRole('button', { name: /start the contest/i }));
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  fireEvent(document, new Event('visibilitychange'));
}

describe('ContestPage: start screen', () => {
  test('explains the set and its honesty rules before anything starts', () => {
    renderContest();

    expect(screen.getByRole('heading', { name: 'Contest' })).toBeInTheDocument();
    expect(screen.getByText('Four problems, one clock.')).toBeInTheDocument();
    // The no-score promise is product truth, not decoration — pin it.
    expect(screen.getByText(/no score and no rank/i)).toBeInTheDocument();
    expect(screen.getByText(/seeded by today's date/i)).toBeInTheDocument();
  });

  test('the seeding claim matches what the seed actually guarantees', () => {
    const { store } = renderContest();

    // The old line said "reloading rebuilds the same set". Two mechanisms contradict it: the pool
    // excludes solved problems, and the contest slice is not persisted at all.
    expect(screen.queryByText(/reloading rebuilds the same set/i)).not.toBeInTheDocument();
    expect(screen.getByText(/until you solve one of them/i)).toBeInTheDocument();
    expect(screen.getByText(/Reloading mid-contest ends the sitting/i)).toBeInTheDocument();

    // And the caveat is real: solving a problem takes it out of the next draw, same day or not.
    startViaUi();
    const firstSet = store.getState().contest.questionIds;
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /mark solved/i }));
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    startViaUi();
    expect(store.getState().contest.questionIds).not.toContain(firstSet[0]);
  });

  test('starting builds the four-problem set, seeded by the calendar date', () => {
    const { store } = renderContest();

    startViaUi();

    expect(store.getState().contest.seed).toBe('2026-07-30');
    const rows = problemRows();
    expect(rows).toHaveLength(4);
    // The ladder: an easy opener, a hard closer (buildContest's CONTEST_SHAPE).
    const setQuestions = store
      .getState()
      .contest.questionIds.map((id) => questionById.get(id)!);
    expect(setQuestions[0]!.difficulty).toBe('easy');
    expect(setQuestions[3]!.difficulty).toBe('hard');
  });
});

describe('ContestPage: the sitting', () => {
  test('time only counts while a problem is on the clock', () => {
    const { store } = renderContest();
    startViaUi();
    const firstId = store.getState().contest.questionIds[0]!;

    // Put problem 1 on the clock, let 10 minutes pass, pause it.
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(within(problemRows()[0]!).getByText(/on the clock · 10 min/i)).toBeInTheDocument();
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /pause/i }));

    expect(store.getState().contest.attempts[firstId]!.minutesSpent).toBe(10);
    // A further 5 minutes with nothing on the clock is attributed to nobody.
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(store.getState().contest.attempts[firstId]!.minutesSpent).toBe(10);
  });

  test('a submission that did not pass is recorded on the problem being worked', () => {
    const { store } = renderContest();
    startViaUi();
    const firstId = store.getState().contest.questionIds[0]!;

    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /put on the clock/i }));
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /didn't pass/i }));
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /didn't pass/i }));

    expect(store.getState().contest.attempts[firstId]!.wrongSubmits).toBe(2);
    expect(within(problemRows()[0]!).getByText(/2 didn't pass/i)).toBeInTheDocument();
  });

  test('setting a problem aside stops its clock and says so, and it can be picked back up', () => {
    const { store } = renderContest();
    startViaUi();
    const secondId = store.getState().contest.questionIds[1]!;

    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(12 * 60_000);
    });
    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /set aside/i }));

    // The minutes already spent stand — the decision is about what happens next, not about them.
    expect(store.getState().contest.attempts[secondId]!.minutesSpent).toBe(12);
    expect(store.getState().contest.activeQuestionId).toBeNull();
    expect(within(problemRows()[1]!).getByText(/set aside · 12 min/i)).toBeInTheDocument();

    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /pick it back up/i }));
    expect(store.getState().contest.attempts[secondId]!.setAside).toBe(false);
  });

  test('marking a problem solved goes through the real solve path — XP, progress, the ledger', () => {
    const { store } = renderContest();
    startViaUi();
    const firstId = store.getState().contest.questionIds[0]!;

    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /mark solved/i }));

    expect(store.getState().contest.attempts[firstId]!.solved).toBe(true);
    expect(store.getState().progress.byId[firstId]!.status).toBe('solved');
    expect(store.getState().gamification.xp).toBeGreaterThan(0);
    expect(within(problemRows()[0]!).getByText(/solved/i)).toBeInTheDocument();
  });
});

describe('ContestPage: the verdict', () => {
  test('a solved problem and a genuine stall produce readings and one next step', () => {
    const { store } = renderContest();
    startViaUi();
    const secondId = store.getState().contest.questionIds[1]!;
    const stalledPattern = questionById.get(secondId)!.pattern;

    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /mark solved/i }));
    // 30 minutes of real time into problem 2 without a solution: a stall, not "untouched".
    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(30 * 60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(screen.getByText('1 of 4 solved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How each problem read' })).toBeInTheDocument();
    expect(screen.getByText('Clean solve')).toBeInTheDocument();
    expect(screen.getByText('Stalled')).toBeInTheDocument();
    expect(screen.getAllByText('Barely touched')).toHaveLength(2);

    // The stall is the one finding worth acting on, and it links into the pattern page.
    expect(
      screen.getByText(`Worth acting on: ${patternById[stalledPattern]!.name}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the pattern/i })).toHaveAttribute(
      'href',
      `/patterns/${stalledPattern}`,
    );
  });

  test('the verdict says where the minutes went, and offers the stalled problem a second look', () => {
    const { store } = renderContest();
    startViaUi();
    const secondId = store.getState().contest.questionIds[1]!;

    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(15 * 60_000);
    });
    fireEvent.click(within(problemRows()[0]!).getByRole('button', { name: /mark solved/i }));
    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(45 * 60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    // Time allocation is the one thing a contest can see that self-paced practice cannot.
    expect(screen.getByText(/45 of your 60 minutes went to/i)).toBeInTheDocument();

    // The clock is off, so the problem that beat it can now be opened with everything the sheet
    // carries — which the contest withheld on purpose while it was running.
    fireEvent.click(screen.getByRole('button', { name: /take a calm second look/i }));
    expect(store.getState().ui.activeQuestionId).toBe(secondId);
  });

  test('an abandoned contest is declared inconclusive, never mined for weakness', () => {
    renderContest();
    startViaUi();

    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(screen.getByText(/too little of this set was genuinely attempted/i)).toBeInTheDocument();
    expect(screen.queryByText(/worth acting on/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Barely touched')).toHaveLength(4);
  });

  test('an armed problem keeps counting while the tab is hidden — that is where the work happens', () => {
    // The clock used to stop on `visibilitychange → hidden`, which sounds protective and was in
    // fact fatal: the only sanctioned work surface is the external LeetCode link, so *attempting*
    // a problem always hid the tab. Every unsolved problem settled at ~0 min, classified
    // `untouched`, every sitting came out `inconclusive`, and `patternGaps` could never be
    // non-empty. The contract is now the explicit control: arming is a commitment, Pause is the
    // learner's own honest exit.
    const { store } = renderContest();
    startViaUi();
    const secondId = store.getState().contest.questionIds[1]!;

    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /put on the clock/i }));
    setVisibility('hidden'); // switching to the LeetCode tab to actually solve it
    act(() => {
      vi.advanceTimersByTime(20 * 60_000);
    });
    setVisibility('visible');
    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /pause/i }));

    expect(store.getState().contest.attempts[secondId]!.minutesSpent).toBe(20);
  });

  test('the page says the clock runs until you pause it', () => {
    renderContest();
    startViaUi();

    expect(screen.getByText(/runs until you pause it/i)).toBeInTheDocument();
    // The old promise — that time stopped whenever this page was not on screen — is now false.
    expect(screen.queryByText(/only while this page is open/i)).not.toBeInTheDocument();
  });

  test('leaving the page settles the clock rather than leaving it running', () => {
    // Unmount is still a settle: a contest page that is gone cannot be paused, and time credited
    // to a problem nobody has open would be the invented claim contest.ts's header refuses.
    const { store, unmount } = renderContest();
    startViaUi();
    const secondId = store.getState().contest.questionIds[1]!;

    fireEvent.click(within(problemRows()[1]!).getByRole('button', { name: /put on the clock/i }));
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    unmount(); // navigating away from /contest
    act(() => {
      vi.advanceTimersByTime(40 * 60_000);
    });

    // The five minutes actually spent are kept; the forty spent elsewhere are not.
    expect(store.getState().contest.attempts[secondId]!.minutesSpent).toBe(5);
    expect(store.getState().contest.activeQuestionId).toBeNull();
  });

  test('Done clears the sitting and returns to the start screen', () => {
    const { store } = renderContest();
    startViaUi();
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(store.getState().contest.seed).toBeNull();
    expect(screen.getByText('Four problems, one clock.')).toBeInTheDocument();
  });
});
