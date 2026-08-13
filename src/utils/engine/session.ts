// The session engine — "I have N minutes; what is the best revision I can actually finish?"
//
// This is the answer to a different question than engine/nextAction.ts asks. `rankWork` answers
// "what is the single most valuable thing to do next", and the Today hero and its plan are both
// derived from that one ordering. This module answers "compose me a *session*": a bounded,
// finishable stretch of work with a beginning, a middle and an end. The two share the same
// underlying priority thinking (retention outranks acquisition; the most at-risk item leads) and
// they must never contradict each other — but a session is not a prefix of a to-do list, and
// pretending it is produced the thing this replaces: a flat queue of everything due.
//
// Three ideas do the work here.
//
// 1. TIME CHOOSES DEPTH, NOT COUNT. A question is not one fixed unit of revision. In fifteen
//    minutes the useful thing to do with Merge Intervals is to state its key idea from memory. In
//    ninety minutes it is to re-implement it and name the invariant. Same question, different
//    activity, different cost. So the session is planned as a *workload budget* split across
//    depths, and the number of questions falls out of that — it is never an input.
//
// 2. COGNITIVE LOAD IS NOT MINUTES. Four hard dynamic-programming problems that happen to come
//    due together are ~50 minutes and an unfinishable evening. Load is tracked separately from
//    time, capped against the budget, and heavy items are spaced apart.
//
// 3. THE SESSION HAS AN ARC. Quick recalls open, standard reviews carry, the deepest work sits
//    where attention is highest but not first, transfer closes, reflection ends it. Selection
//    order and play order are deliberately different: the most at-risk items are chosen for the
//    deepest band, but the session still *opens* with something light.
//
// Pure and deterministic like every engine module: ISO date strings in, no clock, no store.
import type { Difficulty, PatternId, Question } from '@/types';
import { revisionMinutes } from '@/utils/engine/planner';

/* ------------------------------------------------------------------------------------------- */
/* Depth                                                                                        */
/* ------------------------------------------------------------------------------------------- */

/**
 * What the learner actually does with an item this session.
 *
 * The prompts are the product: "revise Merge Intervals" is a category, "state the key idea and
 * the cue that should have triggered it" is an instruction someone can follow in four minutes.
 */
export type Depth = 'recall' | 'review' | 'deep' | 'transfer';

export const DEPTH_LABEL: Record<Depth, string> = {
  recall: 'Quick recall',
  review: 'Review',
  deep: 'Deep review',
  transfer: 'Transfer',
};

export const DEPTH_PROMPT: Record<Depth, string> = {
  recall: 'From memory: what is the key idea, and what in the statement should have triggered it?',
  review: 'Re-derive the approach and say why it is correct before you look at anything.',
  deep: 'Re-implement it, then state the invariant that makes the loop correct.',
  transfer: 'Same idea, new disguise. Solve it without reopening the original.',
};

/**
 * Minutes per depth, derived from the question's own authored estimate rather than a flat
 * constant — reviewing Two Sum and reviewing Burst Balloons are not the same eight minutes.
 * `review` reuses `revisionMinutes` unchanged; that figure is already the product's one answer
 * for what a revision costs and a second one would be a contradiction, not a refinement.
 *
 * The clamps hold each depth inside a band a learner can plan against: a "quick recall" that can
 * bill twelve minutes is not quick, whatever the arithmetic says.
 */
export function depthMinutes(question: Question, depth: Depth): number {
  const est = question.estimatedTime;
  switch (depth) {
    case 'recall':
      return clamp(Math.round(est * 0.15), 3, 5);
    case 'review':
      return revisionMinutes(question);
    case 'deep':
      return clamp(Math.round(est * 0.6), 10, 25);
    case 'transfer':
      return clamp(Math.round(est * 0.9), 20, 40);
  }
}

