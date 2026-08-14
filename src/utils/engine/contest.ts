// Contest mode — a timed set under pressure, and an honest reading of what happened.
//
// The point of a contest here is not the score. Ordinary practice is untimed and self-paced, so
// it measures whether you *can* solve something; a contest measures whether you can solve it now,
// cold, with a clock running — which is the thing an interview actually tests and the thing
// nothing else in this product observes.
//
// The analysis is where the value is, and it is deliberately conservative. It is very easy to
// build a post-contest screen that tells a confident story from four data points; most of what
// looks like signal in a four-problem set is noise. So every finding here states the evidence it
// rests on, several outcomes are explicitly declared unreadable, and a problem the learner barely
// touched produces no claim at all rather than a claim about their weakness.
//
// `patternGaps` returns pattern ids rather than a rendered verdict so a contest's findings can
// feed the shared weakness signal rather than forming a private analytics island. That wiring
// lives in `finishContest` (store/actions.ts): the finished sitting's gaps are banked as a dated
// stall record in the persisted `contests` channel, which `engine/weakness.ts` reads as its
// contest signal. The live contest slice itself stays unpersisted — a restored stopped clock
// lies — and the `inconclusive` suppression below remains the single source of "this sitting
// says nothing": an inconclusive contest writes no record anywhere.
//
// Pure and deterministic like every engine module: no clock, no store, no randomness beyond the
// seeded PRNG the caller supplies a seed for.
import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';
import { hashSeed, mulberry32 } from '@/utils/engine/prng';

/* ------------------------------------------------------------------------------------------- */
/* Building a contest                                                                           */
/* ------------------------------------------------------------------------------------------- */

export interface ContestProblem {
  question: Question;
  /** 1-based position in the set. */
  order: number;
  /** What a solver at pace should need — the question's own authored estimate. */
  targetMinutes: number;
}

export interface Contest {
  id: string;
  /** The difficulty ladder this set was built on, for the UI to name honestly. */
  shape: Difficulty[];
  problems: ContestProblem[];
  /** Total wall-clock the set is scheduled for. */
  durationMin: number;
}

/**
 * The difficulty ladder. Real contests open with something you can finish, which matters more
 * here than realism: a set that opens on a hard problem tests composure, not technique, and a
 * learner who stalls on problem one learns nothing from the remaining three.
 */
export const CONTEST_SHAPE: Difficulty[] = ['easy', 'medium', 'medium', 'hard'];

/** Slack over the sum of estimates. A contest should be tight, not impossible. */
const PACE_FACTOR = 1.1;

export interface ContestInput {
  /** Everything in the dataset. */
  all: Question[];
  byId: Record<number, QuestionProgress>;
  /** Stable seed — the same day must produce the same contest on reload. */
  seed: string;
  shape?: Difficulty[];
}

/**
 * Compose a contest from problems the learner has not solved.
 *
 * Patterns are kept distinct across the set on purpose. Four sliding-window problems would
 * measure one thing four times, and the post-contest analysis would then have nothing to compare
 * — the whole diagnostic depends on the set spanning more than one technique.
 */
export function buildContest(input: ContestInput): Contest {
  const { all, byId, seed } = input;
  const shape = input.shape ?? CONTEST_SHAPE;
  const random = mulberry32(hashSeed(seed));

  const eligible = all.filter((q) => {
    const status = byId[q.id]?.status ?? 'unsolved';
    return status === 'unsolved' || status === 'in_progress';
  });

  const usedPatterns = new Set<PatternId>();
  const problems: ContestProblem[] = [];

  for (const [i, difficulty] of shape.entries()) {
    const pool = eligible.filter(
      (q) =>
        q.difficulty === difficulty &&
        !usedPatterns.has(q.pattern) &&
        !problems.some((p) => p.question.id === q.id),
    );
    // Fall back to repeating a pattern before giving up on the slot: a three-problem contest
    // because the learner has solved most of one difficulty is worse than one repeated pattern.
    const fallback = eligible.filter(
      (q) => q.difficulty === difficulty && !problems.some((p) => p.question.id === q.id),
    );
    const from = pool.length > 0 ? pool : fallback;
    if (from.length === 0) continue;

    const pick = from[Math.floor(random() * from.length)]!;
    usedPatterns.add(pick.pattern);
    problems.push({ question: pick, order: i + 1, targetMinutes: pick.estimatedTime });
  }

  const durationMin = Math.round(problems.reduce((sum, p) => sum + p.targetMinutes, 0) * PACE_FACTOR);

  return { id: seed, shape, problems, durationMin };
}

/* ------------------------------------------------------------------------------------------- */
/* Reading the result                                                                           */
/* ------------------------------------------------------------------------------------------- */

export interface ContestAttempt {
  questionId: number;
  solved: boolean;
  /** Minutes actually spent on this problem. */
  minutesSpent: number;
}

