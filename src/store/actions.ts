// The public mutation API. UI code must dispatch these thunks — never raw slice actions —
// because cross-slice writes (progress + gamification + ui) only happen safely here.
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type { Confidence, PersistedStateV1, Question } from '@/types';
import type { AppThunk, RootState } from '@/store/store';
import { todayISO } from '@/utils/dates';
import { DAILY_GOAL_BONUS, SOLVE_XP, WEEKLY_CLEAR_BONUS, revisionXp } from '@/utils/engine/xp';
import { currentDay, isWeeklyRevisionDay } from '@/utils/engine/roadmap';
import { patternStats } from '@/utils/engine/stats';
import { buildAchievementCtx, evaluateAchievements } from '@/utils/engine/achievements';
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
} from '@/store/slices/progressSlice';
import { achievementsUnlocked, xpAdded } from '@/store/slices/gamificationSlice';
import { celebrationShown, toastPushed } from '@/store/slices/uiSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { selectRevisionQueueIds, selectSolvedNewCount } from '@/store/selectors';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

function evaluateAndUnlockAchievements(
  dispatch: ThunkDispatch<RootState, unknown, UnknownAction>,
  getState: () => RootState,
  today: string,
): void {
  const state = getState();
  const ctx = buildAchievementCtx(questions, state.progress.byId, state.progress.dayLogs, today);
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

export const logFocusSession = (minutes: number): AppThunk => (dispatch) => {
  const date = todayISO();
  dispatch(focusMinutesAdded({ date, minutes }));
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

    let celebration: 'confetti' | 'fireworks' | null = null;
    if (solvedTodayCount === perDay) {
      dispatch(xpAdded(DAILY_GOAL_BONUS));
      dispatch(bonusXpLogged({ date, xp: DAILY_GOAL_BONUS })); // keep dayLog.xpEarned in sync with gamification.xp
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

  const date = todayISO();
  const xp = revisionXp(question.difficulty);

  const stateBefore = getState();
  const perDay = stateBefore.settings.questionsPerDay;
  const day = currentDay(selectSolvedNewCount(stateBefore), perDay, questions.length);
  const queueBefore = selectRevisionQueueIds(stateBefore, date).length;

  dispatch(revisionLogged({ id, date, passed, xp }));
  dispatch(xpAdded(xp)); // every revision attempt earns xp, pass or fail

  const queueAfter = selectRevisionQueueIds(getState(), date).length;
  if (isWeeklyRevisionDay(day) && queueBefore > 0 && queueAfter === 0) {
    dispatch(xpAdded(WEEKLY_CLEAR_BONUS));
    dispatch(bonusXpLogged({ date, xp: WEEKLY_CLEAR_BONUS })); // keep dayLog.xpEarned in sync with gamification.xp
  }

  evaluateAndUnlockAchievements(dispatch, getState, date);
};

export const importProgress = (state: PersistedStateV1): AppThunk => (dispatch) => {
  dispatch(stateImported(state));
};

export const resetProgress = (): AppThunk => (dispatch) => {
  dispatch(progressReset());
};
