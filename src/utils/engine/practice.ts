// The practice layer's pure core — constants, the app-action registry, and the two normalizers
// its thunks lean on. Pure and deterministic like every engine module: no clock, no store.
//
// This is the data half of the positive-habit surface (design record § 3, features B + E). It
// deliberately holds no scoring: intentions are suggestions the learner chose, not habits the app
// grades, and the sitting ledger is measurement kept internal (the reflective surface never shows
// a number). See docs/superpowers/specs/2026-08-14-practice-engine-design.md § 4 for the binding
// copy rules the surfaces that consume this must follow.
import type { PracticeIntention, PracticeSitting } from '@/types';

/** At most three authored intentions — "better to consistently track one habit than ten". */
export const MAX_INTENTIONS = 3;

/** The sitting ledger keeps only the most recent window; older sittings age out. */
export const SITTINGS_CAP = 60;

/**
 * A real thing the learner can commit to in an intention, resolved to a label and a deep link.
 *
 * The label is the second half of the sentence "After [cue], I will [label]", so it reads as an
 * imperative phrase, not a UI noun. Every href is a real route the app already serves — an
 * intention is a door into the work, so it must open onto the work. This is the single source
 * both the Settings authoring dropdown and the Today rail resolve against.
 */
export interface PracticeAction {
  key: string;
  label: string;
  href: string;
}

export const PRACTICE_ACTIONS: PracticeAction[] = [
  { key: 'today', label: "open today's next problem", href: '/today' },
  { key: 'small', label: 'begin with a two-minute start', href: '/focus?entry=small' },
  { key: 'focus', label: 'sit with one problem in focus', href: '/focus' },
  { key: 'revision', label: 'run a revision session', href: '/revision' },
  { key: 'drill', label: 'do one recognition drill', href: '/drills' },
  { key: 'aiml', label: 'study one AI/ML session', href: '/aiml' },
];

const ACTION_KEYS = new Set(PRACTICE_ACTIONS.map((a) => a.key));

/** Whether `key` names a real app action. A stale key (an action later removed) is not one. */
export function isPracticeAction(key: string): boolean {
  return ACTION_KEYS.has(key);
}

/** The registry entry for a key, or undefined — so the Today rail can skip an unknown action. */
export function practiceActionByKey(key: string): PracticeAction | undefined {
  return PRACTICE_ACTIONS.find((a) => a.key === key);
}

/**
 * Normalize authored intentions to a persistable list: trimmed non-blank cue, a real action key,
 * capped at MAX_INTENTIONS, order preserved. The Settings form only offers registry actions, so
 * this is belt-and-suspenders — but the thunk normalizes its own payload rather than trusting the
 * caller, the same discipline logDrillResult follows, because a value the UI can write that the
 * validator would reject quarantines the learner's entire state on the next load.
 */
export function normalizeIntentions(inputs: { cue: string; action: string }[]): PracticeIntention[] {
  const out: PracticeIntention[] = [];
  for (const raw of inputs) {
    const cue = (raw?.cue ?? '').trim();
    if (cue === '') continue;
    if (typeof raw.action !== 'string' || !ACTION_KEYS.has(raw.action)) continue;
    out.push({ cue, action: raw.action });
    if (out.length >= MAX_INTENTIONS) break;
  }
  return out;
}

// The drill is a measurement and the reflect is optional — neither is a commitment the learner
// made to revision work, so neither may count toward follow-through in either direction.
const ADJUNCT_KINDS = new Set<string>(['drill', 'reflect']);

/**
 * Count a frozen session's committed work: `planned` committed activities, and `done` among them.
 *
 * A learner who graded every review but skipped the optional reflect finished their session;
 * counting adjuncts would read that finish as a shortfall, which is exactly the guilt-shaped
 * arithmetic sessionFollowThrough bans (copy rule 5). Symmetrically, ticking only the drill is a
 * measurement taken, not revision done — it must not bank a sitting.
 */
export function sittingCounts(
  activities: { id: string; kind: string }[],
  doneIds: string[],
): { planned: number; done: number } {
  const committed = activities.filter((a) => !ADJUNCT_KINDS.has(a.kind));
  const done = new Set(doneIds);
  return { planned: committed.length, done: committed.filter((a) => done.has(a.id)).length };
}

/**
 * Clamp a sitting to a persistable shape: non-negative integer `planned`, and `done` floored into
 * [0, planned] — you cannot complete more activities than were planned, and the validator rejects
 * a record that claims you did.
 */
export function normalizeSitting(input: { date: string; planned: number; done: number }): PracticeSitting {
  const planned = Math.max(0, Math.floor(input.planned) || 0);
  const done = Math.min(Math.max(Math.floor(input.done) || 0, 0), planned);
  return { date: input.date, planned, done };
}
