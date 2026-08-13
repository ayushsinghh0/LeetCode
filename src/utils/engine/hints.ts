// The hint ladder.
//
// Deliberately DERIVED, never separately authored: every rung is drawn from the hand-verified
// problem-family content (`idea` / `signals` / `trap`) that already ships in families.json. That
// buys two things a second content corpus could not — the hints cannot drift out of agreement
// with the family page or the recognition drills, and there is no surface on which to invent
// plausible-sounding guidance for 539 problems.
//
// The escalation is pedagogical, not arbitrary: notice the cues -> name the technique -> hear the
// wrong turn. A learner who takes rung 1 has been nudged; a learner who takes rung 3 has been
// handed the shape of the answer, which is exactly why `hintLevelUsed` is worth recording.
import type { ProblemFamily } from '@/types';

export const MAX_HINT_LEVEL = 3;

export interface Hint {
  level: number; // 1..MAX_HINT_LEVEL
  label: string;
  /** Rendered as separate lines — rung 1 is a list of recognition cues, the rest are prose. */
  lines: string[];
}

/**
 * The ladder for one question, or `[]` when the question has no mapped family.
 *
 * An empty result is a real answer, not a failure: 101 of the 539 questions sit outside the
 * family map, and the UI says so plainly rather than padding the gap with generated filler.
 */
export function hintsFor(family: ProblemFamily | undefined): Hint[] {
  if (!family) return [];
  return [
    {
      level: 1,
      label: 'What to notice',
      lines: family.signals,
    },
    {
      level: 2,
      label: 'The technique',
      lines: [family.idea],
    },
    {
      level: 3,
      label: 'The trap',
      lines: [family.trap],
    },
  ];
}

export type HintUse = 'unaided' | 'nudged' | 'guided' | 'walked-through';

export function hintUse(hintLevelUsed: number | undefined): HintUse {
  const level = hintLevelUsed ?? 0;
  if (level <= 0) return 'unaided';
  if (level === 1) return 'nudged';
  if (level === 2) return 'guided';
  return 'walked-through';
}

export const HINT_USE_LABEL: Record<HintUse, string> = {
  unaided: 'Solved unaided',
  nudged: 'Took one nudge',
  guided: 'Took the technique hint',
  'walked-through': 'Took the full ladder',
};
