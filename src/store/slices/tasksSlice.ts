import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { DailyTask, PersistedStateV1, TasksState } from '@/types';
import { progressReset, stateImported } from '@/store/sharedActions';

const initialState: TasksState = {
  byId: {},
};

// Reducers are dumb writers, same contract as every other slice: dates and ids arrive in the
// payload (thunks in store/actions.ts supply todayISO() and the next id), never computed here.
const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    taskAdded(state, action: PayloadAction<DailyTask>) {
      state.byId[action.payload.id] = action.payload;
    },
    taskToggled(state, action: PayloadAction<{ id: string; date: string }>) {
      const task = state.byId[action.payload.id];
      if (!task) return;
      task.done = !task.done;
      task.completedOn = task.done ? action.payload.date : null;
    },
    taskDeleted(state, action: PayloadAction<{ id: string }>) {
      delete state.byId[action.payload.id];
    },
    // Moves an open task to another day (the "not today" action). Completed tasks stay where
    // they were completed — they are history, not workload.
    taskRescheduled(state, action: PayloadAction<{ id: string; date: string }>) {
      const task = state.byId[action.payload.id];
      if (!task || task.done) return;
      task.date = action.payload.date;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(stateImported, (_state, action: PayloadAction<PersistedStateV1>) => ({
      byId: { ...(action.payload.tasks?.byId ?? {}) },
    }));
    builder.addCase(progressReset, () => initialState);
  },
});

export const { taskAdded, taskToggled, taskDeleted, taskRescheduled } = tasksSlice.actions;

export default tasksSlice.reducer;

// --- Selectors (kept beside the slice; store/selectors.ts stays the engine-wrapper surface) ---

const selectTasksById = (state: { tasks: TasksState }): Record<string, DailyTask> => state.tasks.byId;
const selectDateArg = (_state: { tasks: TasksState }, date: string): string => date;

// A day's tasks: open ones first, each group in creation (id) order — stable enough that
// completing a task doesn't shuffle the list out from under the pointer.
export const selectTasksForDate = createSelector(
  [selectTasksById, selectDateArg],
  (byId, date): DailyTask[] =>
    Object.values(byId)
      .filter((t) => t.date === date)
      .sort((a, b) => (a.done === b.done ? a.id.localeCompare(b.id, 'en', { numeric: true }) : a.done ? 1 : -1)),
);

// Next task id: "t<N>" with N above every existing suffix — derived from state, not the clock,
// so ids stay deterministic under test and collision-free after import.
export function nextTaskId(byId: Record<string, DailyTask>): string {
  let max = 0;
  for (const id of Object.keys(byId)) {
    const n = Number(id.slice(1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `t${max + 1}`;
}
