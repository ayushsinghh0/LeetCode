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
 * Dumb reducer, as everywhere: the ISO dates and the wall-clock readings arrive in payloads, taken
 * by the page from `useToday()` and `Date.now()`. The store is never the clock.
 *
 * TIME IS KEPT AS `elapsedSec` PLUS A WALL-CLOCK `startedAtMs`, the same shape contestSlice uses,
 * and the reason is a bug the previous shape had. `elapsedSec` used to be written only at stage
 * transitions while the page rebuilt its start instant from a component ref — but this page is a
 * lazy route, so navigating to /drills and back unmounted it and the clock resumed from the last
 * transition, silently discarding every minute since. A twenty-minute stage came back as zero and
 * the debrief then congratulated the learner on beating the recommendation. Here `startedAtMs` is
 * the instant the current running segment began and `elapsedSec` the settled total of the earlier
 * ones, so elapsed time survives a remount and no per-second dispatch is needed for it.
 *
 * Segments exist because time away is not time spent: the page settles on `visibilitychange` and
 * on unmount, exactly as ContestPage does, so a sitting left open in a background tab does not
 * bill the learner for the hours it sat there.
 */
export interface InterviewState {
  /** The problem under interview, or null when no attempt is running. */
  questionId: number | null;
  stage: StageId;
  /** The learner's own read on each stage they have worked through. Sparse — never a gate. */
  stageOutcomes: Partial<Record<StageId, StageOutcome>>;
  /** Post-attempt self-assessment, 1..5 per dimension. Sparse until answered; never totalled. */
  selfAssessment: Partial<Record<SelfAssessmentId, SelfAssessmentValue>>;
  /** Settled seconds from segments that have ended. The live segment is added by the page. */
  elapsedSec: number;
  /** Wall clock at the start of the running segment, or null while paused/finished. */
  startedAtMs: number | null;
  /**
   * `progress.byId[questionId].hintLevelUsed` as it stood when this sitting began.
   *
   * That field is the all-time deepest rung for the question, so a learner who opened the ladder
   * on it weeks ago would otherwise start an interview with the whole ladder already expanded —
   * defeating the one mechanism this feature has — and finish it being told they took three hints
   * in a sitting where they took none. The snapshot separates the two questions: what this
   * problem has ever needed, and what this attempt actually used.
   */
  hintsAtStart: number;
  /** Rungs opened during THIS sitting. What the debrief reports and the ladder renders from. */
  hintsTaken: number;
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
  startedAtMs: null,
  hintsAtStart: 0,
  hintsTaken: 0,
  startedOn: null,
  finishedOn: null,
};

/** Fold the running segment into the settled total and stop the clock. Whole seconds, no drift. */
function settle(state: InterviewState, nowMs: number) {
  if (state.startedAtMs === null) return;
  state.elapsedSec += Math.max(0, Math.floor((nowMs - state.startedAtMs) / 1000));
  state.startedAtMs = null;
}

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    // Starting always resets: an interview carries no state forward from the last one, and a
    // half-remembered previous attempt bleeding into a fresh sitting is exactly the bug that
    // makes a rehearsal untrustworthy.
    interviewStarted(
      state,
      action: PayloadAction<{
        questionId: number;
        date: string;
        nowMs: number;
        /** The question's all-time `hintLevelUsed` at this instant. See `hintsAtStart`. */
        hintsAtStart: number;
      }>,
    ) {
      state.questionId = action.payload.questionId;
      state.stage = FIRST_STAGE;
      state.stageOutcomes = {};
      state.selfAssessment = {};
      state.elapsedSec = 0;
      state.startedAtMs = action.payload.nowMs;
      state.hintsAtStart = Math.max(0, action.payload.hintsAtStart);
      state.hintsTaken = 0;
      state.startedOn = action.payload.date;
      state.finishedOn = null;
    },
    // The page supplies the destination rather than asking the reducer to walk the list — the
    // stage order lives in the engine, and two places knowing it is one place too many.
    interviewAdvanced(state, action: PayloadAction<{ stage: StageId }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      state.stage = action.payload.stage;
    },
    /** The learner left, or the tab went to the background. Time away is not time spent. */
    interviewPaused(state, action: PayloadAction<{ nowMs: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      settle(state, action.payload.nowMs);
    },
    /** Back on the page. Starts a fresh segment; the settled total is untouched. */
    interviewResumed(state, action: PayloadAction<{ nowMs: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      if (state.startedAtMs !== null) return;
      state.startedAtMs = action.payload.nowMs;
    },
    /**
     * One more rung opened in this sitting. Counted here rather than read back off
     * `hintLevelUsed`, which is monotonic: on a problem whose ladder was opened before, taking
     * rung 1 again moves that field not at all, and a UI driven by it would appear to be broken.
     */
    interviewHintTaken(state, action: PayloadAction<{ max: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      state.hintsTaken = Math.min(state.hintsTaken + 1, Math.max(0, action.payload.max));
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
    interviewFinished(state, action: PayloadAction<{ date: string; nowMs: number }>) {
      if (state.questionId === null || state.finishedOn !== null) return;
      settle(state, action.payload.nowMs);
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
  interviewPaused,
  interviewResumed,
  interviewHintTaken,
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
