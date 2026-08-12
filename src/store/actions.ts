// The public mutation API. UI code must dispatch these thunks — never raw slice actions —
// because cross-slice writes (progress + gamification + ui) only happen safely here.
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { Confidence, PersistedStateV1, Question, TaskCategory } from '@/types';
import type { AppThunk, RootState } from '@/store/store';
import { addDays, todayISO } from '@/utils/dates';
import { DAILY_GOAL_BONUS, SOLVE_XP, WEEKLY_CLEAR_BONUS, revisionXp } from '@/utils/engine/xp';
import { currentDay, isWeeklyRevisionDay } from '@/utils/engine/roadmap';
import { patternStats } from '@/utils/engine/stats';
import { evaluateAchievements } from '@/utils/engine/achievements';
import {
  bonusXpLogged,
  bookmarkToggled,
  confidenceSet,
  focusMinutesAdded,
  notesSet,
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
import { celebrationShown, toastPushed } from '@/store/slices/uiSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { selectAchievementCtx, selectRevisionQueueIds, selectSolvedNewCount } from '@/store/selectors';

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

// Records a completed focus phase. DayLog.focusMinutes is the canonical total time ledger;
// when the Focus screen has a question up (ui.focusQuestionId, maintained by FocusPage), the
// same minutes are ALSO attributed to that question's timeSpentMin — a breakdown of the total,
// not an addition to it, so analytics must never sum the two dimensions together.
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

export const importProgress = (state: PersistedStateV1): AppThunk => (dispatch) => {
  dispatch(stateImported(state));
};

export const resetProgress = (): AppThunk => (dispatch) => {
  dispatch(progressReset());
};
