import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

export interface GamificationState {
  xp: number;
  unlocked: Record<string, string>; // achievementId -> ISO date unlocked
}

const initialState: GamificationState = {
  xp: 0,
  unlocked: {},
};

const gamificationSlice = createSlice({
  name: 'gamification',
  initialState,
  reducers: {
    xpAdded(state, action: PayloadAction<number>) {
      state.xp += action.payload;
    },
    achievementsUnlocked(state, action: PayloadAction<{ ids: string[]; date: string }>) {
      const { ids, date } = action.payload;
      for (const id of ids) {
        if (!Object.hasOwn(state.unlocked, id)) {
          state.unlocked[id] = date;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => {
      return { ...action.payload.gamification };
    });
    builder.addCase(progressReset, () => initialState);
  },
});

export const { xpAdded, achievementsUnlocked } = gamificationSlice.actions;

export default gamificationSlice.reducer;
