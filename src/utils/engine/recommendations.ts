import type { PatternId, Question, QuestionProgress } from '@/types';
import { hashSeed, mulberry32 } from '@/utils/engine/prng';

export interface WeakPattern {
  pattern: PatternId;
  score: number; // lower = weaker
}

const MAX_WEAK_PATTERN_QUESTIONS = 3;

// `weakestPatterns(stats)` lived here: a 0.4·passRate + 0.4·confidence + 0.2·coverage blend. It
// is DELETED, not deprecated, because it was the product's second opinion about the same learner
// and the two could disagree on screen at the same time. Two properties made it actively wrong
// rather than merely redundant: it imputed `passRate ?? 1` and `avgConfidence ?? 3`, so a pattern
// that had never been tested scored as though it had been; and it counted low coverage as
// weakness, so a pattern the learner simply had not reached yet — or had finished 100% of — could
// be named their weakest area.
//
// `engine/weakness.ts` is the one weakness model (recency decay, repeated evidence, no dominant
// signal, unmeasured-is-absent). Reach it through `selectPatternWeakness`.

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
      const weakestPattern = weakest[0]!.pattern;
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

export function seededRandomQuestion(all: Question[], seed: string): Question {
  const random = mulberry32(hashSeed(seed));
  const index = Math.floor(random() * all.length);
  return all[index]!;
}