// Difficulty is not linear — the step from medium to hard costs more attention than the step from
// easy to medium — so `hard` is weighted above 3 rather than at it.
const DIFFICULTY_LOAD: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3.2 };
const DEPTH_LOAD: Record<Depth, number> = { recall: 0.4, review: 1, deep: 1.5, transfer: 1.6 };

/** Cognitive cost, deliberately not proportional to minutes. */
export function activityLoad(difficulty: Difficulty, depth: Depth): number {
  return Math.round(DIFFICULTY_LOAD[difficulty] * DEPTH_LOAD[depth] * 10) / 10;
}

/**
 * At or above this, an item is "heavy": capped per session, and never placed next to another one.
 *
 * The threshold is calibrated so that "heavy" means what a learner would call heavy — a hard
 * problem at any real depth, or an unfamiliar medium one. It deliberately does not catch a medium
 * re-implementation (3.0) or a hard cold recall (1.3), because a rule that flags most of the
 * session as demanding cannot then protect anyone from a demanding session.
 */
export const HEAVY_LOAD = 3.2;

/* ------------------------------------------------------------------------------------------- */
/* Shape                                                                                        */
/* ------------------------------------------------------------------------------------------- */

export interface SessionShape {
  id: 'quick' | 'standard' | 'focused' | 'deep' | 'extended';
  label: string;
  /** One line the preview can show, describing what this length of session is good for. */
  blurb: string;
  /** Fractions of the budget allocated to each depth. Sums to 1. */
  mix: Record<Depth, number>;
}

/**
 * The shapes, by budget. These are the calibration point of the whole module, so the reasoning is
 * written down rather than left in the numbers:
 *
 * - Under ~20 minutes there is no honest way to re-implement anything, so the whole budget is
 *   retrieval. A short session that does one thing well beats a long session started badly.
 * - Around half an hour, retrieval plus reasoning is the highest-value mix — recall a couple of
 *   items cold, then genuinely re-derive two or three.
 * - Past an hour, some of the budget should go to the items that keep failing, at a depth that
 *   can actually fix them, which means writing code again.
 * - Past ninety minutes, the marginal value of one more review is lower than the marginal value
 *   of one unfamiliar problem in a family already met — that is where transfer earns its slot.
 */
const SHAPES: { maxMinutes: number; shape: SessionShape }[] = [
  {
    maxMinutes: 20,
    shape: {
      id: 'quick',
      label: 'Quick recall',
      blurb: 'Retrieval only — say the idea out loud, move on.',
      mix: { recall: 1, review: 0, deep: 0, transfer: 0 },
    },
  },
  {
    maxMinutes: 45,
    shape: {
      id: 'standard',
      label: 'Standard review',
      blurb: 'A few cold recalls, then re-derive the ones that matter.',
      mix: { recall: 0.3, review: 0.7, deep: 0, transfer: 0 },
    },
  },
  {
    maxMinutes: 75,
    shape: {
      id: 'focused',
      label: 'Focused review',
      blurb: 'Recall, reasoning, and code again on the one that keeps slipping.',
      mix: { recall: 0.2, review: 0.55, deep: 0.25, transfer: 0 },
    },
  },
  {
    maxMinutes: 105,
    shape: {
      id: 'deep',
      label: 'Deep review',
      blurb: 'Enough time to re-implement and to meet one unfamiliar problem.',
      mix: { recall: 0.15, review: 0.4, deep: 0.3, transfer: 0.15 },
    },
  },
  {
    maxMinutes: Number.POSITIVE_INFINITY,
    shape: {
      id: 'extended',
      label: 'Extended session',
      blurb: 'Full pass: retrieval, reasoning, implementation, and transfer.',
      mix: { recall: 0.12, review: 0.35, deep: 0.28, transfer: 0.25 },
    },
  },
];

export function shapeFor(budgetMin: number): SessionShape {
  return (SHAPES.find((s) => budgetMin <= s.maxMinutes) ?? SHAPES[SHAPES.length - 1]!).shape;
}

