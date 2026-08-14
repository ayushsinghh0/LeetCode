import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MlState, PersistedStateV1 } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';
import {
  applyMlRebuild,
  applyMlRung,
  initialMlProjectProgress,
  initialMlTrackProgress,
  normalizeMlTrackProgress,
} from '@/utils/engine/mlTrack';

/**
 * Progress through the ML implementation tracks and projects.
 *
 * Sparse, like `progress.byId` and `course.byWeekId`: only what the learner has touched exists,
 * and every reader falls back to `initialMlTrackProgress()`. Separate from `courseSlice` on
 * purpose — different id space, and a track's `weekId` is frequently null, so folding them
 * together would make "the course" mean two things at once.
 *
 * Dumb writer as everywhere: dates arrive in payloads from the thunks, never from a clock here.
 */
const initialState: MlState = {
  tracksById: {},
  projectsById: {},
};

const mlSlice = createSlice({
  name: 'ml',
  initialState,
  reducers: {
    /** Stamp a rung. Stamps never move: `applyMlRung` returns the same entry if it exists. */
    mlRungCompleted(state, action: PayloadAction<{ trackId: string; rungId: string; date: string }>) {
      const { trackId, rungId, date } = action.payload;
      const current = state.tracksById[trackId] ?? initialMlTrackProgress();
      state.tracksById[trackId] = applyMlRung(current, rungId, date);
    },

    /** A rebuild from a blank file, graded by the learner. One per track per calendar date. */
    mlTrackRebuilt(state, action: PayloadAction<{ trackId: string; date: string; passed: boolean }>) {
      const { trackId, date, passed } = action.payload;
      const current = state.tracksById[trackId];
      // Only a track already on the ladder can be reviewed — a rebuild of something never written
      // would be a review of nothing.
      if (!current || current.rungs.scratch === undefined) return;
      state.tracksById[trackId] = applyMlRebuild(current, date, passed);
    },

    mlProjectStarted(state, action: PayloadAction<{ projectId: string; date: string }>) {
      const { projectId, date } = action.payload;
      const current = state.projectsById[projectId] ?? initialMlProjectProgress();
      if (current.startedOn !== null) return;
      state.projectsById[projectId] = { ...current, startedOn: date };
    },

    mlProjectShipped(state, action: PayloadAction<{ projectId: string; date: string }>) {
      const { projectId, date } = action.payload;
      const current = state.projectsById[projectId] ?? initialMlProjectProgress();
      if (current.shippedOn !== null) return;
      state.projectsById[projectId] = {
        // Shipping something never marked as started still records a start: the work happened, and
        // a shipped project with no start date would break every activity read of it.
        startedOn: current.startedOn ?? date,
        shippedOn: date,
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      tracksById: Object.fromEntries(
        Object.entries(action.payload.ml?.tracksById ?? {}).map(([id, progress]) => [
          id,
          normalizeMlTrackProgress(progress),
        ]),
      ),
      projectsById: { ...(action.payload.ml?.projectsById ?? {}) },
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { mlRungCompleted, mlTrackRebuilt, mlProjectStarted, mlProjectShipped } =
  mlSlice.actions;

export default mlSlice.reducer;
