import type { Middleware } from '@reduxjs/toolkit';
import type { StorageAdapter } from '@/services/storage/StorageAdapter';
import { selectPersistedState } from '@/services/storage/serialize';
import type { RootState } from '@/store/store';
import { progressReset, stateImported } from '@/store/sharedActions';
import { normalizeCourseWeekProgress } from '@/utils/engine/aimlCourse';
import { normalizeMlTrackProgress } from '@/utils/engine/mlTrack';
import { normalizeQuestionProgress } from '@/utils/engine/spacedRepetition';

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
  let lifecycleFlushRegistered = false;

  const cancelPending = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return (store) => {
    const saveNow = (): void => {
      cancelPending();
      adapter.save(selectPersistedState(store.getState() as RootState));
    };

    // A refresh/close inside the debounce window would silently drop the last mutation, so any
    // pending save flushes when the page is being hidden or unloaded. `pagehide` covers
    // navigation/close (including iOS Safari, which never fires unload); `visibilitychange` to
    // hidden covers tab switches, the last observable moment on mobile.
    if (!lifecycleFlushRegistered && typeof window !== 'undefined') {
      lifecycleFlushRegistered = true;
      const flushIfPending = (): void => {
        if (timer !== undefined) saveNow();
      };
      window.addEventListener('pagehide', flushIfPending);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushIfPending();
      });
    }

    return (next) => (action) => {
      const result = next(action);

      if (stateImported.match(action) || progressReset.match(action)) {
        saveNow();
        return result;
      }

      cancelPending();
      timer = setTimeout(() => {
        timer = undefined;
        adapter.save(selectPersistedState(store.getState() as RootState));
      }, debounceMs);

      return result;
    };
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
      byId: Object.fromEntries(
        Object.entries(persisted.progress.byId).map(([id, p]) => [id, normalizeQuestionProgress(p)]),
      ),
      dayLogs: persisted.progress.dayLogs,
      startDate: persisted.progress.startDate,
    },
    settings: {
      questionsPerDay: persisted.settings.questionsPerDay,
      revisionEnabled: persisted.settings.revisionEnabled,
      theme: persisted.settings.theme,
      notifications: persisted.settings.notifications,
      // Optional in older payloads — same boundary-normalization rule as the bonus gates.
      dailyCapacityMin: persisted.settings.dailyCapacityMin ?? 180,
    },
    gamification: {
      xp: persisted.gamification.xp,
      unlocked: persisted.gamification.unlocked,
      // Optional in older payloads — same boundary-normalization rule as progress entries.
      dailyGoalBonusDate: persisted.gamification.dailyGoalBonusDate ?? null,
      weeklyClearBonusDay: persisted.gamification.weeklyClearBonusDay ?? null,
    },
    // Absent in pre-course payloads — omit the key so the slice's own initialState applies.
    // Present entries are normalized so pre-ladder payloads gain the revision fields.
    ...(persisted.course
      ? {
          course: {
            byWeekId: Object.fromEntries(
              Object.entries(persisted.course.byWeekId).map(([weekId, progress]) => [
                weekId,
                normalizeCourseWeekProgress(progress),
              ]),
            ),
          },
        }
      : {}),
    // Absent in pre-daily-plan payloads — omit so the tasks slice's own initialState applies.
    ...(persisted.tasks ? { tasks: { byId: persisted.tasks.byId } } : {}),
    // Absent before recognition drills recorded results — same omit-and-default rule.
    ...(persisted.drills ? { drills: { byDate: persisted.drills.byDate } } : {}),
    // Absent before contest stalls were recorded — same omit-and-default rule. This preloads the
    // `contests` history slice only; the live `contest` sitting is never persisted or restored.
    ...(persisted.contests ? { contests: { byDate: persisted.contests.byDate } } : {}),
    // Absent before interview sittings were recorded — same omit-and-default rule. Preloads the
    // `interviews` history only; the live `interview` sitting is never persisted or restored.
    ...(persisted.interviews ? { interviews: { sittings: persisted.interviews.sittings } } : {}),
    // Absent before the ML tracks could be worked through — same omit-and-default rule, with the
    // per-entry normalization the course channel above also does.
    ...(persisted.ml
      ? {
          ml: {
            tracksById: Object.fromEntries(
              Object.entries(persisted.ml.tracksById).map(([trackId, progress]) => [
                trackId,
                normalizeMlTrackProgress(progress),
              ]),
            ),
            projectsById: persisted.ml.projectsById,
          },
        }
      : {}),
    // Absent before the V6 practice layer — same omit-and-default rule.
    ...(persisted.practice
      ? {
          practice: {
            intentions: persisted.practice.intentions,
            journal: persisted.practice.journal,
            sittings: persisted.practice.sittings,
          },
        }
      : {}),
  };
}
