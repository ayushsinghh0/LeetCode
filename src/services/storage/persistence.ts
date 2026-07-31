import type { Middleware } from '@reduxjs/toolkit';
import type { StorageAdapter } from '@/services/storage/StorageAdapter';
import { selectPersistedState } from '@/services/storage/serialize';
import type { RootState } from '@/store/store';
import { progressReset, stateImported } from '@/store/sharedActions';

const DEFAULT_DEBOUNCE_MS = 500;

// After every dispatched action, debounce-saves the persistable slices to `adapter`. Rapid-fire
// dispatches (e.g. several thunks in the same tick) collapse into a single save once the
// debounce window elapses, rather than writing to storage on every action.
//
// `stateImported` and `progressReset` are the exception: they replace/clear progress wholesale,
// and a user who imports a backup or resets progress and then immediately refreshes must not
// lose that action to an un-flushed debounce timer. So those two actions cancel any pending
// debounced save and flush synchronously instead.
export function createPersistenceMiddleware(
  adapter: StorageAdapter,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): Middleware {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancelPending = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return (store) => (next) => (action) => {
    const result = next(action);

    if (stateImported.match(action) || progressReset.match(action)) {
      cancelPending();
      adapter.save(selectPersistedState(store.getState() as RootState));
      return result;
    }

    cancelPending();
    timer = setTimeout(() => {
      timer = undefined;
      adapter.save(selectPersistedState(store.getState() as RootState));
    }, debounceMs);

    return result;
  };
}

// Reads whatever the adapter has and maps it into the slice shapes `makeStore`'s
// `preloadedState` expects. `undefined` (rather than a partial/empty object) when there is
// nothing valid to load, so `makeStore` falls back to each slice's own initialState.
export function loadInitialState(adapter: StorageAdapter): Partial<RootState> | undefined {
  const persisted = adapter.load();
  if (persisted === null) return undefined;

  return {
    progress: {
      byId: persisted.progress.byId,
      dayLogs: persisted.progress.dayLogs,
      startDate: persisted.progress.startDate,
    },
    settings: persisted.settings,
    gamification: persisted.gamification,
    // Absent in pre-course payloads — omit the key so the slice's own initialState applies.
    ...(persisted.course ? { course: { byWeekId: persisted.course.byWeekId } } : {}),
  };
}
