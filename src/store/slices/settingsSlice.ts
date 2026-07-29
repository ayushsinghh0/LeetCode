import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedStateV1, SettingsState } from '@/types';
import { stateImported } from '@/store/sharedActions';

const initialState: SettingsState = {
  questionsPerDay: 8,
  revisionEnabled: true,
  theme: 'dark',
  notifications: false,
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
      return { ...action.payload.settings };
    });
  },
});

export const { settingsUpdated } = settingsSlice.actions;

export default settingsSlice.reducer;
