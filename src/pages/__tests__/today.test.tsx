import { act } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import TodayPage from '@/pages/TodayPage';
import { useCelebration, __setConfettiForTests } from '@/hooks/useCelebration';
import { completeCourseSession, logDrillResult, solveQuestion } from '@/store/actions';
import { celebrationShown } from '@/store/slices/uiSlice';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome"

// Safety net mirroring the existing suites: fake timers must never leak between tests.
afterEach(() => {
  vi.useRealTimers();
});

const nextAction = () => screen.getByRole('region', { name: 'Your next action' });
const sessionPlan = () => screen.getByRole('region', { name: 'Session plan' });

describe('TodayPage — the next action', () => {
  test('a fresh learner is pointed at one specific question, with the reason being what it teaches', () => {
    renderWithStore(<TodayPage />);

    const hero = nextAction();
    expect(within(hero).getByRole('heading', { name: question1.title })).toBeInTheDocument();
    // The "why" for a new question is its authored capability sentence — not "it's next".
    expect(within(hero).getByText(question1.tests)).toBeInTheDocument();
    expect(within(hero).getByText(`~${question1.estimatedTime}m`)).toBeInTheDocument();
    expect(within(hero).getByText(/Next · New problem/)).toBeInTheDocument();
  });

  test('no recognition drill is suggested before there is anything to recognize', () => {
    const store = makeStore();
    renderWithStore(<TodayPage />, store);

    expect(within(nextAction()).queryByText(/Recognition drill/)).not.toBeInTheDocument();

    // Past the eligibility floor, the drill becomes the top recommendation: it measures, and
    // measurement outranks more volume.
    act(() => {
      for (let id = 1; id <= 6; id++) store.dispatch(solveQuestion(id));
    });

    expect(within(nextAction()).getByRole('heading', { name: 'Recognition drill' })).toBeInTheDocument();
  });

  test('a due revision outranks new material, and the reason names the ladder step', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1)); // first review lands 2026-07-31

    renderWithStore(<TodayPage />, store);

    act(() => {
      vi.setSystemTime(new Date('2026-08-02T12:00:00')); // 2 days past the 1-day step
      vi.advanceTimersByTime(60_000);
    });

    const hero = nextAction();
    expect(within(hero).getByRole('heading', { name: question1.title })).toBeInTheDocument();
    expect(within(hero).getByText(/Waiting 2 days past its 1-day step/)).toBeInTheDocument();
    expect(within(hero).getByText(/Next · Recall/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('"Not this one" steps down the ranked list instead of re-rolling', () => {
    renderWithStore(<TodayPage />);

    const first = questions[0]!.title;
    const second = questions[1]!.title;
    expect(within(nextAction()).getByRole('heading', { name: first })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Not this one/ }));

    expect(within(nextAction()).getByRole('heading', { name: second })).toBeInTheDocument();
  });

  test('clearing the whole day replaces the recommendation with a finished state', () => {
    const store = makeStore();
    // Solve the day's allowance, take the drill, and clear the whole course week.
    for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
    store.dispatch(logDrillResult(8, 8, []));
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));

    renderWithStore(<TodayPage />, store);

    expect(screen.getByRole('region', { name: 'Today is clear' })).toBeInTheDocument();
    expect(screen.getByText("Today's plan is clear.")).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your next action' })).not.toBeInTheDocument();
    // Working further ahead stays possible, and is labelled as the optional thing it is.
    expect(screen.getByRole('link', { name: /Work ahead \(optional\)/ })).toBeInTheDocument();
  });

  test('meeting the daily goal stops the plan refilling with the next day\'s questions', () => {
    const store = makeStore();
    renderWithStore(<TodayPage />, store);

    act(() => {
      for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
    });

    // currentDay advances off the solved count, so day 2's slice now exists — but none of it
    // is pushed at the learner today. A met goal has to be able to stay met.
    const day2Title = questions[8]!.title;
    expect(screen.queryByText(day2Title)).not.toBeInTheDocument();
  });
});

