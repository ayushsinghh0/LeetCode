import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Confidence, DayLog, PersistedStateV1, QuestionProgress } from '@/types';
import {
  applyRevision,
  applySolve,
  initialProgress,
  normalizeQuestionProgress,
} from '@/utils/engine/spacedRepetition';
import { progressReset, stateImported } from '@/store/sharedActions';

export interface ProgressState {
  byId: Record<number, QuestionProgress>;
  dayLogs: Record<string, DayLog>;
  startDate: string | null;
}

const initialState: ProgressState = {
  byId: {},
  dayLogs: {},
  startDate: null,
};

function ensureDayLog(state: ProgressState, date: string): DayLog {
  if (!state.dayLogs[date]) {
    state.dayLogs[date] = {
      date,
      solvedIds: [],
      revisionsPassed: [],
      revisionsFailed: [],
      xpEarned: 0,
      focusMinutes: 0,
    };
  }
  return state.dayLogs[date];
}

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    questionStarted(state, action: PayloadAction<{ id: number }>) {
      const { id } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = prev.status === 'unsolved' ? { ...prev, status: 'in_progress' } : prev;
    },

    // ensures dayLogs[date], pushes id into solvedIds idempotently (skip if already present —
    // and does NOT double-add xp in that case), adds xp to dayLog.xpEarned, sets startDate if null.
    questionSolved(state, action: PayloadAction<{ id: number; date: string; xp: number }>) {
      const { id, date, xp } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = applySolve(prev, date);

      const log = ensureDayLog(state, date);
      if (!log.solvedIds.includes(id)) {
        log.solvedIds.push(id);
        log.xpEarned += xp;
      }

      if (state.startDate === null) {
        state.startDate = date;
      }
    },

    questionSkipped(state, action: PayloadAction<{ id: number }>) {
      const { id } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      if (prev.status !== 'solved') {
        state.byId[id] = { ...prev, status: 'skipped' };
      }
    },

    bookmarkToggled(state, action: PayloadAction<{ id: number }>) {
      const { id } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = { ...prev, bookmarked: !prev.bookmarked };
    },

    notesSet(state, action: PayloadAction<{ id: number; notes: string }>) {
      const { id, notes } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = { ...prev, notes };
    },

    confidenceSet(state, action: PayloadAction<{ id: number; confidence: Confidence }>) {
      const { id, confidence } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = { ...prev, confidence };
    },

    revisionLogged(
      state,
      action: PayloadAction<{ id: number; date: string; passed: boolean; xp: number }>,
    ) {
      const { id, date, passed, xp } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = applyRevision(prev, date, passed);

      const log = ensureDayLog(state, date);
      if (passed) {
        log.revisionsPassed.push(id);
      } else {
        log.revisionsFailed.push(id);
      }
      log.xpEarned += xp;
    },

    focusMinutesAdded(state, action: PayloadAction<{ date: string; minutes: number }>) {
      const { date, minutes } = action.payload;
      const log = ensureDayLog(state, date);
      log.focusMinutes += minutes;
    },

    // Credits a gamification-only bonus (DAILY_GOAL_BONUS, WEEKLY_CLEAR_BONUS) into that day's
    // log too, so Σ dayLogs[*].xpEarned stays in sync with gamification.xp — dispatched by
    // actions.ts right next to the xpAdded(bonus) call that awards it.
    bonusXpLogged(state, action: PayloadAction<{ date: string; xp: number }>) {
      const { date, xp } = action.payload;
      const log = ensureDayLog(state, date);
      log.xpEarned += xp;
    },

    timeSpentAdded(state, action: PayloadAction<{ id: number; minutes: number }>) {
      const { id, minutes } = action.payload;
      const prev = state.byId[id] ?? initialProgress();
      state.byId[id] = { ...prev, timeSpentMin: prev.timeSpentMin + minutes };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (state, action: PayloadAction<PersistedStateV1>) => {
      // Normalized at the boundary (mirrors courseSlice running normalizeCourseWeekProgress)
      // so a future optional QuestionProgress field defaults in instead of arriving undefined.
      state.byId = Object.fromEntries(
        Object.entries(action.payload.progress.byId).map(([id, p]) => [id, normalizeQuestionProgress(p)]),
      );
      state.dayLogs = action.payload.progress.dayLogs;
      state.startDate = action.payload.progress.startDate;
    });
    builder.addCase(progressReset, (state) => {
      state.byId = {};
      state.dayLogs = {};
      state.startDate = null;
    });
  },
});

export const {
  questionStarted,
  questionSolved,
  questionSkipped,
  bookmarkToggled,
  notesSet,
  confidenceSet,
  revisionLogged,
  focusMinutesAdded,
  timeSpentAdded,
  bonusXpLogged,
} = progressSlice.actions;

export default progressSlice.reducer;
