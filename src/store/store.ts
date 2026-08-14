import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { Middleware, ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import progressReducer from '@/store/slices/progressSlice';
import settingsReducer from '@/store/slices/settingsSlice';
import gamificationReducer from '@/store/slices/gamificationSlice';
import courseReducer from '@/store/slices/courseSlice';
import mlReducer from '@/store/slices/mlSlice';
import tasksReducer from '@/store/slices/tasksSlice';
import drillsReducer from '@/store/slices/drillsSlice';
import sessionReducer from '@/store/slices/sessionSlice';
import interviewReducer from '@/store/slices/interviewSlice';
import interviewsReducer from '@/store/slices/interviewsSlice';
import contestReducer from '@/store/slices/contestSlice';
import contestsReducer from '@/store/slices/contestsSlice';
import practiceReducer from '@/store/slices/practiceSlice';
import uiReducer from '@/store/slices/uiSlice';

const rootReducer = combineReducers({
  progress: progressReducer,
  settings: settingsReducer,
  gamification: gamificationReducer,
  course: courseReducer,
  // The ML implementation tracks and projects — a separate id space from `course`, and a track's
  // weekId is frequently null, so they are deliberately not the same slice.
  ml: mlReducer,
  tasks: tasksReducer,
  drills: drillsReducer,
  session: sessionReducer,
  // Same two-slice split as contest/contests below, for the same reason: `interview` is the live
  // sitting (never persisted), `interviews` the derived record it leaves behind.
  interview: interviewReducer,
  interviews: interviewsReducer,
  // `contest` is the live sitting (never persisted); `contests` is the persisted stall history
  // a finished sitting leaves behind. Two slices because they answer different questions.
  contest: contestReducer,
  contests: contestsReducer,
  // The V6 practice layer: authored intentions, the reflection journal, and the sitting ledger.
  practice: practiceReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppThunk = ThunkAction<void, RootState, unknown, UnknownAction>;

export function makeStore(preloaded?: Partial<RootState>, extraMiddleware: Middleware[] = []) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloaded,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(extraMiddleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