/**
 * The budgets offered. Deliberately coarse — a learner knows whether they have "about half an
 * hour", not whether they have thirty-seven minutes, and offering a slider would be false
 * precision dressed as flexibility.
 */
export const SESSION_BUDGETS = [15, 30, 60, 90, 120, 180] as const;
export type SessionBudget = (typeof SESSION_BUDGETS)[number];

/** Minutes held back at the end of any session long enough for the closing question to land. */
export const REFLECT_MINUTES = 3;
const REFLECT_FLOOR = 30;

/* ------------------------------------------------------------------------------------------- */
/* Input                                                                                        */
/* ------------------------------------------------------------------------------------------- */

export interface RevisionCandidate {
  question: Question;
  /** Days past the scheduled date. 0 = due today. Negative = not due yet (pull-forward only). */
  overdueDays: number;
  /** The ladder gap that just elapsed, so a reason can name it. */
  intervalDays: number;
  /** 0..5 on the ladder. Early rungs are more fragile than late ones. */
  stage: number;
  /** Failed reviews on this question, all time. */
  failures: number;
  /** Last self-reported confidence, 1..5, or null if never rated. */
  confidence: number | null;
  /** Days since the learner last touched it. Recently seen work is worth less right now. */
  daysSinceSeen: number;
}

export interface TransferCandidate {
  question: Question;
  /** The family this problem shares an idea with, named so the reason can be concrete. */
  familyName: string;
  /** A solved member of that family — the thing the learner is transferring *from*. */
  fromTitle: string;
}

export interface CourseReviewCandidate {
  weekId: string;
  title: string;
  minutes: number;
  overdueDays: number;
}

export interface SessionInput {
  budgetMin: number;
  /** Everything on the question ladder we could review — due and not yet due. */
  candidates: RevisionCandidate[];
  /** Unsolved problems in families the learner has already met. Genuine transfer material. */
  transfer: TransferCandidate[];
  courseReviews: CourseReviewCandidate[];
  /** Weakest recognition areas first. `score` is a normalized 0..1 weight. */
  weakPatterns: { id: PatternId; name: string; score: number }[];
  /** The day's recognition drill, when it is available and not already taken. */
  drill: { available: boolean; minutes: number; weakestPatternName: string | null } | null;
}

/* ------------------------------------------------------------------------------------------- */
/* Output                                                                                       */
/* ------------------------------------------------------------------------------------------- */

export type ActivityKind = Depth | 'drill' | 'course-review' | 'reflect';

export interface SessionActivity {
  id: string;
  kind: ActivityKind;
  title: string;
  /** What to do — an instruction, not a category. */
  prompt: string;
  /** Why this item is in this session, in the learner's terms. Always concrete, never pressure. */
  why: string;
  minutes: number;
  load: number;
  href: string;
  questionId?: number;
  weekId?: string;
  pattern?: PatternId;
}

export interface SessionRationale {
  due: number;
  overdue: number;
  weakness: number;
  retention: number;
  transfer: number;
}

export interface RevisionSession {
  budgetMin: number;
  shape: SessionShape;
  activities: SessionActivity[];
  totalMinutes: number;
  totalLoad: number;
  /**
   * Distinct patterns this session touches, for the preview's "Focus" line. Ids, not names —
   * the engine stays free of the pattern registry and the UI does the naming it already does
   * everywhere else.
   */
  focus: PatternId[];
  rationale: SessionRationale;
  /** Due work this session did not take. Reported calmly — never as the headline. */
  deferred: RevisionCandidate[];
  /** True when due work ran out and the remaining budget was filled with surplus material. */
  usedSurplus: boolean;
}

/* ------------------------------------------------------------------------------------------- */
/* Priority                                                                                     */
/* ------------------------------------------------------------------------------------------- */

type Reason = 'overdue' | 'due' | 'failed' | 'low-confidence' | 'weak-pattern' | 'pull-forward';

