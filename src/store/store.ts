import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { Middleware, ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import progressReducer from '@/store/slices/progressSlice';
import settingsReducer from '@/store/slices/settingsSlice';
import gamificationReducer from '@/store/slices/gamificationSlice';
import courseReducer from '@/store/slices/courseSlice';
import tasksReducer from '@/store/slices/tasksSlice';
import drillsReducer from '@/store/slices/drillsSlice';
import sessionReducer from '@/store/slices/sessionSlice';
import interviewReducer from '@/store/slices/interviewSlice';
import contestReducer from '@/store/slices/contestSlice';
import contestsReducer from '@/store/slices/contestsSlice';
import uiReducer from '@/store/slices/uiSlice';

const rootReducer = combineReducers({
  progress: progressReducer,
  settings: settingsReducer,
  gamification: gamificationReducer,
  course: courseReducer,
  tasks: tasksReducer,
  drills: drillsReducer,
  session: sessionReducer,
  interview: interviewReducer,
  // `contest` is the live sitting (never persisted); `contests` is the persisted stall history
  // a finished sitting leaves behind. Two slices because they answer different questions.
  contest: contestReducer,
  contests: contestsReducer,
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
