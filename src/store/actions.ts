// The public mutation API. UI code must dispatch these thunks — never raw slice actions —
// because cross-slice writes (progress + gamification + ui) only happen safely here.
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { Confidence, PersistedStateV1, Question, SettingsState, TaskCategory } from '@/types';
import type { AppThunk, RootState } from '@/store/store';
import { addDays, todayISO } from '@/utils/dates';
import { DAILY_GOAL_BONUS, SOLVE_XP, WEEKLY_CLEAR_BONUS, revisionXp } from '@/utils/engine/xp';
import { CAPACITY_MAX, CAPACITY_MIN } from '@/utils/engine/planner';
import { currentDay, isWeeklyRevisionDay } from '@/utils/engine/roadmap';
import { patternStats } from '@/utils/engine/stats';
import { evaluateAchievements } from '@/utils/engine/achievements';
import {
  bonusXpLogged,
  bookmarkToggled,
  confidenceSet,
  focusMinutesAdded,
  hintRevealed,
  notesSet,
  reflectionSet,
  missNoteSet,
  questionSkipped,
  questionSolved,
  questionStarted,
  revisionLogged,
  timeSpentAdded,
} from '@/store/slices/progressSlice';
import {
  courseNotesSet,
  courseRevisionInitialized,
  courseRevisionLogged,
  courseSessionCompleted,
} from '@/store/slices/courseSlice';
import {
  nextTaskId,
  taskAdded,
  taskDeleted,
  taskRescheduled,
  taskToggled,
} from '@/store/slices/tasksSlice';
import { drillRecorded } from '@/store/slices/drillsSlice';
import { buildContest } from '@/utils/engine/contest';
import {
  contestCleared,
  contestFinished,
  contestProblemBlurred,
  contestProblemFocused,
  contestProblemSolved,
  contestStarted,
} from '@/store/slices/contestSlice';
import { contestStallsRecorded } from '@/store/slices/contestsSlice';
import { intentionsSet, journalWritten, sittingRecorded } from '@/store/slices/practiceSlice';
import { normalizeIntentions, normalizeSitting } from '@/utils/engine/practice';
import {
  activityCompleted,
  activityUncompleted,
  sessionCleared,
  sessionFinished,
  sessionStarted,
} from '@/store/slices/sessionSlice';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { courseWeekById } from '@/data/aimlCourse';
import {
  COURSE_REVIEW_XP,
  COURSE_SESSION_XP,
  COURSE_WEEK_CLEAR_BONUS,
  initialCourseProgress,
  isSessionDone,
  isWeekDone,
  isWeekRetained,
  sessionCount,
  type CourseDay,
} from '@/utils/engine/aimlCourse';
import {
  achievementsUnlocked,
  dailyGoalBonusMarked,
  weeklyClearBonusMarked,
  xpAdded,
} from '@/store/slices/gamificationSlice';
import { isMastered } from '@/utils/engine/spacedRepetition';
import { MAX_HINT_LEVEL } from '@/utils/engine/hints';
import { celebrationShown, toastPushed } from '@/store/slices/uiSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import {
  selectAchievementCtx,
  selectContestAnalysis,
  selectRevisionQueueIds,
  selectRevisionSession,
  selectSolvedNewCount,
} from '@/store/selectors';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

function evaluateAndUnlockAchievements(
  dispatch: ThunkDispatch<RootState, unknown, UnknownAction>,
  getState: () => RootState,
  today: string,
): void {
  const state = getState();
  const ctx = selectAchievementCtx(state, today);
  const newIds = evaluateAchievements(ctx, state.gamification.unlocked);
  if (newIds.length > 0) {
    dispatch(achievementsUnlocked({ ids: newIds, date: today }));
    dispatch(toastPushed(newIds));
  }
}

export const startQuestion = (id: number): AppThunk => (dispatch) => {
  dispatch(questionStarted({ id }));
};

export const skipQuestion = (id: number): AppThunk => (dispatch) => {
  dispatch(questionSkipped({ id }));
};

