import type { PatternId, ProblemFamily, Question } from '@/types';
import { hashSeed, mulberry32, seededShuffle } from '@/utils/engine/prng';

// Recognition drills: "which technique fits this problem?" asked BEFORE any reveal.
// Pure and deterministic — the same seed (a yyyy-MM-dd date) always builds the same drill,
// so a day's drill is stable across reloads without persisting anything.

export interface DrillItem {
  questionId: number;
  familyId: string;
  pattern: PatternId; // the correct answer
  options: PatternId[]; // 4 pattern ids, correct included, deterministic order
}

/**
 * Builds a drill of up to `count` items. One question is drawn per family first (round-robin
 * across shuffled families) so a single drill interleaves as many distinct ideas as possible —
 * discrimination between look-alike patterns is the point, not repetition of one.
 * Distractor options are other patterns that appear in `families`, so every option is a
 * technique the learner is actually studying.
 *
 * `missWeights` (misses per pattern from PAST days — callers must exclude today, or recording
 * today's attempt would reshuffle today's own drill) front-loads families of missed patterns:
 * the shuffle still varies day to day, but weak patterns are drawn first when count is tight.
 */
export function buildDrill(
  families: ProblemFamily[],
  questionById: ReadonlyMap<number, Question>,
  seed: string,
  count = 8,
  missWeights: Record<string, number> = {},
): DrillItem[] {
  if (families.length === 0) return [];
  const random = mulberry32(hashSeed(`drill:${seed}`));

  // Cross-pattern family members are excluded: the drill's "correct" option must agree with
  // the question's own pattern label, or a right answer would be graded wrong.
  // The sort is stable, so families with equal weight keep their shuffled order.
  const shuffledFamilies = seededShuffle(families, random)
    .sort((a, b) => (missWeights[b.pattern] ?? 0) - (missWeights[a.pattern] ?? 0))
    .map((f) => ({
      family: f,
      members: seededShuffle(
        f.members.filter((m) => questionById.get(m.questionId)?.pattern === f.pattern),
        random,
      ),
    }));

  const drillPatterns = [...new Set(families.map((f) => f.pattern))];

  const picks: { questionId: number; family: ProblemFamily }[] = [];
  // Round-robin: everyone's first member, then everyone's second, until count is met.
  for (let round = 0; picks.length < count; round++) {
    let added = false;
    for (const { family, members } of shuffledFamilies) {
      if (picks.length >= count) break;
      const member = members[round];
      if (!member) continue;
      picks.push({ questionId: member.questionId, family });
      added = true;
    }
    if (!added) break; // every family exhausted
  }

  return picks.map(({ questionId, family }) => {
    const distractors = seededShuffle(
      drillPatterns.filter((p) => p !== family.pattern),
      random,
    ).slice(0, 3);
    return {
      questionId,
      familyId: family.id,
      pattern: family.pattern,
      options: seededShuffle([family.pattern, ...distractors], random),
    };
  });
}
