import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ContestsState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

const initialState: ContestsState = {
  byDate: {},
};

// Contest stall evidence — the persisted residue of a finished sitting, and the only part of a
// contest that survives one. The live sitting (`contestSlice`) is deliberately never persisted:
// a restored stopped clock lies about what happened. What outlives it is the derived record
// `analyzeContest` produced — which patterns genuinely stalled, dated so the weakness model can
// decay the evidence. Policy mirrors drills: the FIRST sitting of a calendar date is the
// recorded signal — contests are seeded by the date, so a same-day rerun replays a set whose
// problems have already been seen, which is practice, not a cold read. Reducers are dumb
// writers: the date arrives in the payload from the `finishContest` thunk, never from the clock,
// and an inconclusive contest never reaches this slice at all (`analyzeContest` suppresses its
// `patternGaps` to [] and stays the single source of that decision).
const contestsSlice = createSlice({
  name: 'contests',
  initialState,
  reducers: {
    contestStallsRecorded(
      state,
      action: PayloadAction<{ date: string; stalledPatterns: string[]; attempted: number; total: number }>,
    ) {
      const { date, stalledPatterns, attempted, total } = action.payload;
      if (state.byDate[date]) return;
      state.byDate[date] = { stalledPatterns: [...stalledPatterns], attempted, total };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      byDate: { ...(action.payload.contests?.byDate ?? {}) },
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { contestStallsRecorded } = contestsSlice.actions;

export default contestsSlice.reducer;
