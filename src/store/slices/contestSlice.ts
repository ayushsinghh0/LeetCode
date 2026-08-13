import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset, stateImported } from '@/store/sharedActions';

/**
 * A contest in progress.
 *
 * Not persisted, for the same reason a revision session is not: a contest is a sitting under a
 * clock, and restoring one after a reload would either resume a timer that stopped counting or
 * silently forgive the gap. Both are lies about what happened. A closed contest is simply over.
 *
 * Per-problem time is measured here rather than through the app's focus ledger. The two are
 * different measurements: `DayLog.focusMinutes` is the canonical total-time ledger attributed via
 * `ui.focusQuestionId`, and contest time is a stopwatch on a set. Folding one into the other
 * would double-count the same minutes across two dimensions, which the time-attribution invariant
 * exists to prevent. Solves made during a contest go through the normal `solveQuestion` thunk, so
 * streaks, XP and the day log all see them exactly as they would any other solve.
 */
export interface ContestAttemptState {
  solved: boolean;
  /** Whole minutes accumulated on this problem across every visit to it. */
  minutesSpent: number;
}

export interface ContestState {
  /** Stable seed the set was built from — null when no contest is running. */
  seed: string | null;
  questionIds: number[];
  /** Parallel to `questionIds`: the authored estimate each problem is measured against. */
  targetMinutes: number[];
  durationMin: number;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  attempts: Record<number, ContestAttemptState>;
  /** Which problem the clock is currently attributed to. */
  activeQuestionId: number | null;
  activeSinceMs: number | null;
}

const initialState: ContestState = {
  seed: null,
  questionIds: [],
  targetMinutes: [],
  durationMin: 0,
  startedAtMs: null,
  finishedAtMs: null,
  attempts: {},
  activeQuestionId: null,
  activeSinceMs: null,
};

/**
 * Fold whatever time is on the clock into the active problem and stop it.
 *
 * Rounded to whole minutes because that is the resolution every figure in this product uses, and
 * because sub-minute precision on a self-timed exercise is invented. Time is only ever *added*,
 * never replaced, so switching back and forth between problems accumulates honestly.
 */
function settleActive(state: ContestState, nowMs: number) {
  if (state.activeQuestionId === null || state.activeSinceMs === null) return;
  const elapsed = Math.max(0, Math.round((nowMs - state.activeSinceMs) / 60_000));
  const attempt = state.attempts[state.activeQuestionId];
  if (attempt) attempt.minutesSpent += elapsed;
  state.activeQuestionId = null;
  state.activeSinceMs = null;
}

const contestSlice = createSlice({
  name: 'contest',
  initialState,
  reducers: {
    contestStarted(
      state,
      action: PayloadAction<{
        seed: string;
        questionIds: number[];
        targetMinutes: number[];
        durationMin: number;
        nowMs: number;
      }>,
    ) {
      const { seed, questionIds, targetMinutes, durationMin, nowMs } = action.payload;
      state.seed = seed;
      state.questionIds = [...questionIds];
      state.targetMinutes = [...targetMinutes];
      state.durationMin = durationMin;
      state.startedAtMs = nowMs;
      state.finishedAtMs = null;
      state.attempts = Object.fromEntries(
        questionIds.map((id) => [id, { solved: false, minutesSpent: 0 }]),
      );
      state.activeQuestionId = null;
      state.activeSinceMs = null;
    },

    /** Point the clock at a problem. Any time already running is settled onto the previous one. */
    contestProblemFocused(state, action: PayloadAction<{ questionId: number; nowMs: number }>) {
      const { questionId, nowMs } = action.payload;
      if (state.activeQuestionId === questionId) return;
      settleActive(state, nowMs);
      if (state.attempts[questionId]) {
        state.activeQuestionId = questionId;
        state.activeSinceMs = nowMs;
      }
    },

    contestProblemBlurred(state, action: PayloadAction<{ nowMs: number }>) {
      settleActive(state, action.payload.nowMs);
    },

    contestProblemSolved(state, action: PayloadAction<{ questionId: number; nowMs: number }>) {
      const { questionId, nowMs } = action.payload;
      const attempt = state.attempts[questionId];
      if (!attempt) return;
      if (state.activeQuestionId === questionId) settleActive(state, nowMs);
      attempt.solved = true;
    },

    contestFinished(state, action: PayloadAction<{ nowMs: number }>) {
      settleActive(state, action.payload.nowMs);
      state.finishedAtMs = action.payload.nowMs;
    },

    contestCleared: () => initialState,
  },
  extraReducers: (builder) => {
    // An imported backup is history; it never describes a contest that is currently running.
    builder.addCase(stateImported, () => initialState);
    builder.addCase(progressReset, () => initialState);
  },
});

export const {
  contestStarted,
  contestProblemFocused,
  contestProblemBlurred,
  contestProblemSolved,
  contestFinished,
  contestCleared,
} = contestSlice.actions;

export default contestSlice.reducer;

/** Whole minutes elapsed since the contest began, for the header clock. */
export function contestElapsedMin(state: ContestState, nowMs: number): number {
  if (state.startedAtMs === null) return 0;
  const end = state.finishedAtMs ?? nowMs;
  return Math.max(0, Math.round((end - state.startedAtMs) / 60_000));
}