interface Scored {
  candidate: RevisionCandidate;
  score: number;
  reason: Reason;
  weakPatternName: string | null;
}

const OVERDUE_CAP = 14;
const FAILURE_CAP = 3;
const LOW_CONFIDENCE = 2;

/**
 * How much this item wants attention, and — just as importantly — the single strongest reason
 * why. Every term below maps to one signal the product already records; nothing here is a tuned
 * black box, because the reason is shown to the learner and has to survive being read.
 */
function score(candidate: RevisionCandidate, weak: Map<PatternId, { name: string; score: number }>): Scored {
  const { overdueDays, failures, confidence, stage, daysSinceSeen, question } = candidate;
  const weakHit = weak.get(question.pattern);

  const terms: { reason: Reason; value: number }[] = [
    { reason: 'overdue', value: Math.min(Math.max(overdueDays, 0), OVERDUE_CAP) * 3 },
    { reason: 'due', value: overdueDays === 0 ? 6 : 0 },
    { reason: 'failed', value: Math.min(failures, FAILURE_CAP) * 5 },
    { reason: 'low-confidence', value: confidence !== null && confidence <= LOW_CONFIDENCE ? 6 : 0 },
    { reason: 'weak-pattern', value: (weakHit?.score ?? 0) * 8 },
  ];

  // Two signals that raise an item's priority but must never *explain* it.
  //
  // Ladder position matters — the early rungs are where knowledge is most fragile — but "only at
  // step 0 of the ladder" is a fact about the schedule, not a reason to work on something now.
  // Left in the running it outranked a genuinely overdue item's explanation, and the learner was
  // told the less useful of two true things. Staleness is a tiebreak for the same reason.
  const fragility = Math.max(0, 5 - stage) * 1.5;
  const staleness = Math.min(daysSinceSeen / 7, 3);
  // A pull-forward is not due. It must rank below everything that is, and it must never be
  // described as though its date had arrived.
  const notDuePenalty = overdueDays < 0 ? 100 : 0;

  const total = terms.reduce((sum, t) => sum + t.value, 0) + fragility + staleness - notDuePenalty;
  const strongest = terms.reduce((best, t) => (t.value > best.value ? t : best), terms[0]!);

  return {
    candidate,
    score: total,
    reason: overdueDays < 0 ? 'pull-forward' : strongest.value > 0 ? strongest.reason : 'due',
    weakPatternName: weakHit?.name ?? null,
  };
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * The explanation. Factual register only: what the schedule says, what the record shows. No loss
 * framing, no "you're about to forget this" — the ladder exists precisely so nobody has to be
 * frightened into using it.
 */
function reasonText(scored: Scored): string {
  const { candidate, reason, weakPatternName } = scored;
  switch (reason) {
    case 'overdue':
      return `Waiting ${candidate.overdueDays} ${plural(candidate.overdueDays, 'day', 'days')} past its ${candidate.intervalDays}-day step.`;
    case 'failed':
      return `Missed on ${candidate.failures} ${plural(candidate.failures, 'review', 'reviews')} so far — this one has not settled yet.`;
    case 'low-confidence':
      return `You rated your recall ${candidate.confidence} out of 5 last time.`;
    case 'weak-pattern':
      return `${weakPatternName} is where your recent answers have been shakiest.`;
    case 'pull-forward':
      return 'Not due yet — pulled in because there was time left, and reviewing early costs nothing.';
    case 'due':
    default:
      return `Today is the ${candidate.intervalDays}-day step.`;
  }
}

/* ------------------------------------------------------------------------------------------- */
/* Build                                                                                        */
/* ------------------------------------------------------------------------------------------- */

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Compose the best session that fits the budget.
 *
 * Selection runs deepest-band-first over the priority order, so the items most at risk get the
 * treatment that can actually repair them; playback runs lightest-first, so the session opens on
 * something achievable. Those two orders being different is the design, not an oversight.
 */
export function buildRevisionSession(input: SessionInput): RevisionSession {
  const { budgetMin, candidates, transfer, courseReviews, weakPatterns, drill } = input;
  const shape = shapeFor(budgetMin);

  const weak = new Map(weakPatterns.map((p) => [p.id, { name: p.name, score: p.score }]));
  const scored = candidates.map((c) => score(c, weak)).sort((a, b) => b.score - a.score);

  // Heavy items are capped against the budget, not against the queue. Four hard problems coming
  // due on the same day is a fact about the ladder; making them all one evening's work is a
  // choice, and it is the choice that makes people stop doing revision.
  const maxHeavy = Math.max(1, Math.ceil(budgetMin / 45));
  let heavyUsed = 0;

  const reflectReserve = budgetMin >= REFLECT_FLOOR ? REFLECT_MINUTES : 0;
  const planBudget = budgetMin - reflectReserve;

  const taken = new Set<number>();
  const bands: Record<Depth, SessionActivity[]> = { recall: [], review: [], deep: [], transfer: [] };
  const rationale: SessionRationale = { due: 0, overdue: 0, weakness: 0, retention: 0, transfer: 0 };

  // The drill is a measurement rather than a revision, and it is the cheapest one in the product.
  // It is paid for out of the recall allowance because that is where it sits in the arc.
  let drillActivity: SessionActivity | null = null;
  if (drill?.available && drill.minutes <= planBudget) {
    drillActivity = {
      id: 'drill',
      kind: 'drill',
      title: 'Recognition drill',
      prompt: 'Name the technique each problem wants, on sight.',
      why: drill.weakestPatternName
        ? `Weighted toward ${drill.weakestPatternName}, where your recent answers have been shakiest.`
        : 'A few minutes of naming patterns on sight — the skill an interview starts with.',
      minutes: drill.minutes,
      load: 1,
      href: '/drills',
    };
  }

  let spent = drillActivity ? drillActivity.minutes : 0;

  // --- Band allocation ----------------------------------------------------------------------
  // Each depth gets a share of the budget. Anything a band cannot spend stays in the pot for the
  // bands after it, so a session is never left with idle minutes because one band ran dry.
  const order: Depth[] = ['deep', 'review', 'recall'];
  let pot = planBudget - spent;
  const allowance: Record<Depth, number> = {
    deep: Math.round(planBudget * shape.mix.deep),
    review: Math.round(planBudget * shape.mix.review),
    recall: Math.round(planBudget * shape.mix.recall),
    transfer: Math.round(planBudget * shape.mix.transfer),
  };

  // Course reviews are retention on the other track and belong in the review band, but they may
  // never crowd out question revision — half the band is the ceiling.
  let courseAllowance = Math.floor(allowance.review / 2);
  for (const review of [...courseReviews].sort((a, b) => b.overdueDays - a.overdueDays)) {
    if (review.minutes > courseAllowance || review.minutes > pot) continue;
    bands.review.push({
      id: `course-review-${review.weekId}`,
      kind: 'course-review',
      title: review.title,
      prompt: 'Recall the week from memory before reopening the notes.',
      why:
        review.overdueDays > 0
          ? `Waiting ${review.overdueDays} ${plural(review.overdueDays, 'day', 'days')} on the AI/ML ladder.`
          : 'Due for recall on the AI/ML ladder.',
      minutes: review.minutes,
      load: 1,
      href: '/aiml',
      weekId: review.weekId,
    });
    courseAllowance -= review.minutes;
    pot -= review.minutes;
    spent += review.minutes;
    rationale.retention++;
  }

  for (const depth of order) {
    let bandLeft = Math.min(allowance[depth], pot);
    if (bandLeft <= 0) continue;

    for (const item of scored) {
      if (taken.has(item.candidate.question.id)) continue;
      // Not-due items are surplus material; they are considered only after the due work is placed.
      if (item.candidate.overdueDays < 0) continue;

      const minutes = depthMinutes(item.candidate.question, depth);
      if (minutes > bandLeft) continue;

      const load = activityLoad(item.candidate.question.difficulty, depth);
      if (load >= HEAVY_LOAD) {
        if (heavyUsed >= maxHeavy) continue;
        heavyUsed++;
      }

      bands[depth].push(toActivity(item, depth, minutes, load));
      taken.add(item.candidate.question.id);
      bandLeft -= minutes;
      pot -= minutes;
      spent += minutes;

      if (item.candidate.overdueDays > 0) rationale.overdue++;
      else rationale.due++;
      if (item.reason === 'weak-pattern') rationale.weakness++;
    }
  }

  // --- Transfer -----------------------------------------------------------------------------
  // Weak-pattern families first: an unfamiliar problem is worth most where recognition is worst.
  let transferLeft = Math.min(allowance.transfer, pot);
  const rankedTransfer = [...transfer].sort(
    (a, b) => (weak.get(b.question.pattern)?.score ?? 0) - (weak.get(a.question.pattern)?.score ?? 0),
  );
  for (const item of rankedTransfer) {
    const minutes = depthMinutes(item.question, 'transfer');
    if (minutes > transferLeft) continue;
    const load = activityLoad(item.question.difficulty, 'transfer');
    if (load >= HEAVY_LOAD) {
      if (heavyUsed >= maxHeavy) continue;
      heavyUsed++;
    }
    bands.transfer.push({
      id: `transfer-${item.question.id}`,
      kind: 'transfer',
      title: item.question.title,
      prompt: DEPTH_PROMPT.transfer,
      why: `Same idea as ${item.fromTitle}, wearing a different disguise — that is the ${item.familyName} family.`,
      minutes,
      load,
      href: '/revision',
      questionId: item.question.id,
      pattern: item.question.pattern,
    });
    transferLeft -= minutes;
    pot -= minutes;
    spent += minutes;
    rationale.transfer++;
  }

  // --- Surplus ------------------------------------------------------------------------------
  // Due work ran out before the budget did. Fill forward rather than pad: pull the nearest
  // upcoming reviews in early, which costs nothing on the ladder and buys a quieter tomorrow.
  let usedSurplus = false;
  const MIN_USEFUL_SLOT = 5;
  if (pot >= MIN_USEFUL_SLOT) {
    const pullForward = scored
      .filter((s) => s.candidate.overdueDays < 0 && !taken.has(s.candidate.question.id))
      .sort((a, b) => b.candidate.overdueDays - a.candidate.overdueDays);
    for (const item of pullForward) {
      const depth: Depth = shape.mix.review > 0 ? 'review' : 'recall';
      const minutes = depthMinutes(item.candidate.question, depth);
      if (minutes > pot) continue;
      const load = activityLoad(item.candidate.question.difficulty, depth);
      if (load >= HEAVY_LOAD) {
        if (heavyUsed >= maxHeavy) continue;
        heavyUsed++;
      }
      bands[depth].push(toActivity(item, depth, minutes, load));
      taken.add(item.candidate.question.id);
      pot -= minutes;
      spent += minutes;
      usedSurplus = true;
    }
  }

  // --- Compose the arc ----------------------------------------------------------------------
  // `balance` spaces heavy items out inside each band; `enforceSpacing` then holds the rule
  // across band boundaries and inside a band that had no light material to separate with.
  const composed: SessionActivity[] = [
    ...(drillActivity ? [drillActivity] : []),
    ...balance(bands.recall),
    ...balance(bands.review),
    ...balance(bands.deep),
    ...balance(bands.transfer),
  ];
  const activities = enforceSpacing(composed, (dropped) => {
    // Put it back in the pool so the deferred list picks it up and the learner can see it was
    // considered rather than lost.
    if (dropped.questionId !== undefined) taken.delete(dropped.questionId);
  });

  if (activities.length > 0 && reflectReserve > 0) {
    activities.push({
      id: 'reflect',
      kind: 'reflect',
      title: 'Close the session',
      prompt: 'Name the one idea from this session you would want back in a week.',
      why: 'Writing it down at the end is what turns a session into something you can return to.',
      minutes: REFLECT_MINUTES,
      load: 0,
      href: '/revision',
    });
    spent += REFLECT_MINUTES;
  }

  const deferred = scored
    .filter((s) => s.candidate.overdueDays >= 0 && !taken.has(s.candidate.question.id))
    .map((s) => s.candidate);

  const focus = Array.from(
    new Set(activities.map((a) => a.pattern).filter((p): p is PatternId => Boolean(p))),
  );

  return {
    budgetMin,
    shape,
    activities,
    totalMinutes: activities.reduce((sum, a) => sum + a.minutes, 0),
    totalLoad: Math.round(activities.reduce((sum, a) => sum + a.load, 0) * 10) / 10,
    focus,
    rationale,
    deferred,
    usedSurplus,
  };
}

function toActivity(item: Scored, depth: Depth, minutes: number, load: number): SessionActivity {
  const { question } = item.candidate;
  return {
    id: `${depth}-${question.id}`,
    kind: depth,
    title: question.title,
    prompt: DEPTH_PROMPT[depth],
    why: reasonText(item),
    minutes,
    load,
    href: '/revision',
    questionId: question.id,
    pattern: question.pattern,
  };
}

/**
 * Space the heavy items out within a band. Two hard problems back to back is where a session
 * stops being finished, so the light items are dealt between them.
 */
function balance(items: SessionActivity[]): SessionActivity[] {
  const heavy = items.filter((i) => i.load >= HEAVY_LOAD);
  const light = items.filter((i) => i.load < HEAVY_LOAD);
  if (heavy.length === 0 || light.length === 0) return items;

  const out: SessionActivity[] = [];
  // Open on something light, then alternate for as long as there is a light item to separate
  // with; whatever is left tails on the end.
  while (light.length > 0 || heavy.length > 0) {
    if (light.length > 0) out.push(light.shift()!);
    if (heavy.length > 0) out.push(heavy.shift()!);
  }
  return out;
}

/**
 * The last word on cognitive load: two heavy items never sit next to each other in a session.
 *
 * By the time this runs, `balance` has already interleaved whatever light material each band had.
 * An adjacency surviving that means the session genuinely has nothing left to separate the pair
 * with — a band of four hard dynamic-programming reviews, say — and the right answer there is to
 * plan less, not to plan an evening nobody finishes. The dropped item is returned to the deferred
 * list, so it is visibly waiting rather than quietly gone.
 */
function enforceSpacing(
  activities: SessionActivity[],
  onDrop: (dropped: SessionActivity) => void,
): SessionActivity[] {
  const out: SessionActivity[] = [];
  for (const activity of activities) {
    const previous = out[out.length - 1];
    if (previous && previous.load >= HEAVY_LOAD && activity.load >= HEAVY_LOAD) {
      onDrop(activity);
      continue;
    }
    out.push(activity);
  }
  return out;
}

/**
 * How far through the session the learner is — in minutes and in activities, because "3 of 10"
 * says nothing about whether the evening is nearly over.
 */
export function sessionProgress(
  session: RevisionSession,
  doneIds: string[],
): { doneCount: number; totalCount: number; doneMinutes: number; totalMinutes: number } {
  const done = new Set(doneIds);
  const completed = session.activities.filter((a) => done.has(a.id));
  return {
    doneCount: completed.length,
    totalCount: session.activities.length,
    doneMinutes: completed.reduce((sum, a) => sum + a.minutes, 0),
    totalMinutes: session.totalMinutes,
  };
}
