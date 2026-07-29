import type { PersistedStateV1 } from '@/types';
import type { RootState } from '@/store/store';

// Projects the persistable slices (progress, settings, gamification) out of RootState. `ui` is
// deliberately excluded — it holds only ephemeral session state (celebration, toast queue,
// search-open flag) that PersistedStateV1 has no room for and that should not survive a reload.
export function selectPersistedState(root: RootState): PersistedStateV1 {
  return {
    version: 1,
    progress: {
      byId: root.progress.byId,
      dayLogs: root.progress.dayLogs,
      startDate: root.progress.startDate,
    },
    settings: { ...root.settings },
    gamification: { ...root.gamification },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Structural validation only — this is the single source of truth for "is this safe to load as
// a PersistedStateV1". Both LocalStorageAdapter.load() and any future adapter must route their
// parsed/fetched data through here before handing it to the store.
export function validatePersisted(raw: unknown): PersistedStateV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== 1) return null;

  const progress = raw.progress;
  if (!isPlainObject(progress)) return null;
  if (!isPlainObject(progress.byId)) return null;
  if (!isPlainObject(progress.dayLogs)) return null;
  if (!('startDate' in progress) || (progress.startDate !== null && typeof progress.startDate !== 'string')) {
    return null;
  }

  const settings = raw.settings;
  if (!isPlainObject(settings)) return null;
  if (typeof settings.questionsPerDay !== 'number') return null;
  if (typeof settings.revisionEnabled !== 'boolean') return null;
  if (settings.theme !== 'dark' && settings.theme !== 'light') return null;
  if (typeof settings.notifications !== 'boolean') return null;

  const gamification = raw.gamification;
  if (!isPlainObject(gamification)) return null;
  if (typeof gamification.xp !== 'number') return null;
  if (!isPlainObject(gamification.unlocked)) return null;

  return raw as unknown as PersistedStateV1;
}

export function exportAsJson(root: RootState): string {
  return JSON.stringify(selectPersistedState(root), null, 2);
}
