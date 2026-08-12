import type { Question, QuestionProgress } from '@/types';
import { isMastered } from '@/utils/engine/spacedRepetition';

/**
 * Tops up today's revision queue so the total (due + extras) reaches at least `min` when the
 * pool allows, and never exceeds `max` via the extras added here.
 *
 * Governing rule (extras count):
 *  - `due.length >= min` -> 0 extras (already at/above the floor; we do not pad further just
 *    to approach `max` — e.g. due.length=17 with min=15,max=20 still yields 0 extras).
 *  - otherwise -> `extras = min(min - due.length, max - due.length)`, additionally capped by
 *    how many eligible candidates actually exist in the pool.
 *
 * Pool = questions that are solved AND not mastered AND not already in `due` (excluded by id)
 * AND not already reviewed today (`lastReviewed !== today`) AND not solved today
 * (`completedAt !== today`). The `lastReviewed` exclusion alone gives the queue a terminal state
 * *within* a single pass through today's already-solved roster: without it, a top-up item that
 * was just passed or failed (either way `applyRevision` stamps `lastReviewed = today`) would
 * immediately re-qualify for the pool and could be re-selected as an extra the very next time
 * this is recomputed. But `applySolve` never touches `lastReviewed` — a question solved just now
 * has `lastReviewed = null`, which trivially satisfies `!== today`, so without the `completedAt`
 * exclusion a freshly-solved question would immediately re-enter an already-drained pool (its
 * first revision is due tomorrow by design; same-day top-up revision of a question with zero
 * revision history was never intended, and let WEEKLY_CLEAR_BONUS re-fire after a solve reopened
 * a queue that had already hit zero). With both exclusions in place, nothing can add to `due` or
 * the pool once today's already-solved roster is fixed at the start of the day (new solves are
 * excluded; already-attempted pool items are excluded), so the pool only shrinks over the course
 * of a day and the top-up (and therefore the full queue) reaches zero and stays there.
 *
 * Ranking (weakest/most-in-need-of-review first): confidence ascending (null treated as 2.5)
 * -> fail count (revisionHistory entries with passed:false) descending -> lastReviewed
 * ascending (null falls back to completedAt) -> id ascending.
 */
export function weeklyTopUp(
  all: Question[],
  byId: Record<number, QuestionProgress>,
  due: number[],
  today: string,
  min = 15,
  max = 20,
): number[] {
  const dueSet = new Set(due);

  const pool = all
    .filter((q) => {
      const p = byId[q.id];
      return (
        !!p &&
        p.status === 'solved' &&
        !isMastered(p) &&
        !dueSet.has(q.id) &&
        p.lastReviewed !== today &&
        p.completedAt !== today
      );
    })
    .map((q) => q.id);

  const extrasWanted = due.length >= min ? 0 : min - due.length;
  const extrasCap = Math.max(0, max - due.length);
  const target = Math.max(0, Math.min(extrasWanted, extrasCap));

  if (target === 0 || pool.length === 0) return [];

  const failCount = (p: QuestionProgress): number =>
    p.revisionHistory.filter((e) => !e.passed).length;

  const ranked = [...pool].sort((idA, idB) => {
    const a = byId[idA]!; // pool ids were filtered on byId presence above
    const b = byId[idB]!;

    const confA = a.confidence ?? 2.5;
    const confB = b.confidence ?? 2.5;
    if (confA !== confB) return confA - confB;

    const failA = failCount(a);
    const failB = failCount(b);
    if (failA !== failB) return failB - failA;

    const lastA = a.lastReviewed ?? a.completedAt ?? '';
    const lastB = b.lastReviewed ?? b.completedAt ?? '';
    if (lastA !== lastB) return lastA < lastB ? -1 : 1;

    return idA - idB;
  });

  return ranked.slice(0, target);
}
