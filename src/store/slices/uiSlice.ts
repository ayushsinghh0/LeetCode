import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset } from '@/store/sharedActions';

export type PomodoroPhase = 'idle' | 'focus' | 'break';

// endsAt is a wall-clock deadline (ms since epoch), not a decrementing counter — usePomodoro
// derives remainingSec from `endsAt - Date.now()` every tick. `endsAt: null` means either
// "never started" (phase 'idle') or "paused mid-phase" (phase 'focus'/'break' with the countdown
// stopped) — usePomodoro tells the two apart with its own local paused-remainder ref, not
// anything stored here.
export interface PomodoroState {
  phase: PomodoroPhase;
  endsAt: number | null;
  focusLenMin: number;
  breakLenMin: number;
}

export interface UiState {
  focusMode: boolean;
  activeQuestionId: number | null;
  celebration: 'confetti' | 'fireworks' | null;
  searchOpen: boolean;
  toastQueue: string[]; // achievement ids awaiting a toast
  pomodoro: PomodoroState;
}

const initialState: UiState = {
  focusMode: false,
  activeQuestionId: null,
  celebration: null,
  searchOpen: false,
  toastQueue: [],
  pomodoro: { phase: 'idle', endsAt: null, focusLenMin: 25, breakLenMin: 5 },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    focusModeSet(state, action: PayloadAction<boolean>) {
      state.focusMode = action.payload;
    },
    activeQuestionSet(state, action: PayloadAction<number | null>) {
      state.activeQuestionId = action.payload;
    },
    // payload null clears the celebration; thunks also use this action to SET a celebration.
    celebrationShown(state, action: PayloadAction<'confetti' | 'fireworks' | null>) {
      state.celebration = action.payload;
    },
    searchOpenSet(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
    toastPushed(state, action: PayloadAction<string[]>) {
      state.toastQueue.push(...action.payload);
    },
    toastPopped(state) {
      state.toastQueue.shift();
    },
    // Single flexible setter for every phase transition (start, pause, skip, auto-transition on
    // completion, reset) — usePomodoro computes the {phase, endsAt} pair for each and dispatches
    // this directly, mirroring the plain-uiSlice-action convention used by activeQuestionSet /
    // celebrationShown elsewhere in this slice.
    pomodoroPhaseSet(state, action: PayloadAction<{ phase: PomodoroPhase; endsAt: number | null }>) {
      state.pomodoro.phase = action.payload.phase;
      state.pomodoro.endsAt = action.payload.endsAt;
    },
    pomodoroLengthsSet(state, action: PayloadAction<{ focusLenMin: number; breakLenMin: number }>) {
      state.pomodoro.focusLenMin = action.payload.focusLenMin;
      state.pomodoro.breakLenMin = action.payload.breakLenMin;
    },
  },
  extraReducers: (builder) => {
    // PersistedStateV1 carries no UI data, so stateImported does not touch this slice.
    // progressReset clears celebration/toasts (but not focusMode/searchOpen/pomodoro, which are
    // pure session UI — not "progress").
    builder.addCase(progressReset, (state) => {
      state.celebration = null;
      state.toastQueue = [];
    });
  },
});

export const {
  focusModeSet,
  activeQuestionSet,
  celebrationShown,
  searchOpenSet,
  toastPushed,
  toastPopped,
  pomodoroPhaseSet,
  pomodoroLengthsSet,
} = uiSlice.actions;

export default uiSlice.reducer;