describe('TodayPage — "I have N minutes"', () => {
  test('the plan is cut to the chosen budget, and what did not fit is stated rather than hidden', () => {
    const store = makeStore();
    store.dispatch(settingsUpdated({ dailyCapacityMin: 180 }));
    renderWithStore(<TodayPage />, store);

    const wideItems = within(sessionPlan()).getAllByRole('listitem').length;

    fireEvent.click(within(sessionPlan()).getByRole('radio', { name: '15m' }));

    const narrowItems = within(sessionPlan()).getAllByRole('listitem').length;
    expect(narrowItems).toBeLessThan(wideItems);
    expect(store.getState().settings.dailyCapacityMin).toBe(15);
    expect(within(sessionPlan()).getByText(/Not in this session:/)).toBeInTheDocument();
    expect(within(sessionPlan()).getByText(/nothing expires/)).toBeInTheDocument();
  });

  test('the chosen budget is the one the plate reports against', () => {
    const store = makeStore();
    renderWithStore(<TodayPage />, store);

    fireEvent.click(within(sessionPlan()).getByRole('radio', { name: '30m' }));

    const planned = within(sessionPlan()).getByText(/planned/);
    expect(planned).toBeInTheDocument();
    // Every total carries the "~" hedge — the estimates are estimates and say so.
    expect(planned.textContent).toMatch(/^~/);
  });
});

describe('TodayPage — returning after a gap', () => {
  test('two days away is met with a fresh start, not a pile of overdue work', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1));

    vi.setSystemTime(new Date('2026-08-04T12:00:00')); // 5 days later, nothing logged since
    renderWithStore(<TodayPage />, store);

    const notice = screen.getByRole('region', { name: 'Welcome back' });
    expect(within(notice).getByText(/It has been 5 days/)).toBeInTheDocument();
    expect(within(notice).getByText(/waited rather than expired/)).toBeInTheDocument();
    // No streak-loss language anywhere on the page.
    expect(screen.queryByText(/lost your/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  test('the notice does not appear once the learner has done something today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1));

    vi.setSystemTime(new Date('2026-08-04T12:00:00'));
    store.dispatch(solveQuestion(2)); // today's first solve
    renderWithStore(<TodayPage />, store);

    expect(screen.queryByRole('region', { name: 'Welcome back' })).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  test('the notice offers the five-minute re-entry into Focus small mode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1));

    vi.setSystemTime(new Date('2026-08-04T12:00:00'));
    renderWithStore(<TodayPage />, store);

    const notice = screen.getByRole('region', { name: 'Welcome back' });
    // The re-entry shrinks the unit of work, never the cadence: one door into Focus's small mode.
    const reentry = within(notice).getByRole('link', { name: 'Begin with five minutes' });
    expect(reentry).toHaveAttribute('href', '/focus?entry=small');

    vi.useRealTimers();
  });
});

describe('TodayPage — retained surfaces', () => {
  test('daily goal progress still tracks solves against the per-day target', () => {
    const store = makeStore();
    renderWithStore(<TodayPage />, store);

    expect(screen.getByText('0 / 8 solved today')).toBeInTheDocument();

    act(() => {
      store.dispatch(solveQuestion(1));
    });

    expect(screen.getByText('1 / 8 solved today')).toBeInTheDocument();
    expect(store.getState().progress.byId[1]!.status).toBe('solved');
  });

  test('daily goal met message appears once solvedToday reaches perDay', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) store.dispatch(solveQuestion(id));
    renderWithStore(<TodayPage />, store);

    expect(screen.getByText('8 / 8 solved today')).toBeInTheDocument();
    expect(screen.getByText(/Daily goal met/)).toBeInTheDocument();
  });

  test('weekly revision banner is absent on day 1', () => {
    renderWithStore(<TodayPage />);
    expect(screen.queryByText(/Weekly Revision Day/)).not.toBeInTheDocument();
  });

  test('AI/ML course card shows the next session, and one a day is the cadence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const { store } = renderWithStore(<TodayPage />);

    expect(screen.getByText('Week 0 — Orientation')).toBeInTheDocument();
    expect(screen.getByText('Day 1 · Lecture')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open plan' })).toHaveAttribute('href', '/aiml');

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));

    expect(store.getState().course.byWeekId.w00!.day1DoneOn).toBe('2026-07-30');
    expect(store.getState().gamification.xp).toBe(20);

    // This used to assert "Day 2 · Practice" appeared immediately — the card offering the next
    // session while the plan directly above it had already dropped the course for the day, two
    // answers to the same question one viewport apart. The card now applies the ranker's
    // done-today gate: the day's session is finished, and it says so.
    expect(screen.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument();
    expect(screen.queryByText('Day 2 · Practice')).not.toBeInTheDocument();
    expect(screen.getByText("Today's session is done")).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('AI/ML course card counts due week reviews', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00'));

    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2)); // first review lands tomorrow (the 30th)
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    renderWithStore(<TodayPage />, store);

    expect(screen.getByText('Week 1 — Fast-tracking the Course of AI')).toBeInTheDocument();
    expect(screen.getByText('1 week review due')).toBeInTheDocument();

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