export const toggleBookmark = (id: number): AppThunk => (dispatch) => {
  dispatch(bookmarkToggled({ id }));
};

export const saveNotes = (id: number, notes: string): AppThunk => (dispatch) => {
  dispatch(notesSet({ id, notes }));
};

export const setConfidence = (id: number, confidence: Confidence): AppThunk => (dispatch) => {
  dispatch(confidenceSet({ id, confidence }));
};

// Records that the learner opened rung `level` of the hint ladder. Deliberately has no XP
// penalty and no visible cost: a support feature people avoid using because it is scored
// against them stops being a support feature. The signal exists so "solved" and "solved
// unaided" can be told apart later, nothing more.
export const revealHint = (id: number, level: number): AppThunk => (dispatch) => {
  if (!questionById.has(id)) return;
  if (!Number.isInteger(level) || level < 1 || level > MAX_HINT_LEVEL) return;
  dispatch(hintRevealed({ id, level }));
};

// The learner's own answer to "what did you learn?", captured at solve time.
export const saveReflection = (id: number, reflection: string): AppThunk => (dispatch) => {
  if (!questionById.has(id)) return;
  dispatch(reflectionSet({ id, reflection }));
};

// The "what tripped it?" line after a failed recall — trimmed, last-write-wins, no penalty. A
// blank note clears the field. Guarded on a real question id like saveReflection, so a stray call
// can never materialize a sparse progress entry for a non-existent question.
export const saveMissNote = (id: number, note: string): AppThunk => (dispatch) => {
  if (!questionById.has(id)) return;
  dispatch(missNoteSet({ id, note: note.trim() }));
};

// Records a completed focus phase. DayLog.focusMinutes is the canonical total time ledger;
// when the Focus screen has a question up (ui.focusQuestionId, maintained by FocusPage), the
// same minutes are ALSO attributed to that question's timeSpentMin — a breakdown of the total,
// not an addition to it, so analytics must never sum the two dimensions together.
// Records a finished recognition drill. The drills slice enforces first-attempt-of-the-day
// semantics itself; this thunk only supplies the date. `missedPatterns` lists the correct
// pattern of every wrongly answered item (duplicates allowed — two misses in one family's
// pattern are two pieces of evidence).
//
// The normalization below is the same class of guard as `setDailyCapacity`'s bounds, and it is
// here for the same reason: `validatePersisted` hard-rejects a drill entry with `total < 1`,
// `correct > total`, a blank pattern id, or more missed patterns than there were misses — and a
// rejected payload quarantines the learner's ENTIRE state on the next load. Today the invariant
// happens to be held by DrillsPage's render flow, which answers every item exactly once; that is
// a property of one caller, not of the API. A validator stricter than its write path is a
// data-loss bug waiting for a second caller, so the thunk guarantees a persistable payload
// itself rather than trusting whoever calls it.
export const logDrillResult =
  (correct: number, total: number, missedPatterns: string[]): AppThunk =>
  (dispatch) => {
    const safeTotal = Math.floor(total);
    // Nothing was asked, so there is no result to record — writing one would be a fiction.
    if (!Number.isFinite(safeTotal) || safeTotal < 1) return;
    const safeCorrect = Math.min(Math.max(Math.floor(correct) || 0, 0), safeTotal);
    const safeMissed = missedPatterns
      .filter((p): p is string => typeof p === 'string' && p !== '')
      .slice(0, safeTotal - safeCorrect);
    dispatch(
      drillRecorded({ date: todayISO(), correct: safeCorrect, total: safeTotal, missedPatterns: safeMissed }),
    );
  };

export const logFocusSession = (minutes: number): AppThunk => (dispatch, getState) => {
  const date = todayISO();
  dispatch(focusMinutesAdded({ date, minutes }));

  const questionId = getState().ui.focusQuestionId;
  if (questionId !== null && questionById.has(questionId)) {
    dispatch(timeSpentAdded({ id: questionId, minutes }));
  }
};

