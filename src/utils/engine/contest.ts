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
import type {
  ContestStallRecord,
  Difficulty,
  PatternId,
  Question,
  QuestionProgress,
} from '@/types';
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

/* ------------------------------------------------------------------------------------------- */
/* The generic selector                                                                         */
/* ------------------------------------------------------------------------------------------- */

/**
 * One problem as the selector sees it — deliberately structural, so the same code composes a set
 * from the 539 curriculum questions and from the 2,561-problem contest library without either
 * universe knowing about the other (PRODUCT.md's two-universes rule).
 *
 * `key` is whatever the caller uses to identify a problem: `q:<id>` for a curriculum question,
 * the slug for a contest-library problem. The selector treats it as opaque.
 */
export interface ContestCandidate {
  key: string;
  difficulty: Difficulty;
  /** May hold several — a contest problem can honestly belong to more than one pattern. */
  patterns: PatternId[];
  targetMinutes: number;
  /** ZeroTrac contest rating where one exists. Null for unrated curriculum questions. */
  contestRating?: number | null;
  /** Contest of origin, for the diversity rule. Null when the problem has no contest. */
  contestSlug?: string | null;
}

export interface ContestPlan {
  /** Difficulty ladder. Full Contest passes CONTEST_SHAPE; a rating-driven set omits it. */
  shape?: Difficulty[];
  /** How many problems when `shape` is absent. */
  count?: number;
  /** Inclusive rating window. Candidates outside it are not eligible. */
  ratingRange?: { min: number; max: number };
  /** Prefer a set spanning several patterns. On for every shipped mode. */
  distinctPatterns?: boolean;
  /**
   * Prefer problems from different contests (§27). Off for "Recreate Contest", which is the one
   * mode where taking all four from one sitting is the entire point.
   */
  distinctContests?: boolean;
}

const DEFAULT_COUNT = 4;

/**
 * Choose a set from `pool`, honouring the plan's shape and diversity rules.
 *
 * The algorithm is the one Full Contest has always used, lifted to candidates: walk the slots in
 * order, prefer candidates that keep the set diverse, and fall back to relaxing diversity rather
 * than shipping a short set — a three-problem contest because one difficulty ran dry is worse
 * than one repeated pattern. Exactly one `random()` draw per filled slot, which is what keeps a
 * given seed reproducing a given set.
 */
export function selectContestSet(
  pool: readonly ContestCandidate[],
  plan: ContestPlan,
  seed: string,
): ContestCandidate[] {
  const random = mulberry32(hashSeed(seed));
  const shape = plan.shape;
  const slots = shape ? shape.length : (plan.count ?? DEFAULT_COUNT);

  const inRange = (c: ContestCandidate): boolean =>
    plan.ratingRange === undefined ||
    (c.contestRating != null &&
      c.contestRating >= plan.ratingRange.min &&
      c.contestRating <= plan.ratingRange.max);

  const eligible = pool.filter(inRange);
  const usedPatterns = new Set<PatternId>();
  const usedContests = new Set<string>();
  const picked: ContestCandidate[] = [];
  const taken = new Set<string>();

  for (let slot = 0; slot < slots; slot++) {
    const difficulty = shape?.[slot];
    const atDifficulty = eligible.filter(
      (c) => (difficulty === undefined || c.difficulty === difficulty) && !taken.has(c.key),
    );
    if (atDifficulty.length === 0) continue;

    // Preference order, most constrained first. Each rung drops one diversity rule rather than
    // dropping the slot — the set staying full matters more than it staying perfectly varied.
    const freshPattern = (c: ContestCandidate) =>
      plan.distinctPatterns !== true || !c.patterns.some((p) => usedPatterns.has(p));
    const freshContest = (c: ContestCandidate) =>
      plan.distinctContests !== true || c.contestSlug == null || !usedContests.has(c.contestSlug);

    const both = atDifficulty.filter((c) => freshPattern(c) && freshContest(c));
    const patternOnly = atDifficulty.filter(freshPattern);
    const from = both.length > 0 ? both : patternOnly.length > 0 ? patternOnly : atDifficulty;

    const pick = from[Math.floor(random() * from.length)]!;
    for (const p of pick.patterns) usedPatterns.add(p);
    if (pick.contestSlug != null) usedContests.add(pick.contestSlug);
    taken.add(pick.key);
    picked.push(pick);
  }

  return picked;
}

/**
 * Compose a contest from curriculum problems the learner has not solved.
 *
 * Patterns are kept distinct across the set on purpose. Four sliding-window problems would
 * measure one thing four times, and the post-contest analysis would then have nothing to compare
 * — the whole diagnostic depends on the set spanning more than one technique.
 *
 * This is now a thin adapter over `selectContestSet`, and it must stay behaviourally identical:
 * Full Contest is locked spec (PRODUCT.md), so the same seed must keep producing the same set.
 * The contest engine's test file is the proof and was not modified when this was generalized.
 */