export type Outcome =
  /** Solved at or near pace. */
  | 'clean'
  /** Solved, but it cost far more than the problem is worth — the approach was there. */
  | 'slow'
  /** Real time went in without a solution. This is the one that is worth acting on. */
  | 'stalled'
  /** Barely touched. Deliberately produces no claim. */
  | 'untouched';

export interface ProblemReading {
  question: Question;
  outcome: Outcome;
  minutesSpent: number;
  targetMinutes: number;
  /** What the evidence supports — never more than that. */
  reading: string;
}

export interface ContestAnalysis {
  solved: number;
  total: number;
  minutesSpent: number;
  readings: ProblemReading[];
  /**
   * Patterns where the contest saw a genuine stall. Feeds the shared weakness signal; empty when
   * nothing in the set was informative, which is a normal outcome for a short contest.
   */
  patternGaps: PatternId[];
  /** The single most useful thing to do next, or null when the set said nothing conclusive. */
  next: { pattern: PatternId; why: string } | null;
  /** True when too little of the contest was actually attempted to read anything into it. */
  inconclusive: boolean;
}

/** Past this multiple of the target, a solve cost more than the problem is worth. */
export const SLOW_FACTOR = 1.5;
/** Below this share of the target, an unsolved problem says nothing about the learner. */
export const UNTOUCHED_SHARE = 0.25;

function classify(attempt: ContestAttempt, target: number): Outcome {
  if (attempt.solved) return attempt.minutesSpent > target * SLOW_FACTOR ? 'slow' : 'clean';
  return attempt.minutesSpent < target * UNTOUCHED_SHARE ? 'untouched' : 'stalled';
}

function readingFor(outcome: Outcome, question: Question, minutes: number, target: number): string {
  switch (outcome) {
    case 'clean':
      return `Solved in ${minutes} min against a ${target} min target.`;
    case 'slow':
      // The honest version of "you recognised it but the implementation ate the clock". It is
      // stated as an observation about time, not as a claim about what the learner was thinking.
      return `Solved, but it took ${minutes} min against a ${target} min target — the approach was there and the time went into getting it written.`;
    case 'stalled':
      return `${minutes} min went in without a solution. ${question.tests}`;
    case 'untouched':
      // Saying nothing is the correct output here, and it has to be said out loud, or the reader
      // will fill the silence with "I am bad at this".
      return `Only ${minutes} min spent — not enough to read anything into.`;
  }
}

/**
 * What the contest actually showed.
 *
 * Note what is deliberately absent: no score, no rank, no percentile, no rating. There is nobody
 * to rank against in a local-first app, and a fabricated one would be the clearest example of the
 * invented precision this product refuses everywhere else.
 */
export function analyzeContest(contest: Contest, attempts: ContestAttempt[]): ContestAnalysis {
  const byQuestion = new Map(attempts.map((a) => [a.questionId, a]));

  const readings: ProblemReading[] = contest.problems.map((problem) => {
    const attempt = byQuestion.get(problem.question.id) ?? {
      questionId: problem.question.id,
      solved: false,
      minutesSpent: 0,
    };
    const outcome = classify(attempt, problem.targetMinutes);
    return {
      question: problem.question,
      outcome,
      minutesSpent: attempt.minutesSpent,
      targetMinutes: problem.targetMinutes,
      reading: readingFor(outcome, problem.question, attempt.minutesSpent, problem.targetMinutes),
    };
  });

  const stalled = readings.filter((r) => r.outcome === 'stalled');
  const informative = readings.filter((r) => r.outcome !== 'untouched');

  // Fewer than half the problems genuinely attempted means the contest measured availability,
  // not ability. Reporting pattern weakness off that would be drawing a conclusion from a
  // session that was abandoned.
  const inconclusive = informative.length < Math.ceil(contest.problems.length / 2);

  const patternGaps = inconclusive
    ? []
    : Array.from(new Set(stalled.map((r) => r.question.pattern)));

  // The count must describe THIS pattern, not the set: "2 problems stalled here" when one of the
  // two stalls was a different technique is exactly the invented precision this module refuses.
  const topPattern = patternGaps[0];
  const stalledHere = stalled.filter((r) => r.question.pattern === topPattern).length;
  const next =
    topPattern !== undefined
      ? {
          pattern: topPattern,
          why: `${stalledHere === 1 ? 'One problem' : `${stalledHere} problems`} in this set stalled here with real time on the clock.`,
        }
      : null;

  return {
    solved: readings.filter((r) => r.outcome === 'clean' || r.outcome === 'slow').length,
    total: contest.problems.length,
    minutesSpent: attempts.reduce((sum, a) => sum + a.minutesSpent, 0),
    readings,
    patternGaps,
    next,
    inconclusive,
  };
}