// Solves `id`, awarding SOLVE_XP[difficulty]. Daily-goal bonus + confetti fire the instant
// today's solved count crosses exactly `questionsPerDay`. Fireworks fire instead (taking
// priority) if this solve brings the question's pattern to 100%. Achievements are evaluated
// last so a fresh 'first-solve'/streak/pattern-complete unlock can toast immediately.
export const solveQuestion = (id: number): AppThunk => (dispatch, getState) => {
  const question = questionById.get(id);
  if (!question) return;

  // Idempotency choke point: once a question is solved (any day, not just today), re-solving it
  // is a no-op — no XP, no dayLog/solvedIds mutation, no achievements re-evaluation, and (via
  // skipping questionSolved entirely) no unconditional applySolve to silently reset
  // revisionStage/nextRevision and wipe climbed spaced-repetition-ladder progress. The "Need
  // Revision" UI action (solveQuestion + setConfidence(id, 2)) on an already-solved card
  // therefore degrades to confidence-only: this no-ops, and the setConfidence dispatch that
  // follows it still applies, flagging the question low-confidence without restarting the ladder.
  if (getState().progress.byId[id]?.status === 'solved') return;

  const date = todayISO();
  const xp = SOLVE_XP[question.difficulty];

  // Read before dispatch: only credit gamification XP once per question per day, mirroring the
  // idempotency guard the progress reducer applies to dayLog.xpEarned/solvedIds.
  const dayLogBefore = getState().progress.dayLogs[date];
  const alreadySolvedToday = !!dayLogBefore && dayLogBefore.solvedIds.includes(id);

  dispatch(questionSolved({ id, date, xp }));

  // Everything below (base XP, daily-goal bonus/confetti, pattern-100% fireworks) must fire at
  // most once per question per day — gate the whole block on the same idempotency check the
  // progress reducer applies to dayLog.xpEarned/solvedIds. Without this, re-dispatching
  // solveQuestion for an already-solved-today id would leave solvedTodayCount unchanged at
  // exactly `perDay` (or the pattern still at 100%) and re-fire the bonus/celebration forever.
  if (!alreadySolvedToday) {
    dispatch(xpAdded(xp));

    const perDay = getState().settings.questionsPerDay;
    const dayLog = getState().progress.dayLogs[date];
    const solvedTodayCount = dayLog ? dayLog.solvedIds.length : 0;

    // ">= perDay" plus a once-per-date marker rather than "=== perDay": questionsPerDay can
    // change mid-day. With a bare equality check, raising it after the bonus fired would let the
    // count cross the new threshold and award +25 twice; lowering it below the current count
    // would mean the bonus never fires at all. The marker makes both directions safe.
    let celebration: 'confetti' | 'fireworks' | null = null;
    const goalAlreadyAwarded = getState().gamification.dailyGoalBonusDate === date;
    if (solvedTodayCount >= perDay && !goalAlreadyAwarded) {
      dispatch(xpAdded(DAILY_GOAL_BONUS));
      dispatch(bonusXpLogged({ date, xp: DAILY_GOAL_BONUS })); // keep dayLog.xpEarned in sync with gamification.xp
      dispatch(dailyGoalBonusMarked(date));
      celebration = 'confetti';
    }

    const stats = patternStats(questions, getState().progress.byId);
    const patternStat = stats.find((s) => s.pattern === question.pattern);
    if (patternStat && patternStat.pct === 100) {
      celebration = 'fireworks';
    }

    if (celebration) {
      dispatch(celebrationShown(celebration));
    }
  }

  evaluateAndUnlockAchievements(dispatch, getState, date);
};

