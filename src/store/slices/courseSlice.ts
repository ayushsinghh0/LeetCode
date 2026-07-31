import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CourseState, PersistedStateV1 } from '@/types';
import { initialCourseProgress, type CourseDay } from '@/utils/engine/aimlCourse';
import { progressReset, stateImported } from '@/store/sharedActions';

// AI/ML course track. byWeekId is sparse (same rule as progress.byId): only touched weeks
// exist, every reader falls back to initialCourseProgress(). Validation of week ids/days
// lives in the thunks (actions.ts) — reducers stay dumb.
const initialState: CourseState = {
  byWeekId: {},
};

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {
    // Stamps the completion date once; marking an already-done session again is a no-op so
    // XP-awarding thunks can trust "changed exactly once" semantics.
    courseSessionCompleted(
      state,
      action: PayloadAction<{ weekId: string; day: CourseDay; date: string }>,
    ) {
      const { weekId, day, date } = action.payload;
      const prev = state.byWeekId[weekId] ?? initialCourseProgress();
      if (day === 1 && prev.day1DoneOn === null) {
        state.byWeekId[weekId] = { ...prev, day1DoneOn: date };
      } else if (day === 2 && prev.day2DoneOn === null) {
        state.byWeekId[weekId] = { ...prev, day2DoneOn: date };
      }
    },

    courseNotesSet(state, action: PayloadAction<{ weekId: string; notes: string }>) {
      const { weekId, notes } = action.payload;
      const prev = state.byWeekId[weekId] ?? initialCourseProgress();
      state.byWeekId[weekId] = { ...prev, notes };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (state, action: PayloadAction<PersistedStateV1>) => {
      // Backups made before the course track existed simply have no `course` key.
      state.byWeekId = action.payload.course?.byWeekId ?? {};
    });
    builder.addCase(progressReset, (state) => {
      state.byWeekId = {};
    });
  },
});

export const { courseSessionCompleted, courseNotesSet } = courseSlice.actions;

export default courseSlice.reducer;
