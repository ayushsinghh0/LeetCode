import type { PersistedStateV1 } from '@/types';
import type { StorageAdapter } from '@/services/storage/StorageAdapter';
import { validatePersisted } from '@/services/storage/serialize';

const STORAGE_KEY = 'dsa-roadmap:v1';

// localStorage-backed StorageAdapter. Corrupt/foreign data must never crash boot: JSON.parse
// failures and structural-validation failures both collapse to `null`, and all localStorage
// access is wrapped in try/catch so quota-exceeded or security errors (e.g. storage disabled,
// private browsing) never throw out of load()/save().
export class LocalStorageAdapter implements StorageAdapter {
  load(): PersistedStateV1 | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;

      const parsed: unknown = JSON.parse(raw);
      return validatePersisted(parsed);
    } catch {
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
}