// Logs a revision attempt, awarding revisionXp(difficulty) regardless of pass/fail. On a
// weekly-revision day, awards WEEKLY_CLEAR_BONUS exactly once, at the deterministic moment this
// dispatch causes the FULL revision queue (due + weekly top-up, i.e. selectRevisionQueueIds — the
// same set the UI renders and the "N revisions queued" banner counts) to transition from >0 to 0.
// Gating on due alone (the previous behavior) fired the bonus as soon as due-only hit zero, even
// with top-up extras still outstanding; queue-drained semantics require every queued item —
// due and top-up alike — to have been attempted. A failed attempt reschedules to tomorrow (and,
// like a pass, stamps lastReviewed = today, excluding it from weeklyTopUp's pool), so pass or
// fail both count as "attempted" and drain today's queue.
export const reviseQuestion = (id: number, passed: boolean): AppThunk => (dispatch, getState) => {
  const question = questionById.get(id);
  if (!question) return;

  const stateBefore = getState();

  // Only solved, not-yet-mastered questions are reviewable — mirrors reviseCourseWeek's
  // isWeekDone/isWeekRetained guard. Without this, any dataset id could be "revised",
  // materializing an unsolved sparse entry with a revision history, skewing pass rates, and
  // farming revision XP. (Dueness is deliberately NOT a precondition: reviewing early, e.g.
  // from a weekly top-up, is allowed.)
  const progressBefore = stateBefore.progress.byId[id];
  if (!progressBefore || progressBefore.status !== 'solved' || isMastered(progressBefore)) return;

  const date = todayISO();

  // One grade per question per calendar day — the same idempotency solveQuestion has. A pass
  // schedules the next review days out and a fail reschedules to tomorrow, so a second same-day
  // grade is never product-legitimate; without this gate a stray double-dispatch double-moves
  // the 1/3/7/15/30 ladder, double-pays XP, and double-counts the day log.
  if (progressBefore.lastReviewed === date) return;

  const xp = revisionXp(question.difficulty);

  const perDay = stateBefore.settings.questionsPerDay;
  const day = currentDay(selectSolvedNewCount(stateBefore), perDay, questions.length);
  const queueBefore = selectRevisionQueueIds(stateBefore, date).length;

  dispatch(revisionLogged({ id, date, passed, xp }));
  dispatch(xpAdded(xp)); // every revision attempt earns xp, pass or fail

  // Once per roadmap day, gated by the persisted marker: currentDay derives from solved count,
  // not the calendar, so a user parked on the same weekly day across several calendar days
  // would otherwise re-drain the refilled queue and re-earn +50 every day.
  const queueAfter = selectRevisionQueueIds(getState(), date).length;
  if (
    isWeeklyRevisionDay(day) &&
    queueBefore > 0 &&
    queueAfter === 0 &&
    stateBefore.gamification.weeklyClearBonusDay !== day
  ) {
    dispatch(xpAdded(WEEKLY_CLEAR_BONUS));
    dispatch(bonusXpLogged({ date, xp: WEEKLY_CLEAR_BONUS })); // keep dayLog.xpEarned in sync with gamification.xp
    dispatch(weeklyClearBonusMarked(day));
  }

  evaluateAndUnlockAchievements(dispatch, getState, date);
};

// Marks one AI/ML course session done (one-way, like solveQuestion — no undo anywhere in the
// app). Awards COURSE_SESSION_XP through both registers (gamification.xp and the day's ledger,
// via bonusXpLogged) so Σ dayLogs[*].xpEarned stays in sync with gamification.xp. Course work
// never writes into solvedIds/revision arrays — those stay DSA ledgers; streaks and the
// heatmap instead count course days via courseActivityByDate, derived from the byWeekId
// stamps this thunk writes. Completing a core week's second session adds
// COURSE_WEEK_CLEAR_BONUS + confetti.
export const completeCourseSession = (weekId: string, day: CourseDay): AppThunk => (
  dispatch,
  getState,
) => {
  const week = courseWeekById.get(weekId);
  if (!week) return;
  if (day > sessionCount(week)) return; // extras are single-session

  const before = getState().course.byWeekId[weekId] ?? initialCourseProgress();
  if (isSessionDone(before, day)) return; // idempotency choke point, mirrors solveQuestion

  const date = todayISO();
  dispatch(courseSessionCompleted({ weekId, day, date }));
  dispatch(xpAdded(COURSE_SESSION_XP));
  dispatch(bonusXpLogged({ date, xp: COURSE_SESSION_XP }));

  const after = getState().course.byWeekId[weekId] ?? initialCourseProgress();
  if (!week.optional && isWeekDone(week, after)) {
    dispatch(courseRevisionInitialized({ weekId, date })); // first review lands tomorrow
    dispatch(xpAdded(COURSE_WEEK_CLEAR_BONUS));
    dispatch(bonusXpLogged({ date, xp: COURSE_WEEK_CLEAR_BONUS }));
    dispatch(celebrationShown('confetti'));
  }

  evaluateAndUnlockAchievements(dispatch, getState, date);
};