export function buildContest(input: ContestInput): Contest {
  const { all, byId, seed } = input;
  const shape = input.shape ?? CONTEST_SHAPE;

  const eligible = all.filter((q) => {
    const status = byId[q.id]?.status ?? 'unsolved';
    return status === 'unsolved' || status === 'in_progress';
  });
  const byKey = new Map(eligible.map((q) => [String(q.id), q]));

  const picked = selectContestSet(
    eligible.map((q) => ({
      key: String(q.id),
      difficulty: q.difficulty,
      patterns: [q.pattern],
      targetMinutes: q.estimatedTime,
    })),
    { shape, distinctPatterns: true },
    seed,
  );

  const problems: ContestProblem[] = picked.map((c, i) => {
    const question = byKey.get(c.key)!;
    return { question, order: i + 1, targetMinutes: question.estimatedTime };
  });

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
  /** Submissions the learner reported as not passing. Optional: older callers never had them. */
  wrongSubmits?: number;
  /** The learner explicitly stepped away from this one to protect the clock. */
  setAside?: boolean;
}

export type Outcome =
  /** Solved at or near pace. */
  | 'clean'
  /** Solved, but it cost far more than the problem is worth — the approach was there. */
  | 'slow'
  /** Real time went in without a solution. This is the one that is worth acting on. */
  | 'stalled'
  /** Put down deliberately. Describes the decision; see `hasRealTime` for what it evidences. */
  | 'set-aside'
  /** Barely touched. Deliberately produces no claim. */
  | 'untouched';

export interface ProblemReading {
  question: Question;
  outcome: Outcome;
  minutesSpent: number;
  targetMinutes: number;
  wrongSubmits: number;
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
  /**
   * The specific problems real time went into without a solution. Same evidence as `patternGaps`,
   * kept at question resolution so a later sitting can serve one of them again — the pattern-level
   * model rightly refuses to shout about a lone stall, and this is how the learner still gets to
   * meet the actual problem a second time.
   */
  stalledQuestionIds: number[];
  /** The single most useful thing to do next, or null when the set said nothing conclusive. */
  next: { pattern: PatternId; why: string } | null;
  /** True when too little of the contest was actually attempted to read anything into it. */
  inconclusive: boolean;
}

/** Past this multiple of the target, a solve cost more than the problem is worth. */
export const SLOW_FACTOR = 1.5;
/** Below this share of the target, an unsolved problem says nothing about the learner. */
export const UNTOUCHED_SHARE = 0.25;

/**
 * The single gate for "did real time go into this". Every no-claim decision in this module hangs
 * off it, which is what keeps `set-aside` from becoming a laundering button: naming the decision
 * changes the label, never whether the minutes count as evidence.
 */
function hasRealTime(minutes: number, target: number): boolean {
  return minutes >= target * UNTOUCHED_SHARE;
}

function classify(attempt: ContestAttempt, target: number): Outcome {
  if (attempt.solved) return attempt.minutesSpent > target * SLOW_FACTOR ? 'slow' : 'clean';
  // The decision the learner made is worth naming — protecting the clock is a real contest skill
  // and an unlabelled skip reads as an abandonment. It describes what they did; `hasRealTime`
  // still decides what it evidences.
  if (attempt.setAside) return 'set-aside';
  return hasRealTime(attempt.minutesSpent, target) ? 'stalled' : 'untouched';
}

/** A submission that did not pass is an event, never a trait. Stated as a count, and no more. */
function submitsNote(wrongSubmits: number): string {
  if (wrongSubmits < 1) return '';
  return ` ${wrongSubmits} submission${wrongSubmits === 1 ? '' : 's'} didn't pass.`;
}

