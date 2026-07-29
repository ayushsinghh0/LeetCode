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
 * Pool = questions that are solved AND not mastered AND not already in `due` (excluded by id).
 * The `today` parameter (named `_today` to satisfy noUnusedParameters) is accepted for API
 * symmetry with the rest of the engine but is not otherwise used: `due` is supplied
 * pre-computed by the caller, so no additional date-based filtering happens here.
 *
 * Ranking (weakest/most-in-need-of-review first): confidence ascending (null treated as 2.5)
 * -> fail count (revisionHistory entries with passed:false) descending -> lastReviewed
 * ascending (null falls back to completedAt) -> id ascending.
 */
export function weeklyTopUp(
  all: Question[],
  byId: Record<number, QuestionProgress>,
  due: number[],
  _today: string,
  min = 15,
  max = 20,
): number[] {
  const dueSet = new Set(due);

  const pool = all
    .filter((q) => {
      const p = byId[q.id];
      return !!p && p.status === 'solved' && !isMastered(p) && !dueSet.has(q.id);
    })
    .map((q) => q.id);

  const extrasWanted = due.length >= min ? 0 : min - due.length;
  const extrasCap = Math.max(0, max - due.length);
  const target = Math.max(0, Math.min(extrasWanted, extrasCap));

  if (target === 0 || pool.length === 0) return [];

  const failCount = (p: QuestionProgress): number =>
    p.revisionHistory.filter((e) => !e.passed).length;

  const ranked = [...pool].sort((idA, idB) => {
    const a = byId[idA];
    const b = byId[idB];

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
