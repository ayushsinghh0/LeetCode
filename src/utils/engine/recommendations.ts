import type { Question } from '@/types';
import { hashSeed, mulberry32 } from '@/utils/engine/prng';

// This module is now a single deterministic picker. Two larger things used to live here, and both
// were deleted rather than deprecated — the history matters because each is a mistake that would
// otherwise be made again.
//
// 1. `weakestPatterns(stats)` — a 0.4·passRate + 0.4·confidence + 0.2·coverage blend. It was the
//    product's second opinion about the same learner, and the two could disagree on screen at the
//    same time. Two properties made it actively wrong rather than merely redundant: it imputed
//    `passRate ?? 1` and `avgConfidence ?? 3`, so a pattern that had never been tested scored as
//    though it had been; and it counted low coverage as weakness, so a pattern the learner had
//    simply not reached yet — or had finished 100% of — could be named their weakest area.
//
// 2. `HeuristicRecommender` and the `Recommender` / `RecommendArgs` / `Recommendation` seam around
//    it. It had no call site outside its own test, but it still carried the sentence
//    `Your "${weakestPattern}" pattern is your weakest area` — a third weakness claim, sitting
//    dead in the tree waiting for someone to wire it up. The seam it was built as an extension
//    point for is obsolete: `engine/nextAction.ts` `rankWork()` is the one prioritizer now, and it
//    returns the whole day's work in one ordering rather than three capped category buckets.
//
// The rules those two deletions encode, both from CLAUDE.md:
//   - Weakness is claimed in exactly one place — `engine/weakness.ts`, reached through
//     `selectPatternWeakness` (recency decay, repeated evidence, no dominant signal,
//     unmeasured-is-absent).
//   - There is one prioritizer — `rankWork`. A hero and a plan that disagree is the failure that
//     design exists to prevent.

// ---------------------------------------------------------------------------
// seededRandomQuestion: deterministic "surprise me" picker.
// ---------------------------------------------------------------------------

export function seededRandomQuestion(all: Question[], seed: string): Question {
  const random = mulberry32(hashSeed(seed));
  const index = Math.floor(random() * all.length);
  return all[index]!;
}