function readingFor(
  outcome: Outcome,
  question: Question,
  minutes: number,
  target: number,
  wrongSubmits: number,
): string {
  const submits = submitsNote(wrongSubmits);
  switch (outcome) {
    case 'clean':
      return `Solved in ${minutes} min against a ${target} min target.${submits}`;
    case 'slow':
      // The honest version of "you recognised it but the implementation ate the clock". It is
      // stated as an observation about time, not as a claim about what the learner was thinking.
      return `Solved, but it took ${minutes} min against a ${target} min target — the approach was there and the time went into getting it written.${submits}`;
    case 'stalled':
      return `${minutes} min went in without a solution.${submits} ${question.tests}`;
    case 'set-aside':
      // Both halves are facts, and both belong: the learner put it down on purpose, and the
      // minutes before that still happened.
      return hasRealTime(minutes, target)
        ? `Set aside after ${minutes} min to protect the clock — a deliberate call, and those minutes still went in without a solution.${submits} ${question.tests}`
        : `Set aside after ${minutes} min — not enough time in it to read anything into.${submits}`;
    case 'untouched':
      // Saying nothing is the correct output here, and it has to be said out loud, or the reader
      // will fill the silence with "I am bad at this".
      return `Only ${minutes} min spent — not enough to read anything into.${submits}`;
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
    const wrongSubmits = Math.max(0, Math.floor(attempt.wrongSubmits ?? 0));
    const outcome = classify(attempt, problem.targetMinutes);
    return {
      question: problem.question,
      outcome,
      minutesSpent: attempt.minutesSpent,
      targetMinutes: problem.targetMinutes,
      wrongSubmits,
      reading: readingFor(
        outcome,
        problem.question,
        attempt.minutesSpent,
        problem.targetMinutes,
        wrongSubmits,
      ),
    };
  });

  // A solve is evidence however fast it came. An unsolved problem is evidence only when real time
  // went into it — that rule predates `set-aside` and now governs it too, so putting a problem
  // down deliberately can never erase minutes that were genuinely spent on it.
  const evidential = (r: ProblemReading): boolean =>
    r.outcome === 'clean' ||
    r.outcome === 'slow' ||
    (r.outcome !== 'untouched' && hasRealTime(r.minutesSpent, r.targetMinutes));

  const stalled = readings.filter((r) => evidential(r) && r.outcome !== 'clean' && r.outcome !== 'slow');
  const informative = readings.filter(evidential);

  // Fewer than half the problems genuinely attempted means the contest measured availability,
  // not ability. Reporting pattern weakness off that would be drawing a conclusion from a
  // session that was abandoned.
  const inconclusive = informative.length < Math.ceil(contest.problems.length / 2);

  const patternGaps = inconclusive
    ? []
    : Array.from(new Set(stalled.map((r) => r.question.pattern)));
  const stalledQuestionIds = inconclusive ? [] : stalled.map((r) => r.question.id);

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
    stalledQuestionIds,
    next,
    inconclusive,
  };
}

/**
 * The stalled problems a PERSISTED sitting still holds, applying the same rule the live analysis
 * applied. Kept here beside that rule rather than in the reader, so "what counts as a stall" is
 * decided once: a set-aside with real minutes behind it is evidence, and a set-aside without them
 * is a decision and nothing more.
 *
 * A record written before per-problem rows existed yields nothing, which is correct — its stalls
 * were only ever known at pattern resolution.
 */
export function stalledIdsFromRecord(record: ContestStallRecord): number[] {
  return (record.problems ?? [])
    .filter(
      (problem) =>
        problem.outcome === 'stalled' ||
        (problem.outcome === 'set-aside' &&
          hasRealTime(problem.minutesSpent, problem.targetMinutes)),
    )
    .map((problem) => problem.questionId);
}

/* ------------------------------------------------------------------------------------------- */
/* Where the clock went                                                                          */
/* ------------------------------------------------------------------------------------------- */

/**
 * Time allocation is a different skill from solving, and it is the one a contest is uniquely able
 * to observe: practice is self-paced, so nothing else in this product can see a learner spend an
 * hour on the problem they were never going to get. This states where the minutes went and stops
 * there. It does not say the allocation was wrong — that judgment needs a counterfactual nobody
 * has, and "you should have skipped it" is exactly the invented verdict this module refuses.
 */
/** Below two problems with real time in them there is no distribution to describe, only a figure. */
const MIN_ALLOCATION_PROBLEMS = 2;
/** Above this share of the clock, one problem is the story of the sitting rather than part of it. */
const CONCENTRATION_SHARE = 0.5;

export function timeReading(contest: Contest, attempts: ContestAttempt[]): string | null {
  const byQuestion = new Map(attempts.map((a) => [a.questionId, a]));
  const rows = contest.problems.map((problem) => {
    const attempt = byQuestion.get(problem.question.id);
    return {
      title: problem.question.title,
      minutes: Math.max(0, attempt?.minutesSpent ?? 0),
      target: problem.targetMinutes,
      solved: attempt?.solved ?? false,
    };
  });

  const engaged = rows.filter((r) => hasRealTime(r.minutes, r.target));
  if (engaged.length < MIN_ALLOCATION_PROBLEMS) return null;

  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  if (total <= 0) return null;

  const idle = rows.length - engaged.length;
  const idleNote =
    idle > 0 ? ` ${idle} problem${idle === 1 ? '' : 's'} never got real time.` : '';

  const ranked = [...engaged].sort((a, b) => b.minutes - a.minutes);
  const most = ranked[0]!;
  const least = ranked[ranked.length - 1]!;

  if (most.minutes / total > CONCENTRATION_SHARE) {
    return `${most.minutes} of your ${total} minutes went to ${most.title}, which you ${most.solved ? 'solved' : 'did not solve'}.${idleNote}`;
  }
  if (most.minutes === least.minutes) {
    return `Your ${total} minutes spread evenly across ${engaged.length} problems, ${most.minutes} min each.${idleNote}`;
  }
  return `Your ${total} minutes spread across ${engaged.length} problems, ${least.minutes}–${most.minutes} min each.${idleNote}`;
}
