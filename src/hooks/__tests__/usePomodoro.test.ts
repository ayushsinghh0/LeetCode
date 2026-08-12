import type { ReactNode } from 'react';
import { act, createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@/store/store';
import { usePomodoro } from '@/hooks/usePomodoro';
import { todayISO } from '@/utils/dates';

// Fake timers throughout: usePomodoro derives remainingSec from an `endsAt` wall-clock
// deadline (not a decrementing counter), so every assertion here has to move the fake clock
// forward with vi.advanceTimersByTime and let the hook's internal tick interval catch up.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

// This test file is plain .ts (not .tsx, per the brief's exact filename) so the Provider
// wrapper is built with createElement instead of JSX syntax.
function wrapperFor(store: AppStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store, children });
  };
}

describe('usePomodoro', () => {
  test('starts idle, showing the full focus length', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    expect(result.current.phase).toBe('idle');
    expect(result.current.remainingSec).toBe(result.current.focusLenMin * 60);
    expect(result.current.isRunning).toBe(false);
  });

  test('start() enters the focus phase and remainingSec ticks down as fake time advances', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe('focus');
    expect(result.current.isRunning).toBe(true);
    const justStarted = result.current.remainingSec;

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSec).toBeLessThan(justStarted);
    expect(result.current.remainingSec).toBe(justStarted - 3);
  });

  test('a focus phase completing logs the session (DayLog.focusMinutes) and auto-starts a break', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.setLengths(1, 1); // 1-minute focus / 1-minute break keeps the test fast
    });
    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe('focus');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.phase).toBe('break');
    expect(result.current.isRunning).toBe(true);
    expect(store.getState().progress.dayLogs[todayISO()]!.focusMinutes).toBe(1);
  });

  test('a break phase completing returns to idle without logging another focus session', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.setLengths(1, 1);
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(60_000); // focus -> break
    });
    expect(result.current.phase).toBe('break');

    act(() => {
      vi.advanceTimersByTime(60_000); // break -> idle
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.isRunning).toBe(false);
    expect(store.getState().progress.dayLogs[todayISO()]!.focusMinutes).toBe(1); // unchanged
  });

  test('skip() ends the current phase: focus -> break, break -> idle', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe('focus');

    act(() => {
      result.current.skip();
    });
    expect(result.current.phase).toBe('break');
    // Skipping a focus phase must not credit a focus session — only a real completion does.
    expect(store.getState().progress.dayLogs[todayISO()]).toBeUndefined();

    act(() => {
      result.current.skip();
    });
    expect(result.current.phase).toBe('idle');
  });

  test('pause() freezes remainingSec, and start() resumes from the frozen value', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const atPause = result.current.remainingSec;

    act(() => {
      result.current.pause();
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.phase).toBe('focus'); // still mid-focus, just stopped

    act(() => {
      vi.advanceTimersByTime(10_000); // time passes in the real world while paused
    });
    expect(result.current.remainingSec).toBe(atPause); // frozen, did not keep ticking

    act(() => {
      result.current.start(); // resume
    });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.remainingSec).toBe(atPause); // resumed from where it paused

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSec).toBe(atPause - 1);
  });

  test('reset() always returns to idle, regardless of the current phase', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.remainingSec).toBe(result.current.focusLenMin * 60);
  });

  test('setLengths() updates focusLenMin/breakLenMin and the idle display', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePomodoro(), { wrapper: wrapperFor(store) });

    act(() => {
      result.current.setLengths(15, 3);
    });

    expect(result.current.focusLenMin).toBe(15);
    expect(result.current.breakLenMin).toBe(3);
    expect(result.current.remainingSec).toBe(15 * 60);
  });
});
