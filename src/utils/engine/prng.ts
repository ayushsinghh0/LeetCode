// Deterministic PRNG primitives shared by the engine's seeded pickers (recommendations'
// "surprise me", recognition drills). Not for anything security-sensitive.

// Cheap FNV-1a-style string hash: folds `seed` into a deterministic 32-bit fingerprint.
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast, deterministic PRNG seeded by a 32-bit integer.
// Public-domain algorithm (see https://github.com/bryc/code/blob/master/jshash/PRNGs.md).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates over a copy, driven by a supplied PRNG so results are reproducible.
export function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
