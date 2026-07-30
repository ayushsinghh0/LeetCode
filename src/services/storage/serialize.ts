import type { Confidence, DayLog, PersistedStateV1, QuestionProgress, QuestionStatus, RevisionEvent } from '@/types';
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isQuestionStatus(value: unknown): value is QuestionStatus {
  return value === 'unsolved' || value === 'in_progress' || value === 'solved' || value === 'skipped';
}

function isConfidence(value: unknown): value is Confidence | null {
  return value === null || (typeof value === 'number' && [1, 2, 3, 4, 5].includes(value));
}

function isRevisionEventArray(value: unknown): value is RevisionEvent[] {
  return (
    Array.isArray(value) &&
    value.every((ev) => isPlainObject(ev) && typeof ev.date === 'string' && typeof ev.passed === 'boolean')
  );
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

// Per-entry shape check for progress.byId[id] — every field of QuestionProgress, not just "is it
// an object". A backup file that survives JSON.parse but has e.g. a string revisionStage or a
// non-array revisionHistory must still be rejected wholesale rather than handed to the store,
// where untyped/malformed data would silently corrupt selectors and engine math downstream.
function isValidProgressEntry(value: unknown): value is QuestionProgress {
  if (!isPlainObject(value)) return false;
  return (
    isQuestionStatus(value.status) &&
    typeof value.revisionStage === 'number' &&
    isNullableString(value.nextRevision) &&
    isNullableString(value.lastReviewed) &&
    isRevisionEventArray(value.revisionHistory) &&
    typeof value.notes === 'string' &&
    typeof value.bookmarked === 'boolean' &&
    isNullableString(value.completedAt) &&
    isConfidence(value.confidence) &&
    typeof value.timeSpentMin === 'number'
  );
}

// Per-entry shape check for progress.dayLogs[date] — in particular that solvedIds/revisionsPassed/
// revisionsFailed are actually arrays of numbers, not just "present".
function isValidDayLogEntry(value: unknown): value is DayLog {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.date === 'string' &&
    isNumberArray(value.solvedIds) &&
    isNumberArray(value.revisionsPassed) &&
    isNumberArray(value.revisionsFailed) &&
    typeof value.xpEarned === 'number' &&
    typeof value.focusMinutes === 'number'
  );
}

// Structural validation only — this is the single source of truth for "is this safe to load as
// a PersistedStateV1". Both LocalStorageAdapter.load() and any future adapter (including the
// Settings page's import-from-file flow, where genuinely untrusted JSON reaches this function)
// must route their parsed/fetched data through here before handing it to the store. Validation
// goes one level deeper than top-level key presence: every entry inside progress.byId and
// progress.dayLogs is checked against its full expected shape, so a malformed-but-version-1 file
// (wrong-typed fields, missing arrays, etc.) is rejected wholesale rather than partially accepted.
export function validatePersisted(raw: unknown): PersistedStateV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== 1) return null;

  const progress = raw.progress;
  if (!isPlainObject(progress)) return null;
  if (!isPlainObject(progress.byId)) return null;
  if (!Object.values(progress.byId).every(isValidProgressEntry)) return null;
  if (!isPlainObject(progress.dayLogs)) return null;
  if (!Object.values(progress.dayLogs).every(isValidDayLogEntry)) return null;
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
  if (!Object.values(gamification.unlocked).every((v) => typeof v === 'string')) return null;

  return raw as unknown as PersistedStateV1;
}

export function exportAsJson(root: RootState): string {
  return JSON.stringify(selectPersistedState(root), null, 2);
}
