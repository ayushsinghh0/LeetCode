import type { PatternId, Question, QuestionProgress } from '@/types';
import type { PatternStat } from '@/utils/engine/stats';

export interface WeakPattern {
  pattern: PatternId;
  score: number; // lower = weaker
}

const MAX_WEAK_PATTERN_QUESTIONS = 3;

/**
 * Eligibility note: `PatternStat` does not expose a raw "revision attempts" count — only
 * `revisionPassRate`, which is `null` iff zero revision attempts have ever been recorded for
 * the pattern. An attempts total therefore cannot be reconstructed from `PatternStat` alone,
 * so `minAttempts` is reinterpreted as a threshold on `solved` count (a proxy for "enough
 * solves to trust the score"): a pattern qualifies when `solved >= minAttempts`, OR it has at
 * least one recorded revision attempt (`revisionPassRate !== null`).
 */
export function weakestPatterns(stats: PatternStat[], minAttempts = 3): WeakPattern[] {
  return stats
    .filter((s) => s.solved >= minAttempts || s.revisionPassRate !== null)
    .map((s) => ({
      pattern: s.pattern,
      score: 0.4 * (s.revisionPassRate ?? 1) + 0.4 * ((s.avgConfidence ?? 3) / 5) + 0.2 * (s.pct / 100),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0;
    });
}

export interface Recommendation {
  kind: 'revision' | 'weak-pattern' | 'new' | 'course-review' | 'course-session';
  questionIds: number[]; // empty for course-* kinds
  weekIds?: string[]; // present only on course-* kinds
  reason: string;
}

// Course signal is optional so question-only callers (and the planned LLM-backed Recommender)
// keep working unchanged; when present, due week reviews rank right after due question
// revisions (both are retention work), and the next session ranks last — it surfaces only on
// days when the DSA workload leaves room.
export interface RecommendArgs {
  all: Question[];
  byId: Record<number, QuestionProgress>;
  due: number[];
  todaysNew: number[];
  weakest: WeakPattern[];
  course?: {
    dueReviewWeekIds: string[];
    nextSessionWeekId: string | null;
  };
}

export interface Recommender {
  recommend(args: RecommendArgs): Recommendation[];
}

export class HeuristicRecommender implements Recommender {
  recommend(args: RecommendArgs): Recommendation[] {
    const { all, byId, due, todaysNew, weakest, course } = args;
    const recommendations: Recommendation[] = [];

    if (due.length > 0) {
      recommendations.push({
        kind: 'revision',
        questionIds: [...due],
        reason: `${due.length} question${due.length === 1 ? ' is' : 's are'} due or overdue for revision — review ${due.length === 1 ? 'it' : 'them'} today.`,
      });
    }

    if (course && course.dueReviewWeekIds.length > 0) {
      const n = course.dueReviewWeekIds.length;
      recommendations.push({
        kind: 'course-review',
        questionIds: [],
        weekIds: [...course.dueReviewWeekIds],
        reason: `${n} course week${n === 1 ? ' is' : 's are'} due for review — refresh ${n === 1 ? 'it' : 'them'} before the details fade.`,
      });
    }

    if (weakest.length > 0) {
      const weakestPattern = weakest[0].pattern;
      const unsolvedIds = all
        .filter((q) => q.pattern === weakestPattern && (byId[q.id]?.status ?? 'unsolved') !== 'solved')
        .map((q) => q.id)
        .slice(0, MAX_WEAK_PATTERN_QUESTIONS);

      if (unsolvedIds.length > 0) {
        recommendations.push({
          kind: 'weak-pattern',
          questionIds: unsolvedIds,
          reason: `Your "${weakestPattern}" pattern is your weakest area — practice a few more questions here.`,
        });
      }
    }

    if (todaysNew.length > 0) {
      recommendations.push({
        kind: 'new',
        questionIds: [...todaysNew],
        reason: "Today's new questions to get started on.",
      });
    }

    if (course && course.nextSessionWeekId !== null) {
      recommendations.push({
        kind: 'course-session',
        questionIds: [],
        weekIds: [course.nextSessionWeekId],
        reason: 'Your next AI/ML session is ready — keep the two-day sprint moving.',
      });
    }

    return recommendations.slice(0, 3);
  }
}

// ---------------------------------------------------------------------------
// seededRandomQuestion: deterministic "surprise me" picker.
// ---------------------------------------------------------------------------

// Cheap FNV-1a-style string hash: folds `seed` into a deterministic 32-bit fingerprint,
// used only to seed the PRNG below (not for any security-sensitive purpose).
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast, deterministic PRNG seeded by a 32-bit integer.
// Public-domain algorithm (see https://github.com/bryc/code/blob/master/jshash/PRNGs.md).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandomQuestion(all: Question[], seed: string): Question {
  const random = mulberry32(hashSeed(seed));
  const index = Math.floor(random() * all.length);
  return all[index];
}
