import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedStateV1, PracticeIntention, PracticeSitting, PracticeState } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';
import { SITTINGS_CAP } from '@/utils/engine/practice';

const initialState: PracticeState = {
  intentions: [],
  journal: {},
  sittings: [],
};

// The practice layer — positive-habit machinery kept deliberately unscored. Three independent
// records, none of which awards XP or drives a streak (design record § 3 B+E, copy rules § 4):
//
//  - intentions: the learner's own "After [cue], I will [action]" lines, authored in Settings and
//    replaced wholesale (a small fixed list, never incrementally tracked).
//  - journal: one line per date, last-write-wins — the session-close reflection.
//  - sittings: revision sittings (planned vs done), the internal evidence sessionFollowThrough
//    reads. Capped to the most recent SITTINGS_CAP; older sittings age out.
//
// Reducers are dumb writers: dates and normalized payloads arrive from the practice thunks and
// the finish/clear revision thunks, never from the clock.
const practiceSlice = createSlice({
  name: 'practice',
  initialState,
  reducers: {
    // Replace-all: the Settings form owns the whole (≤3) list, and the thunk normalizes it first.
    intentionsSet(state, action: PayloadAction<PracticeIntention[]>) {
      state.intentions = action.payload.map((i) => ({ cue: i.cue, action: i.action }));
    },
    // One line per date, last-write-wins. An empty line clears the entry rather than persisting
    // a blank — the store never holds an empty journal value, so the validator can require one.
    journalWritten(state, action: PayloadAction<{ date: string; line: string }>) {
      const { date, line } = action.payload;
      if (line === '') {
        delete state.journal[date];
        return;
      }
      state.journal[date] = line;
    },
    sittingRecorded(state, action: PayloadAction<PracticeSitting>) {
      state.sittings.push(action.payload);
      if (state.sittings.length > SITTINGS_CAP) {
        state.sittings = state.sittings.slice(-SITTINGS_CAP);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      intentions: [...(action.payload.practice?.intentions ?? [])],
      journal: { ...(action.payload.practice?.journal ?? {}) },
      sittings: [...(action.payload.practice?.sittings ?? [])],
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { intentionsSet, journalWritten, sittingRecorded } = practiceSlice.actions;

export default practiceSlice.reducer;
