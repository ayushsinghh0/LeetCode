// Mastery states — the distinction between "I solved this once" and "I own this".
//
// This module adds NO new persisted truth and changes NO product rule: the 1/3/7/15/30 ladder in
// spacedRepetition.ts remains the single scheduler, and `isMastered` (stage 5) remains what the
// scheduler means by mastered. What lives here is the *reading* of that state for a human — six
// named steps instead of the binary the UI used to show, so a learner can see that a question
// they solved yesterday and a question that survived a 30-day gap are not the same achievement.
import type { QuestionProgress } from '@/types';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';
import { hintUse } from '@/utils/engine/hints';

export type MasteryState =
  | 'unseen'     // never opened
  | 'attempted'  // started, not yet solved
  | 'skipped'    // deliberately set aside
  | 'solved'     // solved, no review has landed yet
  | 'reviewing'  // at least one review attempted, still inside the short intervals
  | 'retained'   // cleared the 7- and 15-day gaps
  | 'mastered';  // cleared the whole ladder — stage 5, off the schedule

/** The stage at which the intervals stop being short enough to coast on working memory. */
export const RETAINED_STAGE = 3;

export function masteryState(p: QuestionProgress): MasteryState {
  if (p.status === 'skipped') return 'skipped';
  if (p.status === 'in_progress') return 'attempted';
  if (p.status !== 'solved') return 'unseen';
  if (p.revisionStage >= MASTERED_STAGE) return 'mastered';
  if (p.revisionStage >= RETAINED_STAGE) return 'retained';
  if (p.revisionHistory.length > 0) return 'reviewing';
  return 'solved';
}

export const MASTERY_LABEL: Record<MasteryState, string> = {
  unseen: 'Not started',
  attempted: 'In progress',
  skipped: 'Skipped',
  solved: 'Solved',
  reviewing: 'Reviewing',
  retained: 'Retained',
  mastered: 'Mastered',
};

/** What the state actually means, in the learner's terms. Shown on hover/expand, not shouted. */
export const MASTERY_MEANING: Record<MasteryState, string> = {
  unseen: 'You have not opened this one yet.',
  attempted: 'You started this and have not marked it solved.',
  skipped: 'You set this aside — it stays out of your daily plan until you unskip it.',
  solved: 'Solved once. Nothing has tested whether it stuck yet.',
  reviewing: 'You have re-derived this at least once, inside the short intervals.',
  retained: 'You re-derived this after a week and after a fortnight — it is holding.',
  mastered: 'Recalled across the full ladder up to a 30-day gap. It is off the schedule.',
};

export const MASTERY_ORDER: MasteryState[] = [
  'unseen', 'attempted', 'skipped', 'solved', 'reviewing', 'retained', 'mastered',
];

/**
 * Mastery quality: mastered *and* it did not take the hint ladder to get there.
 *
 * Kept separate from `masteryState` on purpose. Folding hint use into the state itself would
 * mean a learner who took a hint could never reach the top label no matter how many 30-day
 * recalls they passed — which would turn an honest support feature into a penalty and teach
 * people to avoid the hints. Instead the two facts are reported side by side.
 */
export function isUnaidedMastery(p: QuestionProgress): boolean {
  return masteryState(p) === 'mastered' && hintUse(p.hintLevelUsed) === 'unaided';
}
