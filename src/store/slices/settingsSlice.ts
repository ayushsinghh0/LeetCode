import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedStateV1, SettingsState } from '@/types';
import { stateImported } from '@/store/sharedActions';

const initialState: SettingsState = {
  questionsPerDay: 8,
  revisionEnabled: true,
  theme: 'dark',
  notifications: false,
  dailyCapacityMin: 180, // the plan's default study budget — an evening block
  contestOnToday: true,  // due contest reviews are shown on Today; the learner can switch it off
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    settingsUpdated(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    // progressReset intentionally NOT handled here — settings survive a progress reset.
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => {
      // dailyCapacityMin and contestOnToday are optional in persisted payloads (they predate the
      // daily plan and V13 respectively) — boundary-normalize them in, same rule as the
      // gamification bonus gates.
      return {
        ...action.payload.settings,
        dailyCapacityMin: action.payload.settings.dailyCapacityMin ?? 180,
        contestOnToday: action.payload.settings.contestOnToday ?? true,
      };
    });
  },
});

export const { settingsUpdated } = settingsSlice.actions;

export default settingsSlice.reducer;