// Grades a week review, pass or fail — same ladder semantics as reviseQuestion (fail → stage 0,
// due tomorrow), same half-rate XP rule, same double-entry bookkeeping. Only cleared, unretained
// core weeks are reviewable; like reviseQuestion, dueness is not a precondition (reviewing early
// is allowed).
export const reviseCourseWeek = (weekId: string, passed: boolean): AppThunk => (
  dispatch,
  getState,
) => {
  const week = courseWeekById.get(weekId);
  if (!week || week.optional) return;

  const before = getState().course.byWeekId[weekId] ?? initialCourseProgress();
  if (!isWeekDone(week, before) || isWeekRetained(before)) return;

  const date = todayISO();
  // One grade per week per calendar day — mirrors reviseQuestion's gate for the same reason.
  if (before.lastReviewed === date) return;

  dispatch(courseRevisionLogged({ weekId, date, passed }));
  dispatch(xpAdded(COURSE_REVIEW_XP));
  dispatch(bonusXpLogged({ date, xp: COURSE_REVIEW_XP }));

  // Like every other mutation thunk: a review can extend the unified streak, so streak-shaped
  // achievements may unlock on this dispatch.
  evaluateAndUnlockAchievements(dispatch, getState, date);
};

export const saveCourseNotes = (weekId: string, notes: string): AppThunk => (dispatch) => {
  if (!courseWeekById.has(weekId)) return;
  dispatch(courseNotesSet({ weekId, notes }));
};

// --- Daily execution layer -------------------------------------------------------------

export const addTask = (input: {
  title: string;
  category: TaskCategory;
  estMinutes?: number | null;
  notes?: string;
}): AppThunk => (dispatch, getState) => {
  const title = input.title.trim();
  if (title === '') return;
  dispatch(
    taskAdded({
      id: nextTaskId(getState().tasks.byId),
      title,
      category: input.category,
      date: todayISO(),
      done: false,
      completedOn: null,
      estMinutes: input.estMinutes ?? null,
      notes: input.notes ?? '',
    }),
  );
};

export const toggleTask = (id: string): AppThunk => (dispatch) => {
  dispatch(taskToggled({ id, date: todayISO() }));
};

export const deleteTask = (id: string): AppThunk => (dispatch) => {
  dispatch(taskDeleted({ id }));
};

// "Not today" — pushes an open task to tomorrow's plan.
export const deferTaskToTomorrow = (id: string): AppThunk => (dispatch) => {
  dispatch(taskRescheduled({ id, date: addDays(todayISO(), 1) }));
};

// The day's time budget. A thunk rather than a raw `settingsUpdated` dispatch from the UI,
// because `settings` is not the `ui` slice and the mutation API is the one documented seam —
// and because the value is range-guarded in exactly one place instead of at each call site.
//
// The bounds live in engine/planner.ts because `validatePersisted` must agree with them and the
// two layers cannot import each other: a value this guard admits must survive a reload, or the
// learner's whole state is quarantined on next load.
export const setDailyCapacity = (minutes: number): AppThunk => (dispatch) => {
  if (!Number.isInteger(minutes) || minutes < CAPACITY_MIN || minutes > CAPACITY_MAX) return;
  dispatch(settingsUpdated({ dailyCapacityMin: minutes }));
};

