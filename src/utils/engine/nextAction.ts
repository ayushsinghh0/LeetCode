// What to do next — the product's answer to the only question the daily surface has to answer.
//
// ONE ranker, two consumers. The "next best action" hero is `rankWork(...)[0]`; the "I have N
// minutes" planner is a greedy pack over the same ordered list. Deriving both from one function
// is the point: a hero card that recommends a revision while the session plan opens with a new
// question is a product that does not know its own mind, and that is exactly the failure mode
// two independently-tuned heuristics produce.
//
// Ordering principle, in one line: retention work outranks acquisition, because a lapsed review
// is knowledge actively being lost while an unsolved question is merely knowledge not yet gained.
// Within retention, the most-overdue item wins. Recognition drills sit high despite being small
// because they are the cheapest diagnostic in the product — a few minutes that tell the learner
// (and this ranker) which patterns are actually weak.
//
// Pure and deterministic like every engine module: no clock, no store, ISO date strings in.
import type { DailyTask, Question } from '@/types';

export type ActionKind =
  | 'revision'
  | 'drill'
  | 'course-review'
  | 'course-session'
  | 'new-question'
  | 'task'
  | 'done';

export interface WorkItem {
  /** Stable React key and dedupe handle. */
  id: string;
  kind: ActionKind;
  /** The specific thing to do — a problem title or a week name, never a category. */
  title: string;
  /** Why this one, in the learner's terms. Always concrete; never pressure. */
  why: string;
  minutes: number;
  href: string;
  questionId?: number;
  weekId?: string;
  taskId?: string;
}

export interface WorkInput {
  /**
   * Question revisions in today's queue. `overdueDays` is days past the scheduled date (0 = due
   * today); `intervalDays` is the ladder gap that just elapsed, so the reason can name it.
   *
   * `topUp` marks a weekly-revision-day extra: those are NOT due — they are pulled forward from
   * future dates — so they must not be given a reason that asserts a schedule fact the schedule
   * contradicts.
   */
  revisions: {
    question: Question;
    overdueDays: number;
    intervalDays: number;
    minutes: number;
    topUp: boolean;
  }[];
  /** Today's unsolved new-question slice, in roadmap order. */
  newQuestions: { question: Question; minutes: number }[];
  /**
   * `eligible` gates the drill out until there is something to recognize. Asking a learner on
   * day one to name the technique behind eight problems they have never seen is not a
   * diagnostic, it is a guessing game — and its result would then mis-weight every later drill.
   */
  drill: {
    eligible: boolean;
    doneToday: boolean;
    /**
     * The pattern with the most cumulative recognition-drill misses — i.e. what actually weights
     * `buildDrill`. Deliberately NOT the product's weakness signal: `selectPatternWeakness` is the
     * one place weakness is claimed, and this field must never be described as one (see the copy
     * in `rankWork`). It is named for what it measures so the two cannot be confused again.
     */
    missedMostPatternName: string | null;
    minutes: number;
  };
  course: {
    dueReviews: { weekId: string; title: string; minutes: number }[];
    nextSession: { weekId: string; title: string; minutes: number } | null;
  };
  openTasks: DailyTask[];
  taskDefaultMinutes: number;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Everything worth doing today, most valuable first.
 *
 * Deliberately returns items, not categories: "Revise Merge Intervals" is actionable, "3
 * revisions due" is a status line. The daily surface shows the head of this list large and the
 * tail small, which is the whole hierarchy.
 */
export function rankWork(input: WorkInput): WorkItem[] {
  const items: WorkItem[] = [];

  // 1. Revisions, most overdue first. Ties broken by question id via the caller's ordering.
  // Genuinely due work first, top-ups after — a pulled-forward extra should never outrank an
  // item whose date has actually arrived.
  const revisions = [...input.revisions].sort((a, b) => {
    if (a.topUp !== b.topUp) return a.topUp ? 1 : -1;
    if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
    return a.question.id - b.question.id;
  });
  for (const { question, overdueDays, intervalDays, minutes, topUp } of revisions) {
    items.push({
      id: `revision-${question.id}`,
      kind: 'revision',
      title: question.title,
      // Factual, never loss-framed. "You're about to lose this!" is the streak-anxiety register
      // this product does not use; stating what the schedule is for does the same job honestly.
      why: topUp
        ? 'Pulled forward for the weekly review — not due yet, and reviewing early costs nothing on the ladder.'
        : overdueDays > 0
          ? `Waiting ${overdueDays} ${plural(overdueDays, 'day', 'days')} past its ${intervalDays}-day step — recall pays most right after the gap.`
          : `Today is the ${intervalDays}-day step — re-deriving now is worth more than a new problem.`,
      minutes,
      href: '/revision',
      questionId: question.id,
    });
  }

  // 2. The day's recognition drill. Small, and the only thing here that measures rather than
  //    teaches — so it earns its place above new material even on a heavy day.
  if (input.drill.eligible && !input.drill.doneToday) {
    items.push({
      id: 'drill',
      kind: 'drill',
      title: 'Recognition drill',
      // This sentence names the drill's OWN basis and nothing wider. It used to read "where your
      // recent answers have been shakiest" — a weakness claim, worded identically to the one
      // `session.ts` emits, but resolved from a different source: the drill is weighted by raw
      // cumulative drill misses (locked spec), while every weakness claim in the product comes
      // from `selectPatternWeakness`. The two disagree the moment an old drill miss outweighs a
      // fresh failure, and the learner read Today and Revision naming different weakest patterns
      // in the same sitting. "Recent" was false too: the drill tally has no recency decay.
      why: input.drill.missedMostPatternName
        ? `Weighted toward ${input.drill.missedMostPatternName} — the pattern you have missed most in past recognition drills.`
        : 'A few minutes of naming patterns on sight — the skill an interview actually starts with.',
      minutes: input.drill.minutes,
      href: '/drills',
    });
  }

  // 3. Course reviews — retention work on the other track, same logic as question revisions.
  for (const review of input.course.dueReviews) {
    items.push({
      id: `course-review-${review.weekId}`,
      kind: 'course-review',
      title: review.title,
      why: 'Due for recall on the AI/ML ladder.',
      minutes: review.minutes,
      href: '/aiml',
      weekId: review.weekId,
    });
  }

  // 4. New questions — acquisition. Ordered as the roadmap ordered them.
  for (const { question, minutes } of input.newQuestions) {
    items.push({
      id: `new-${question.id}`,
      kind: 'new-question',
      title: question.title,
      why: question.tests,
      minutes,
      href: '/today',
      questionId: question.id,
    });
  }

  // 5. The next course session — a long block, so it ranks below the short high-value work.
  if (input.course.nextSession) {
    items.push({
      id: `course-session-${input.course.nextSession.weekId}`,
      kind: 'course-session',
      title: input.course.nextSession.title,
      why: 'Keeps the two-day sprint moving.',
      minutes: input.course.nextSession.minutes,
      href: '/aiml',
      weekId: input.course.nextSession.weekId,
    });
  }

  // 6. The learner's own tasks last — they set these themselves and know their urgency better
  //    than this ranker does; it would be presumptuous to slot them among the learning work.
  for (const task of input.openTasks) {
    items.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      why: 'On your own list for today.',
      minutes: task.estMinutes ?? input.taskDefaultMinutes,
      href: '/today',
      taskId: task.id,
    });
  }

  return items;
}

