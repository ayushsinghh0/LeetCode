import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset, stateImported } from '@/store/sharedActions';
import type { RevisionSession } from '@/utils/engine/session';

/**
 * The in-flight revision session: which activities have been worked through, and when it started.
 *
 * Deliberately NOT persisted, while the chosen length (`settings.dailyCapacityMin`) is. That
 * split is the design. What a learner must not have to re-enter is their available time; what
 * they should not have restored is a plan built against yesterday's due queue. Rebuilding the
 * session from current state after a reload is more correct than replaying a stale one, because
 * the ladder has moved on and the plan would be quietly wrong.
 */
export interface SessionState {
  /**
   * The WHOLE built session, frozen at the moment it was started — not just its activity list.
   *
   * The session selector recomputes from live state, so grading a review moves it off the due
   * queue and the plan would reshuffle underneath the learner mid-sitting. Freezing only the
   * activities was not enough: the shape label, focus line, rationale and deferred list kept
   * recomputing live, so changing the shared capacity on Today mid-sitting relabelled a running
   * "Deep review" as "Quick recall" over the same ten activities. A session is a commitment to a
   * specific piece of work; every property of that commitment holds still for its duration.
   */
  frozen: RevisionSession | null;
  /** Activity ids from the frozen session that have been completed this sitting. */
  doneIds: string[];
  /**
   * Grade recorded per gradable activity id (true = recalled). A grade is FINAL for the sitting:
   * the ladder has moved and the XP is paid the moment it lands, so the UI shows the recorded
   * outcome rather than an "Undo" that could only pretend — see the no-undo rule in
   * store/actions.ts, and the same-day guard in reviseQuestion that backs this at the thunk.
   */
  grades: Record<string, boolean>;
  /** ISO date the session was started, or null when none is running. */
  startedOn: string | null;
  /** ISO date it was finished — drives the completion summary. */
  completedOn: string | null;
}

const initialState: SessionState = {
  frozen: null,
  doneIds: [],
  grades: {},
  startedOn: null,
  completedOn: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<{ date: string; session: RevisionSession }>) {
      state.frozen = action.payload.session;
      state.doneIds = [];
      state.grades = {};
      state.startedOn = action.payload.date;
      state.completedOn = null;
    },
    // Idempotent: an activity can be ticked from the session list or from the question sheet, and
    // the two must not double-count. The first recorded grade wins for the same reason.
    activityCompleted(
      state,
      action: PayloadAction<{ activityId: string; grade?: boolean }>,
    ) {
      const { activityId, grade } = action.payload;
      if (!state.doneIds.includes(activityId)) {
        state.doneIds.push(activityId);
      }
      if (grade !== undefined && !(activityId in state.grades)) {
        state.grades[activityId] = grade;
      }
    },
    // Un-ticking exists only for ungraded ticks (drills, the closing reflection): those record
    // "I did the thing", which the learner may honestly retract. A graded activity never comes
    // back through here — its grade already moved the ladder.
    activityUncompleted(state, action: PayloadAction<{ activityId: string }>) {
      if (action.payload.activityId in state.grades) return;
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