/**
 * The Settings form's Save. Everything except the capacity goes straight through; the capacity
 * is delegated to `setDailyCapacity` so its range guard cannot be bypassed by editing the one
 * surface that writes several settings at once.
 */
export const updateSettings = (values: Partial<SettingsState>): AppThunk => (dispatch) => {
  const { dailyCapacityMin, ...rest } = values;
  if (Object.keys(rest).length > 0) dispatch(settingsUpdated(rest));
  if (dailyCapacityMin !== undefined) dispatch(setDailyCapacity(dailyCapacityMin));
};

// --- Revision sessions -----------------------------------------------------------------------
// The session slice holds a sitting in progress. Dates arrive from here, never from the reducer,
// which is the same rule every other slice follows.

export const startRevisionSession = (): AppThunk => (dispatch, getState) => {
  const today = todayISO();
  // The WHOLE plan is snapshotted here, not read live by the page — see SessionState.frozen.
  const session = selectRevisionSession(getState(), today);
  if (session.activities.length === 0) return;
  dispatch(sessionStarted({ date: today, session }));
};

/** `grade` records a gradable activity's outcome alongside the tick; it is final for the sitting. */
export const completeSessionActivity = (activityId: string, grade?: boolean): AppThunk => (dispatch) => {
  dispatch(activityCompleted({ activityId, grade }));
};

export const uncompleteSessionActivity = (activityId: string): AppThunk => (dispatch) => {
  dispatch(activityUncompleted({ activityId }));
};

// Finishing a session banks a sitting into the practice ledger — a finished session is a real
// sitting, however much of the plan got done. The sitting is the evidence sessionFollowThrough
// reads; it is never surfaced as a number to the learner (measurement stays internal, design
// record § 2). Guarded on completedOn === null so a stray second finish cannot double-book, and
// the payload is normalized here (the logDrillResult discipline: done can never exceed planned,
// or validatePersisted would quarantine the whole state on the next load).
export const finishRevisionSession = (): AppThunk => (dispatch, getState) => {
  const { frozen, doneIds, startedOn, completedOn } = getState().session;
  dispatch(sessionFinished({ date: todayISO() }));
  if (frozen && startedOn !== null && completedOn === null) {
    dispatch(
      sittingRecorded(normalizeSitting({ date: todayISO(), planned: frozen.activities.length, done: doneIds.length })),
    );
  }
};

// Clearing has two callers: "Stop here" mid-session, and "Plan another session" after a finish.
// A partial stop with real work done is still a sitting and is banked; a stop with nothing done
// is a non-attempt (not a follow-through failure) and writes nothing; and a clear after a finish
// is skipped by the completedOn guard so the finish's sitting is never double-booked.
export const clearRevisionSession = (): AppThunk => (dispatch, getState) => {
  const { frozen, doneIds, startedOn, completedOn } = getState().session;
  if (frozen && startedOn !== null && completedOn === null && doneIds.length > 0) {
    dispatch(
      sittingRecorded(normalizeSitting({ date: todayISO(), planned: frozen.activities.length, done: doneIds.length })),
    );
  }
  dispatch(sessionCleared());
};

// --- Practice layer: intentions + journal ----------------------------------------------------
// Authoring APIs for the positive-habit surface. Neither awards XP nor tracks completion — the
// work ledgers already track the practice itself; these record only what the learner chose to set
// (intentions) or noticed (a one-line journal entry). See docs/superpowers/specs/
// 2026-08-14-practice-engine-design.md § 4 for the binding copy rules the UI must follow.

// Replaces the whole intention list, normalized (≤3, non-blank cue, real action key) here rather
// than trusting the caller — same validator-parity guarantee as logDrillResult.
export const setIntentions = (inputs: { cue: string; action: string }[]): AppThunk => (dispatch) => {
  dispatch(intentionsSet(normalizeIntentions(inputs)));
};

