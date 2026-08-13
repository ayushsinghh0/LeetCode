import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import { progressReset, stateImported } from '@/store/sharedActions';
import {
  FIRST_STAGE,
  STAGES,
  isSelfAssessmentValue,
  type SelfAssessmentId,
  type SelfAssessmentValue,
  type StageId,
  type StageOutcome,
} from '@/utils/engine/interview';

/**
 * The in-flight interview attempt: one sitting, start to finish.
 *
 * Deliberately NOT persisted — the same choice sessionSlice documents, and for a stronger reason
 * here. An interview attempt is a performance, not a record: reloading into "stage 6, 24 minutes
 * elapsed, hints already open" would restore a rehearsal that stopped happening the moment the
 * tab closed, and the elapsed figure would be a lie about how long the learner actually spent.
 * Starting fresh is the honest outcome. The signals that DO deserve to outlive the sitting
 * already have homes: hint use is written to `progress.byId[id].hintLevelUsed` by the existing
 * `revealHint` thunk, and the problem itself is untouched.
 *
 * Dumb reducer, as everywhere: the ISO dates and the elapsed reading arrive in payloads, taken by
 * the page from `useToday()` and its own timer. The store is never the clock.
 *
 * `elapsedSec` is written at each stage transition and at the finish rather than every second.
 * A per-second dispatch would keep the debounced persistence middleware permanently awake,
 * turning a quiet interview into a localStorage write per tick; the page ticks its own display
 * from a wall-clock start reading (the same idiom `usePomodoro` uses for `endsAt`) and records
 * the number at the moments it actually matters.
 */
export interface InterviewState {
  /** The problem under interview, or null when no attempt is running. */
  questionId: number | null;
  stage: StageId;
  /** The learner's own read on each stage they have worked through. Sparse — never a gate. */
  stageOutcomes: Partial<Record<StageId, StageOutcome>>;
  /** Post-attempt self-assessment, 1..5 per dimension. Sparse until answered; never totalled. */
  selfAssessment: Partial<Record<SelfAssessmentId, SelfAssessmentValue>>;
  elapsedSec: number;
  /** ISO date the sitting began, or null when none is running. */
  startedOn: string | null;
  /** ISO date it ended. Non-null means the attempt is over and the debrief is unlocked. */
  finishedOn: string | null;
}

const initialState: InterviewState = {
  questionId: null,
  stage: FIRST_STAGE,
  stageOutcomes: {},
  selfAssessment: {},
  elapsedSec: 0,
  startedOn: null,
  finishedOn: null,
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    // Starting always resets: an interview carries no state forward from the last one, and a
    // half-remembered previous attempt bleeding into a fresh sitting is exactly the bug that
    // makes a rehearsal untrustworthy.
    interviewStarted(state, action: PayloadAction<{ questionId: number; date: string }>) {
      state.questionId = action.payload.questionId;
      state.stage = FIRST_STAGE;
      state.stageOutcomes = {};
      state.selfAssessment = {};
      state.elapsedSec = 0;
      state.startedOn = action.payload.date;
      state.finishedOn = null;
    },
    // The page supplies the destination rather than asking the reducer to walk the list — the
    // stage order lives in the engine, and two places knowing it is one place too many.
    interviewAdvanced(state, action: PayloadAction<{ stage: StageId; elapsedSec: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      state.stage = action.payload.stage;
      state.elapsedSec = action.payload.elapsedSec;
    },
    stageOutcomeSet(state, action: PayloadAction<{ stage: StageId; outcome: StageOutcome }>) {
      if (state.questionId === null) return;
      state.stageOutcomes[action.payload.stage] = action.payload.outcome;
    },
    selfAssessmentSet(
      state,
      action: PayloadAction<{ id: SelfAssessmentId; value: number }>,
    ) {
      if (state.questionId === null) return;
      // Range-guarded here rather than at the call site, so no surface can write a 7 into a
      // 1..5 self-report and quietly change what the number means on the next attempt.
      if (!isSelfAssessmentValue(action.payload.value)) return;
      state.selfAssessment[action.payload.id] = action.payload.value;
    },
    // Ending is allowed from any stage — a real interview can stop early, and an app that
    // refuses to let you stop is not rehearsing anything realistic.
    interviewFinished(state, action: PayloadAction<{ date: string; elapsedSec: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      state.elapsedSec = action.payload.elapsedSec;
      state.finishedOn = action.payload.date;
    },
    interviewCleared: () => initialState,
  },
  extraReducers: (builder) => {
    // An imported backup describes a learner's history; it has never contained a sitting in
    // progress, and starting one on their behalf would be inventing an event.
    builder.addCase(stateImported, () => initialState);
    builder.addCase(progressReset, () => initialState);
  },
});

export const {
  interviewStarted,
  interviewAdvanced,
  stageOutcomeSet,
  selfAssessmentSet,
  interviewFinished,
  interviewCleared,
} = interviewSlice.actions;

export default interviewSlice.reducer;

// --- Selectors (kept beside the slice, same as tasksSlice and drillsSlice) --------------------

const selectInterview = (state: { interview: InterviewState }) => state.interview;

export type InterviewPhase = 'idle' | 'running' | 'finished';

/**
 * The page has exactly three shapes, and deriving which one from two nullable fields at every
 * render is how a fourth, impossible one eventually appears.
 */
export const selectInterviewPhase = createSelector([selectInterview], (interview): InterviewPhase => {
  if (interview.questionId === null) return 'idle';
  return interview.finishedOn === null ? 'running' : 'finished';
});

/**
 * Stages the learner rated, in workflow order — the debrief's "how it went" list. Ordered off
 * STAGES rather than off insertion, because a learner who goes back and rates an earlier stage
 * would otherwise see their own interview replayed out of sequence.
 */
export const selectRatedStages = createSelector([selectInterview], (interview) =>
  STAGES.filter((stage) => interview.stageOutcomes[stage.id] !== undefined).map(
    (stage) => [stage.id, interview.stageOutcomes[stage.id]!] as [StageId, StageOutcome],
  ),
);
