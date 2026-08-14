import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CourseState, PersistedStateV1 } from '@/types';
import {
  applyCourseReview,
  applyCourseWeekClear,
  initialCourseProgress,
  normalizeCourseWeekProgress,
  type CourseDay,
} from '@/utils/engine/aimlCourse';
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

    // Enters a just-cleared core week into the review ladder (first review tomorrow). The
    // thunk decides WHEN this fires (core week fully done); the reducer just applies the math.
    courseRevisionInitialized(state, action: PayloadAction<{ weekId: string; date: string }>) {
      const { weekId, date } = action.payload;
      const prev = state.byWeekId[weekId] ?? initialCourseProgress();
      state.byWeekId[weekId] = applyCourseWeekClear(prev, date);
    },

    courseRevisionLogged(
      state,
      action: PayloadAction<{ weekId: string; date: string; passed: boolean }>,
    ) {
      const { weekId, date, passed } = action.payload;
      const prev = state.byWeekId[weekId] ?? initialCourseProgress();
      state.byWeekId[weekId] = applyCourseReview(prev, date, passed);
    },

    // A "Check yourself" self-test result. First-attempt-per-date is the signal (drills
    // precedent): a same-day rerun replays prompts already seen, which is practice, not a cold
    // read, so the first result of a date stands. Never touches the ladder — this is a lighter
    // retrieval signal, recorded beside it.
    courseRecallRecorded(
      state,
      action: PayloadAction<{ weekId: string; date: string; correct: number; total: number }>,
    ) {
      const { weekId, date, correct, total } = action.payload;
      const prev = state.byWeekId[weekId] ?? initialCourseProgress();
      const checks = prev.recallChecks ?? {};
      if (checks[date]) return; // first attempt of the date wins
      state.byWeekId[weekId] = { ...prev, recallChecks: { ...checks, [date]: { correct, total } } };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (state, action: PayloadAction<PersistedStateV1>) => {
      // Backups made before the course track existed simply have no `course` key; entries
      // from the pre-ladder release are normalized up to the full shape.
      state.byWeekId = Object.fromEntries(
        Object.entries(action.payload.course?.byWeekId ?? {}).map(([weekId, progress]) => [
          weekId,
          normalizeCourseWeekProgress(progress),
        ]),
      );
    });
    builder.addCase(progressReset, (state) => {
      state.byWeekId = {};
    });
  },
});

export const {
  courseSessionCompleted,
  courseNotesSet,
  courseRevisionInitialized,
  courseRevisionLogged,
  courseRecallRecorded,
} = courseSlice.actions;

export default courseSlice.reducer;
