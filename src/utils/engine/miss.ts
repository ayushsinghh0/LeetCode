// The miss taxonomy — what kind of thing went wrong, in the product's own evidence vocabulary.
//
// Four kinds, one tap each, optional always (an untagged fail carries exactly the evidence it
// always did — uncertainty is allowed). Each kind maps to an intervention the product actually
// has: recognition misses are what the drills train, implementation and edge-case misses are what
// the session's deep re-implement treatment repairs, and a recall miss is the ladder doing its
// ordinary job. This is deliberately not a diagnostic questionnaire — a taxonomy the learner
// cannot apply in one honest tap would collect noise and wear the costume of precision.
//
// Persistence is looser than this registry on purpose: `RevisionEvent.missKind` is validated as
// a bare string, so removing or renaming a kind here can never quarantine an old payload
// (validator-parity rule). The UI resolves through `missKindLabel` and skips what it cannot name.

export interface MissKindEntry {
  kind: string;
  /** The tag the learner taps — a description of the miss, never a verdict on the learner. */
  label: string;
}

export const MISS_KINDS: MissKindEntry[] = [
  { kind: 'recognition', label: "Didn't see the pattern" },
  { kind: 'implementation', label: 'Knew the idea — code broke' },
  { kind: 'edge-case', label: 'Missed an edge case' },
  { kind: 'recall', label: "Couldn't recall the approach" },
];

const KINDS = new Set(MISS_KINDS.map((k) => k.kind));

export function isMissKind(value: string): boolean {
  return KINDS.has(value);
}

/** The label for a kind, or null for a string this build does not know (skip, don't crash). */
export function missKindLabel(kind: string): string | null {
  return MISS_KINDS.find((k) => k.kind === kind)?.label ?? null;
}
