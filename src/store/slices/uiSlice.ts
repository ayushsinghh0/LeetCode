import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset } from '@/store/sharedActions';

export interface UiState {
  focusMode: boolean;
  activeQuestionId: number | null;
  celebration: 'confetti' | 'fireworks' | null;
  searchOpen: boolean;
  toastQueue: string[]; // achievement ids awaiting a toast
}

const initialState: UiState = {
  focusMode: false,
  activeQuestionId: null,
  celebration: null,
  searchOpen: false,
  toastQueue: [],
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
  },
  extraReducers: (builder) => {
    // PersistedStateV1 carries no UI data, so stateImported does not touch this slice.
    // progressReset clears celebration/toasts (but not focusMode/searchOpen, which are pure
    // session UI — not "progress").
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
} = uiSlice.actions;

export default uiSlice.reducer;
