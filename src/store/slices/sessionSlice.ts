import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset, stateImported } from '@/store/sharedActions';
import type { SessionActivity } from '@/utils/engine/session';

/**
 * The in-flight revision session: which activities have been worked through, and when it started.
 *
 * Deliberately NOT persisted, while the chosen length (`settings.revisionBudgetMin`) is. That
 * split is the design. What a learner must not have to re-enter is their available time; what
 * they should not have restored is a plan built against yesterday's due queue. Rebuilding the
 * session from current state after a reload is more correct than replaying a stale one, because
 * the ladder has moved on and the plan would be quietly wrong.
 */
export interface SessionState {
  /**
   * The plan, frozen at the moment it was started.
   *
   * The session selector recomputes from live state, so grading a review moves it off the due
   * queue and the plan would reshuffle underneath the learner mid-sitting — items vanishing as
   * they are completed, new ones appearing to replace them. A session is a commitment to a
   * specific piece of work; holding the list still for its duration is what makes "3 of 5" mean
   * anything. Rebuilt fresh on the next start, so it never goes stale.
   */
  activities: SessionActivity[];
  /** Activity ids from `buildRevisionSession` that have been completed this sitting. */
  doneIds: string[];
  /** ISO date the session was started, or null when none is running. */
  startedOn: string | null;
  /** ISO date it was finished — drives the completion summary. */
  completedOn: string | null;
}

const initialState: SessionState = {
  activities: [],
  doneIds: [],
  startedOn: null,
  completedOn: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<{ date: string; activities: SessionActivity[] }>) {
      state.activities = action.payload.activities;
      state.doneIds = [];
      state.startedOn = action.payload.date;
      state.completedOn = null;
    },
    // Idempotent: an activity can be ticked from the session list or from the question sheet, and
    // the two must not double-count.
    activityCompleted(state, action: PayloadAction<{ activityId: string }>) {
      if (!state.doneIds.includes(action.payload.activityId)) {
        state.doneIds.push(action.payload.activityId);
      }
    },
    activityUncompleted(state, action: PayloadAction<{ activityId: string }>) {
      state.doneIds = state.doneIds.filter((id) => id !== action.payload.activityId);
    },
    sessionFinished(state, action: PayloadAction<{ date: string }>) {
      state.completedOn = action.payload.date;
    },
    sessionCleared: () => initialState,
  },
  extraReducers: (builder) => {
    // An imported backup describes a learner's history, not a sitting in progress — starting one
    // on their behalf would be inventing an event that never happened.
    builder.addCase(stateImported, () => initialState);
    builder.addCase(progressReset, () => initialState);
  },
});

export const {
  sessionStarted,
  activityCompleted,
  activityUncompleted,
  sessionFinished,
  sessionCleared,
} = sessionSlice.actions;

export default sessionSlice.reducer;
