import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { Middleware, ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import progressReducer from '@/store/slices/progressSlice';
import settingsReducer from '@/store/slices/settingsSlice';
import gamificationReducer from '@/store/slices/gamificationSlice';
import courseReducer from '@/store/slices/courseSlice';
import uiReducer from '@/store/slices/uiSlice';

const rootReducer = combineReducers({
  progress: progressReducer,
  settings: settingsReducer,
  gamification: gamificationReducer,
  course: courseReducer,
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