export interface Session {
  items: WorkItem[];
  totalMinutes: number;
  budgetMin: number;
  /** Budget left after packing — surfaced so the UI can say "~10 min spare" honestly. */
  leftoverMin: number;
  /** Items that were ranked above something included, but did not fit the budget. */
  skipped: WorkItem[];
}

/**
 * "I have N minutes" — the best use of exactly that much time.
 *
 * Greedy over the ranked list with a fits-in-remaining test, rather than a knapsack. That is a
 * deliberate choice: an optimal packing would happily drop the most valuable item to squeeze in
 * two cheap ones, and "the plan skipped your overdue review to fit two easy questions" is a
 * worse product than a few unused minutes. Skipped items are reported, never silently dropped.
 */
export function buildSession(budgetMin: number, ranked: WorkItem[]): Session {
  const items: WorkItem[] = [];
  const skipped: WorkItem[] = [];
  let remaining = budgetMin;

  for (const item of ranked) {
    if (item.minutes <= remaining) {
      items.push(item);
      remaining -= item.minutes;
    } else {
      skipped.push(item);
    }
  }

  const totalMinutes = budgetMin - remaining;
  return { items, totalMinutes, budgetMin, leftoverMin: remaining, skipped };
}

/**
 * The capacity presets the daily surface offers, in minutes. Includes the 180-minute default so
 * a learner who has never touched the chips still sees their own budget selected rather than an
 * unexplained gap. The chips write the same `settings.dailyCapacityMin` the Settings page edits —
 * one concept, two places to change it, never two competing numbers.
 */
export const SESSION_PRESETS = [15, 30, 60, 90, 120, 180] as const;

/** Solves before a recognition drill has anything to measure. */
export const DRILL_MIN_SOLVED = 5;