// One journal line for today, last-write-wins. A blank line clears the entry (the reducer drops
// it), so retracting a reflection is honest rather than leaving an empty record behind.
export const writeJournal = (line: string): AppThunk => (dispatch) => {
  dispatch(journalWritten({ date: todayISO(), line: line.trim() }));
};

// --- Contests --------------------------------------------------------------------------------
// The clock lives here, not in the reducer: every timestamp arrives in a payload, so the slice
// stays a dumb writer and the tests stay deterministic.

export const startContest = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const contest = buildContest({
    all: questions,
    byId: state.progress.byId,
    // Seeded by the date so a reload rebuilds the same set rather than reshuffling it.
    seed: todayISO(),
  });
  if (contest.problems.length === 0) return;

  dispatch(
    contestStarted({
      seed: contest.id,
      questionIds: contest.problems.map((p) => p.question.id),
      targetMinutes: contest.problems.map((p) => p.targetMinutes),
      durationMin: contest.durationMin,
      nowMs: Date.now(),
    }),
  );
};

export const focusContestProblem = (questionId: number): AppThunk => (dispatch) => {
  dispatch(contestProblemFocused({ questionId, nowMs: Date.now() }));
};

export const blurContestProblem = (): AppThunk => (dispatch) => {
  dispatch(contestProblemBlurred({ nowMs: Date.now() }));
};

/**
 * Solving inside a contest is a real solve. It goes through the ordinary `solveQuestion` path so
 * XP, the day log, streaks and the revision ladder all see it exactly as they would any other —
 * a contest is a different way to practise, not a separate ledger.
 */
export const solveContestProblem = (questionId: number): AppThunk => (dispatch, getState) => {
  if (getState().contest.attempts[questionId]?.solved) return;
  dispatch(contestProblemSolved({ questionId, nowMs: Date.now() }));
  dispatch(solveQuestion(questionId));
};

/**
 * The single line that closes the contest→weakness loop. Finishing stamps the sitting, then the
 * engine's own reading of it (`selectContestAnalysis`, which runs `analyzeContest`) is banked as
 * a dated stall record in the persisted `contests` channel — the live contest slice itself never
 * persists, because a restored stopped clock lies. An inconclusive sitting writes nothing:
 * `analyzeContest` suppresses `patternGaps` to [] and that stays the single source of that
 * decision, here included.
 *
 * The normalization mirrors `logDrillResult`, for the same reason: `validatePersisted` hard-
 * rejects blank or duplicated pattern ids, non-positive counts, `attempted > total` and more
 * stalls than attempts — and a rejected payload quarantines the learner's ENTIRE state on the
 * next load. Today `analyzeContest` happens to guarantee all of that; that is a property of one
 * producer, not of this API, so the thunk guarantees a persistable payload itself.
 */
export const finishContest = (): AppThunk => (dispatch, getState) => {
  dispatch(contestFinished({ nowMs: Date.now() }));

  const analysis = selectContestAnalysis(getState());
  if (!analysis || analysis.patternGaps.length === 0) return;

  const safeTotal = Math.floor(analysis.total);
  if (!Number.isFinite(safeTotal) || safeTotal < 1) return;
  const stalledPatterns = Array.from(
    new Set(analysis.patternGaps.filter((p) => typeof p === 'string' && (p as string) !== '')),
  ).slice(0, safeTotal);
  if (stalledPatterns.length === 0) return;
  const informative = analysis.readings.filter((r) => r.outcome !== 'untouched').length;
  const attempted = Math.min(Math.max(Math.floor(informative) || 0, stalledPatterns.length), safeTotal);

  dispatch(
    contestStallsRecorded({ date: todayISO(), stalledPatterns, attempted, total: safeTotal }),
  );
};

export const clearContest = (): AppThunk => (dispatch) => {
  dispatch(contestCleared());
};

export const importProgress = (state: PersistedStateV1): AppThunk => (dispatch) => {
  dispatch(stateImported(state));
};

export const resetProgress = (): AppThunk => (dispatch) => {
  dispatch(progressReset());
};
