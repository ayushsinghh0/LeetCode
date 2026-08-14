import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ContestProblemRecord, ContestsState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

const initialState: ContestsState = {
  byDate: {},
};

// Contest evidence — the persisted residue of a finished sitting, and the only part of a contest
// that survives one. The live sitting (`contestSlice`) is deliberately never persisted: a restored
// stopped clock lies about what happened. What outlives it is the derived record `analyzeContest`
// produced — which patterns genuinely stalled, how each problem read, dated so the weakness model
// can decay the evidence. Policy mirrors drills: the FIRST sitting of a calendar date is the
// recorded signal — contests are seeded by the date, so a same-day rerun replays a set whose
// problems have already been seen, which is practice, not a cold read. Reducers are dumb writers:
// the date arrives in the payload from the `finishContest` thunk, never from the clock, and an
// inconclusive contest never reaches this slice at all (`analyzeContest` decides that, and stays
// the single source of the decision).
//
// A CONCLUSIVE sitting where nothing stalled banks a record too, with `stalledPatterns: []`. It
// contributes nothing to the weakness model — which iterates that array — and everything to an
// honest account of timed work: a channel that only ever recorded the sittings that went badly
// would be a sample selected for failure, and every comparison drawn from it would inherit that.
const contestsSlice = createSlice({
  name: 'contests',
  initialState,
  reducers: {
    contestSittingRecorded(
      state,
      action: PayloadAction<{
        date: string;
        stalledPatterns: string[];
        attempted: number;
        total: number;
        problems?: ContestProblemRecord[];
      }>,
    ) {
      const { date, stalledPatterns, attempted, total, problems } = action.payload;
      if (state.byDate[date]) return;
      state.byDate[date] = {
        stalledPatterns: [...stalledPatterns],
        attempted,
        total,
        ...(problems ? { problems: problems.map((p) => ({ ...p })) } : {}),
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      byDate: { ...(action.payload.contests?.byDate ?? {}) },
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { contestSittingRecorded } = contestsSlice.actions;

export default contestsSlice.reducer;
