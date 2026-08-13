import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { DrillsState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

const initialState: DrillsState = {
  byDate: {},
};

// Recognition-drill results. Policy: the FIRST attempt of a calendar date is the recorded
// signal — reruns are practice and must not overwrite it (an honest weakness model needs the
// cold read, not the best-of-N). Each entry keeps its own missed patterns so aggregates are
// derived, never double-booked. Reducers are dumb writers: the date arrives in the payload
// from the logDrillResult thunk, never from the clock.
const drillsSlice = createSlice({
  name: 'drills',
  initialState,
  reducers: {
    drillRecorded(
      state,
      action: PayloadAction<{ date: string; correct: number; total: number; missedPatterns: string[] }>,
    ) {
      const { date, correct, total, missedPatterns } = action.payload;
      if (state.byDate[date]) return;
      state.byDate[date] = { correct, total, missedPatterns: [...missedPatterns] };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      byDate: { ...(action.payload.drills?.byDate ?? {}) },
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { drillRecorded } = drillsSlice.actions;

export default drillsSlice.reducer;

// --- Selectors (kept beside the slice, same as tasksSlice) -----------------------------------

const selectByDate = (state: { drills: DrillsState }) => state.drills.byDate;
const selectExcludeDate = (_state: { drills: DrillsState }, excludeDate?: string) => excludeDate;

// Cumulative misses per pattern, optionally excluding one date. The drill builder excludes
// *today* so recording today's attempt cannot reshuffle today's own drill on reload.
export const selectMissCounts = createSelector(
  [selectByDate, selectExcludeDate],
  (byDate, excludeDate): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const [date, entry] of Object.entries(byDate)) {
      if (date === excludeDate) continue;
      for (const pattern of entry.missedPatterns) {
        counts[pattern] = (counts[pattern] ?? 0) + 1;
      }
    }
    return counts;
  },
);

// Weakness needs repeated evidence: a single miss is noise, not a signal (one bad question
// must not brand a pattern weak). Top three, most-missed first, ties by pattern id.
export const selectMostMissedPatterns = createSelector([selectByDate], (byDate) => {
  const counts: Record<string, number> = {};
  for (const entry of Object.values(byDate)) {
    for (const pattern of entry.missedPatterns) {
      counts[pattern] = (counts[pattern] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern))
    .slice(0, 3);
});
