import type { PersistedStateV1 } from '@/types';

// Pure seam between the store and wherever progress actually lives. `LocalStorageAdapter` is the
// only implementation today; a future Supabase-backed adapter would implement the same shape,
// wrapping its async I/O elsewhere (e.g. behind a cache that satisfies this sync contract, or a
// separate async adapter interface) rather than changing this one.
export interface StorageAdapter {
  load(): PersistedStateV1 | null;
  save(state: PersistedStateV1): void;
}
