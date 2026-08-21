import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ContestLibraryState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';
import {
  applyContestAttempt,
  applyContestReview,
  applyContestSolve,
  initialContestProgress,
  normalizeContestProgress,
} from '@/utils/engine/contestLibrary';

/**
 * Progress through the contest library — the second question universe.
 *
 * Keyed by SLUG, and that is the load-bearing decision. `progress.byId` is keyed by roadmap ids
 * 1–539; LeetCode's ids run past 4,000, so the two key spaces overlap directly and solving contest
 * problem 47 would have silently corrupted roadmap question 47. Keying by slug removes the
 * collision by removing the shared number, and the slug is the identity the whole ingestion
 * pipeline already joins on.
 *
 * Separate from `progressSlice` for the same reason `mlSlice` is separate from `courseSlice`, and
 * PRODUCT.md's two-universes rule says it plainly: the 539 are a curated curriculum, this is a
 * pool you draw from. A contest problem that IS a curriculum question is reached through
 * `curriculumQuestionId` and keeps its progress in `progress.byId` — one problem, one record,
 * never two that can disagree.
 *
 * Sparse like every other map in the store, and a dumb writer like every other slice: dates
 * arrive in payloads from the thunks, never from a clock in here.
 */
const initialState: ContestLibraryState = {
  bySlug: {},
};

const contestLibrarySlice = createSlice({
  name: 'contestLibrary',
  initialState,
  reducers: {
    /** An attempt that produced no solution. Recorded as evidence; it costs the learner nothing. */
    contestProblemAttempted(state, action: PayloadAction<{ slug: string; date: string }>) {
      const { slug, date } = action.payload;
      const current = state.bySlug[slug] ?? initialContestProgress();
      state.bySlug[slug] = applyContestAttempt(current, date);
    },

    /**
     * A solve. Enters the shared ladder on the first one; a later re-solve does not restart it.
     * `selfReported` marks a direct tick (the sheet's "Mark solved") — sitting solves omit it.
     */
    contestProblemSolved(
      state,
      action: PayloadAction<{ slug: string; date: string; selfReported?: true }>,
    ) {
      const { slug, date, selfReported } = action.payload;
      const current = state.bySlug[slug] ?? initialContestProgress();
      state.bySlug[slug] = applyContestSolve(current, date, selfReported === true);
    },

    /** A graded review. Pass climbs 1/3/7/15/30; any fail restarts at stage 0, due tomorrow. */
    contestProblemReviewed(
      state,
      action: PayloadAction<{ slug: string; date: string; passed: boolean }>,
    ) {
      const { slug, date, passed } = action.payload;
      const current = state.bySlug[slug];
      // Only a problem already on the ladder can be reviewed. Grading something never solved
      // would schedule a review of work that never happened.
      if (!current || !current.solved) return;
      state.bySlug[slug] = applyContestReview(current, date, passed);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      bySlug: Object.fromEntries(
        Object.entries(action.payload.contestLibrary?.bySlug ?? {}).map(([slug, progress]) => [
          slug,
          // Boundary normalizer, so a payload written before a field existed gains its default
          // here rather than arriving undefined at a reader (the optional-with-boundary-default
          // pattern every persisted slice follows).
          normalizeContestProgress(progress),
        ]),
      ),
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { contestProblemAttempted, contestProblemSolved, contestProblemReviewed } =
  contestLibrarySlice.actions;

export default contestLibrarySlice.reducer;
