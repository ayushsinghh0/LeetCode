import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { InterviewSittingRecord, InterviewsState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

/**
 * Interview evidence — the persisted residue of a finished sitting.
 *
 * The live sitting (`interviewSlice`) stays unpersisted for the reason its own docblock gives: an
 * interview is a performance, and restoring one mid-flight would resume a rehearsal that stopped
 * happening. What outlives it is this derived record. Until it existed, the debrief's own copy
 * ("the five numbers exist so you can compare this sitting with your next one") was a promise the
 * storage layer could not keep — the numbers died with the tab.
 *
 * Two rules hold this channel to the product's honesty contract:
 *
 * 1. NOTHING AGGREGATES. There is no judge, so the dimensions stay separate self-reported numbers
 *    and no reader may total them. A single "interview score" is banned at two layers of tests and
 *    would be the clearest example of the invented precision this product refuses.
 * 2. NOTHING IS EARNED. Sitting an interview pays no XP and unlocks nothing. A record is evidence;
 *    the moment it is also a reward, the incentive is to farm sittings rather than perform in them.
 *
 * The reducer is a dumb writer, as everywhere: dates and clock readings arrive in the payload from
 * `finishInterview`, which normalizes them into something `validatePersisted` can never reject.
 */
const initialState: InterviewsState = {
  sittings: [],
};

/**
 * The tail this channel keeps. Matches `practice.sittings`' cap in spirit — enough history for a
 * trend to be visible, not so much that a local-first payload grows without bound. Interviews are
 * far rarer than practice sittings, so forty of them is a long stretch of real work.
 */
export const MAX_INTERVIEW_SITTINGS = 40;

const interviewsSlice = createSlice({
  name: 'interviews',
  initialState,
  reducers: {
    interviewSittingRecorded(state, action: PayloadAction<InterviewSittingRecord>) {
      state.sittings.push({ ...action.payload });
      if (state.sittings.length > MAX_INTERVIEW_SITTINGS) {
        state.sittings = state.sittings.slice(-MAX_INTERVIEW_SITTINGS);
      }
    },

    /**
     * Amend the sitting just banked.
     *
     * The self-assessment is answered on the debrief screen, i.e. AFTER the sitting is finished
     * and recorded, so the record has to be written first (or navigating away would lose the
     * sitting entirely) and completed afterwards. The guard is what keeps that honest: the patch
     * only lands if the last record is still the same sitting — same question, same date — so a
     * stray dispatch can never rewrite an older interview's numbers.
     */
    interviewSittingAmended(
      state,
      action: PayloadAction<{
        questionId: number;
        date: string;
        assessment: Record<string, number>;
      }>,
    ) {
      const last = state.sittings[state.sittings.length - 1];
      if (!last) return;
      if (last.questionId !== action.payload.questionId || last.date !== action.payload.date) return;
      last.assessment = { ...action.payload.assessment };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      sittings: [...(action.payload.interviews?.sittings ?? [])],
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { interviewSittingRecorded, interviewSittingAmended } = interviewsSlice.actions;

export default interviewsSlice.reducer;
