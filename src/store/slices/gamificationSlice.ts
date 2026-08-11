import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

export interface GamificationState {
  xp: number;
  unlocked: Record<string, string>; // achievementId -> ISO date unlocked
  // Bonus gates, set by actions.ts the moment each bonus is awarded. The daily-goal bonus may
  // fire once per calendar date (guards against questionsPerDay changing mid-day re-arming the
  // threshold); the weekly-clear bonus once per roadmap day (currentDay is progress-derived, so
  // a user parked on the same weekly day across several calendar days must not re-earn it).
  dailyGoalBonusDate: string | null;
  weeklyClearBonusDay: number | null;
}

const initialState: GamificationState = {
  xp: 0,
  unlocked: {},
  dailyGoalBonusDate: null,
  weeklyClearBonusDay: null,
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
    dailyGoalBonusMarked(state, action: PayloadAction<string>) {
      state.dailyGoalBonusDate = action.payload;
    },
    weeklyClearBonusMarked(state, action: PayloadAction<number>) {
      state.weeklyClearBonusDay = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => {
      const g = action.payload.gamification;
      return {
        xp: g.xp,
        unlocked: { ...g.unlocked },
        // Optional in persisted payloads (older backups predate the bonus gates).
        dailyGoalBonusDate: g.dailyGoalBonusDate ?? null,
        weeklyClearBonusDay: g.weeklyClearBonusDay ?? null,
      };
    });
    builder.addCase(progressReset, () => initialState);
  },
});

export const { xpAdded, achievementsUnlocked, dailyGoalBonusMarked, weeklyClearBonusMarked } =
  gamificationSlice.actions;

export default gamificationSlice.reducer;
