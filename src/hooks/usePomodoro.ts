import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { pomodoroLengthsSet, pomodoroPhaseSet, type PomodoroPhase } from '@/store/slices/uiSlice';
import { logFocusSession } from '@/store/actions';

const TICK_MS = 250;

export interface UsePomodoroResult {
  phase: PomodoroPhase;
  remainingSec: number;
  isRunning: boolean;
  focusLenMin: number;
  breakLenMin: number;
  start: () => void;
  pause: () => void;
  skip: () => void;
  reset: () => void;
  setLengths: (focusLenMin: number, breakLenMin: number) => void;
}

/**
 * Deadline-based Pomodoro timer. The store only ever holds `{ phase, endsAt }` — a wall-clock
 * deadline, never a decrementing counter — so nothing here accumulates tick-to-tick drift.
 * `ui` (and therefore `ui.pomodoro`) is NOT part of PersistedStateV1 (see
 * services/storage/serialize.ts), so a page refresh always comes back up idle; a session lost to
 * a refresh is an accepted tradeoff, not a bug.
 *
 * Multiple mounts (the floating AppShell widget vs. FocusPage's inline one) share the same
 * running timer because it's derived from redux state, not local component state — except for
 * the "paused, frozen remaining seconds" value, which lives only in this hook's own ref. A
 * remount while paused (e.g. navigating to/from /focus, which swaps which widget instance is
 * mounted) loses that exact frozen value and falls back to displaying the phase's full length —
 * an intentionally minor degradation of the same "ui isn't persisted" tradeoff above, not
 * something worth a 5th redux field to fix.
 */
export function usePomodoro(): UsePomodoroResult {
  const dispatch = useAppDispatch();
  const phase = useAppSelector((s) => s.ui.pomodoro.phase);
  const endsAt = useAppSelector((s) => s.ui.pomodoro.endsAt);
  const focusLenMin = useAppSelector((s) => s.ui.pomodoro.focusLenMin);
  const breakLenMin = useAppSelector((s) => s.ui.pomodoro.breakLenMin);

  const frozenRemainingRef = useRef<number | null>(null);

  // `now` (not a raw Date.now() read during render) is what remainingSec is computed from, so a
  // paused/idle render is stable across re-renders instead of drifting each time this component
  // happens to re-render for an unrelated reason.
  const [now, setNow] = useState(() => Date.now());

  // Resyncs `now` the instant `endsAt` changes (start/skip/reset/auto-transition all change it)
  // so the very next render already reflects the fresh deadline, then ticks every TICK_MS while
  // a phase is actually running. No interval at all while idle/paused (endsAt === null).
  useEffect(() => {
    setNow(Date.now());
    if (endsAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [endsAt]);

  const isRunning = endsAt !== null;

  const remainingSec = (() => {
    if (phase === 'idle') return focusLenMin * 60;
    if (endsAt === null) {
      return frozenRemainingRef.current ?? (phase === 'focus' ? focusLenMin : breakLenMin) * 60;
    }
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  })();

  // Fires the moment a running phase's deadline passes: a completed FOCUS phase logs the session
  // (DayLog.focusMinutes, via the cross-slice logFocusSession thunk) and auto-starts a break; a
  // completed BREAK phase just returns to idle, ready for the next focus session (no session is
  // logged for a break). Re-checks on every tick (`now` in the deps) but is a no-op unless the
  // deadline has actually passed, so it can't double-fire once the new endsAt is in the future.
  useEffect(() => {
    if (endsAt === null || now < endsAt) return;
    if (phase === 'focus') {
      dispatch(logFocusSession(focusLenMin));
      dispatch(pomodoroPhaseSet({ phase: 'break', endsAt: now + breakLenMin * 60_000 }));
    } else if (phase === 'break') {
      dispatch(pomodoroPhaseSet({ phase: 'idle', endsAt: null }));
    }
  }, [now, endsAt, phase, focusLenMin, breakLenMin, dispatch]);

  const start = useCallback(() => {
    if (phase === 'idle') {
      dispatch(pomodoroPhaseSet({ phase: 'focus', endsAt: Date.now() + focusLenMin * 60_000 }));
      return;
    }
    if (endsAt !== null) return; // already running — no-op

    // Resuming from pause: pick up from the frozen remainder (or the full phase length if it
    // was lost to a remount — see the doc comment above).
    const remainingSecAtResume = frozenRemainingRef.current ?? (phase === 'focus' ? focusLenMin : breakLenMin) * 60;
    frozenRemainingRef.current = null;
    dispatch(pomodoroPhaseSet({ phase, endsAt: Date.now() + remainingSecAtResume * 1000 }));
  }, [phase, endsAt, focusLenMin, breakLenMin, dispatch]);

  const pause = useCallback(() => {
    if (endsAt === null) return; // idle or already paused — no-op
    frozenRemainingRef.current = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    dispatch(pomodoroPhaseSet({ phase, endsAt: null }));
  }, [endsAt, phase, dispatch]);

  // Ends the CURRENT phase early without crediting it (no logFocusSession — that only happens on
  // a real completion) and advances to the next one: focus -> break, break -> idle. A no-op while
  // idle (nothing running to skip).
  const skip = useCallback(() => {
    frozenRemainingRef.current = null;
    if (phase === 'focus') {
      dispatch(pomodoroPhaseSet({ phase: 'break', endsAt: Date.now() + breakLenMin * 60_000 }));
    } else if (phase === 'break') {
      dispatch(pomodoroPhaseSet({ phase: 'idle', endsAt: null }));
    }
  }, [phase, breakLenMin, dispatch]);

  // Unlike skip(), unconditionally aborts back to idle regardless of the current phase — the
  // "stop everything" action, vs. skip's "move on to the next phase early".
  const reset = useCallback(() => {
    frozenRemainingRef.current = null;
    dispatch(pomodoroPhaseSet({ phase: 'idle', endsAt: null }));
  }, [dispatch]);

  const setLengths = useCallback(
    (newFocusLenMin: number, newBreakLenMin: number) => {
      dispatch(pomodoroLengthsSet({ focusLenMin: newFocusLenMin, breakLenMin: newBreakLenMin }));
    },
    [dispatch],
  );

  return { phase, remainingSec, isRunning, focusLenMin, breakLenMin, start, pause, skip, reset, setLengths };
}
