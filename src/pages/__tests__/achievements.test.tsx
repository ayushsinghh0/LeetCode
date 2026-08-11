import { act } from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import AchievementsPage, { groupAchievements } from '@/pages/AchievementsPage';
import { AchievementToast } from '@/components/gamification/AchievementToast';
import { achievementsUnlocked } from '@/store/slices/gamificationSlice';
import { toastPushed } from '@/store/slices/uiSlice';
import { ACHIEVEMENTS } from '@/utils/engine/achievements';

const TOTAL = ACHIEVEMENTS.length; // 59: 20 fixed + 28 pattern-100-<patternId> + 11 course-*

// Safety net mirroring the existing suites: fake timers must never leak between tests.
afterEach(() => {
  vi.useRealTimers();
});

describe('AchievementsPage', () => {
  test('sanity: the achievements engine exposes exactly 59 defs', () => {
    expect(TOTAL).toBe(59);
  });

  test('fresh store: renders all 59 achievement cards (locked) and "Unlocked 0 / 59"', () => {
    renderWithStore(<AchievementsPage />);

    // Locked state is announced by a role="img" "Locked" badge on each card (an aria-label on
    // the bare card div was ignored by AT — deliberate a11y rework).
    for (const def of ACHIEVEMENTS) {
      expect(screen.getByText(def.title)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('img', { name: 'Locked' })).toHaveLength(TOTAL);
    expect(screen.getByText('Unlocked 0 / 59')).toBeInTheDocument();
  });

  test('a fixture-unlocked achievement shows its unlock date and bumps the header count; an untouched one stays locked', () => {
    const store = makeStore();
    store.dispatch(achievementsUnlocked({ ids: ['first-solve'], date: '2026-07-30' }));
    renderWithStore(<AchievementsPage />, store);

    const unlockedCard = screen.getByText('First Blood').closest('div')!;
    expect(within(unlockedCard).getByText('Unlocked Jul 30, 2026')).toBeInTheDocument();
    expect(within(unlockedCard).queryByRole('img', { name: 'Locked' })).not.toBeInTheDocument();
    expect(screen.getByText('Unlocked 1 / 59')).toBeInTheDocument();

    const lockedDef = ACHIEVEMENTS.find((a) => a.id === 'solved-539')!;
    const lockedCard = screen.getByText(lockedDef.title).closest('div')!;
    expect(within(lockedCard).getByRole('img', { name: 'Locked' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Locked' })).toHaveLength(TOTAL - 1);
  });

  test('renders all six group section headings', () => {
    renderWithStore(<AchievementsPage />);

    for (const heading of ['Progress', 'Streaks', 'Patterns', 'Mastery', 'Course', 'Special']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});

// groupAchievements is the pure helper AchievementsPage delegates to for its 5 sections — tested
// directly against the real ACHIEVEMENTS array so a future addition to the engine (e.g. a 29th
// pattern, or a new fixed id that matches no prefix) is provably still grouped exactly once
// rather than silently dropped or duplicated.
describe('groupAchievements', () => {
  test('every def in ACHIEVEMENTS lands in exactly one of the 5 groups', () => {
    const groups = groupAchievements(ACHIEVEMENTS);

    expect(groups.map((g) => g.name)).toEqual(['Progress', 'Streaks', 'Patterns', 'Mastery', 'Course', 'Special']);

    const totalGrouped = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalGrouped).toBe(ACHIEVEMENTS.length);

    const seen = new Set<string>();
    for (const group of groups) {
      for (const item of group.items) {
        expect(seen.has(item.id)).toBe(false); // no id appears in two groups
        seen.add(item.id);
      }
    }
    expect(seen.size).toBe(ACHIEVEMENTS.length); // and none were dropped
  });

  test('Patterns group holds exactly the 28 pattern-100-* ids; Streaks holds exactly the 6 streak-* ids', () => {
    const groups = groupAchievements(ACHIEVEMENTS);
    const patterns = groups.find((g) => g.name === 'Patterns')!;
    const streaks = groups.find((g) => g.name === 'Streaks')!;

    expect(patterns.items.every((i) => i.id.startsWith('pattern-100-'))).toBe(true);
    expect(patterns.items).toHaveLength(28);
    expect(streaks.items.every((i) => i.id.startsWith('streak-'))).toBe(true);
    expect(streaks.items).toHaveLength(6);
  });
});

describe('AchievementToast', () => {
  test('shows the first queued toast, drains one at a time after 4s, then disappears', () => {
    vi.useFakeTimers();
    const store = makeStore();
    renderWithStore(<AchievementToast />, store);

    expect(screen.queryByText('Achievement unlocked!')).not.toBeInTheDocument();

    act(() => {
      store.dispatch(toastPushed(['first-solve', 'solved-10']));
    });

    expect(screen.getByText('Achievement unlocked!')).toBeInTheDocument();
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // First toast auto-dismissed via toastPopped; queue now holds just the second id, and its
    // toast has taken over.
    expect(store.getState().ui.toastQueue).toEqual(['solved-10']);
    expect(screen.queryByText('First Blood')).not.toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(store.getState().ui.toastQueue).toEqual([]);
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Achievement unlocked!')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  test('the dismiss (X) button pops the toast immediately, without waiting for the 4s timer', () => {
    vi.useFakeTimers();
    const store = makeStore();
    renderWithStore(<AchievementToast />, store);

    act(() => {
      store.dispatch(toastPushed(['first-solve']));
    });
    expect(screen.getByText('First Blood')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(store.getState().ui.toastQueue).toEqual([]);
    expect(screen.queryByText('First Blood')).not.toBeInTheDocument();

    // The now-cancelled 4s timer must not fire a stray toastPopped against an already-empty queue.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(store.getState().ui.toastQueue).toEqual([]);

    vi.useRealTimers();
  });

  test('cleans up its pending timer on unmount so no stray toastPopped fires afterward', () => {
    vi.useFakeTimers();
    const store = makeStore();
    const { unmount } = renderWithStore(<AchievementToast />, store);

    act(() => {
      store.dispatch(toastPushed(['first-solve']));
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Queue is untouched — the pending timer was cancelled by unmount cleanup, not fired.
    expect(store.getState().ui.toastQueue).toEqual(['first-solve']);

    vi.useRealTimers();
  });
});
