import type { PersistedStateV1 } from '@/types';
import type { StorageAdapter } from '@/services/storage/StorageAdapter';
import { validatePersisted } from '@/services/storage/serialize';

const STORAGE_KEY = 'dsa-roadmap:v1';
// Unreadable-but-present payloads are copied here before the app boots empty — without this,
// the first debounced save of the fresh session would overwrite the user's only copy of their
// data. Written once (never clobbered by a later failure) so the earliest, most valuable
// snapshot survives; recoverable by hand or a future "restore quarantined backup" flow.
export const QUARANTINE_KEY = 'dsa-roadmap:v1:quarantine';

// localStorage-backed StorageAdapter. Corrupt/foreign data must never crash boot: JSON.parse
// failures and structural-validation failures both collapse to `null`, and all localStorage
// access is wrapped in try/catch so quota-exceeded or security errors (e.g. storage disabled,
// private browsing) never throw out of load()/save().
export class LocalStorageAdapter implements StorageAdapter {
  load(): PersistedStateV1 | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;

      const parsed: unknown = JSON.parse(raw);
      const valid = validatePersisted(parsed);
      if (valid === null) this.quarantine(raw);
      return valid;
    } catch {
      if (raw !== null) this.quarantine(raw);
      return null;
    }
  }

  save(state: PersistedStateV1): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded / storage unavailable — persistence is best-effort, never fatal.
    }
  }

  private quarantine(raw: string): void {
    try {
      if (localStorage.getItem(QUARANTINE_KEY) === null) {
        localStorage.setItem(QUARANTINE_KEY, raw);
      }
      console.warn(
        `Stored progress could not be read (wrong version or corrupted). ` +
          `The original payload was preserved under "${QUARANTINE_KEY}".`,
      );
    } catch {
      // Same best-effort rule as save().
    }
  }
}
