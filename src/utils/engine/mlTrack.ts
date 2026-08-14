// The ML implementation tracks as a worked ladder, not a reading list.
//
// The eleven tracks (src/data/mlTracks.json) shipped as verified content — derivation, a numpy
// implementation, the library equivalent, a measured experiment, and the ways each one breaks —
// with no way to record having done any of it. Content the learner cannot mark is content the
// product cannot schedule, and an implementation you wrote once and never rebuilt is exactly the
// kind of knowledge that quietly leaves.
//
// Two decisions carry this module:
//
// 1. THE LADDER IS ENTERED AT THE SCRATCH RUNG. Deriving the maths is reading; writing the thing
//    in numpy is the first moment there is something to forget. So the 1/3/7/15/30 ladder starts
//    when `scratch` is stamped, and a review means rebuilding the core loop from a blank file and
//    grading yourself — not "do you remember attention?", which anyone can answer yes to.
//
// 2. RUNGS ARE STAMPED ONCE. A stamp is a date, not a counter, and re-pressing it does nothing.
//    XP is paid on the first stamp only, which is what keeps a work register from becoming a
//    farm — the anti-gamification rule the whole product runs on.
//
// One ladder, shared: this module wraps `spacedRepetition` exactly as `aimlCourse` does. It is
// not a second scheduler, and there must never be one.
//
// Pure and deterministic like every engine module: ISO date strings in, no clock, no store.
import type { MlProjectProgress, MlTrackProgress } from '@/types';
import { ML_RUNG_IDS, ML_TRACK_TITLES } from '@/data/mlTrackIndex';
import {
  MASTERED_STAGE,
  isLadderDue,
  ladderAfterReview,
  ladderEntry,
} from '@/utils/engine/spacedRepetition';

/* ------------------------------------------------------------------------------------------- */
/* The work register                                                                            */
/* ------------------------------------------------------------------------------------------- */

/**
 * XP for a rung, a cleared track, and a rebuild.
 *
 * Proportionate to the course's 20 / 50 / 10 rather than invented from nothing. A course session
 * is a two-hour sitting and pays 20; a track rung is a smaller unit of real work — deriving the
 * gradient, or writing the numpy — so 15. Clearing a whole track matches the week-clear bonus
 * because it is the same kind of event: a body of work finished. A rebuild pays what a course
 * review pays, because it is the same act.
 */
export const ML_RUNG_XP = 15;
export const ML_TRACK_CLEAR_BONUS = 50;
export const ML_REBUILD_XP = 10;

/** The rung the ladder starts from. Named once here so the decision has one home. */
export const ML_LADDER_RUNG = 'scratch';

export function initialMlTrackProgress(): MlTrackProgress {
  return {
    rungs: {},
    revisionStage: 0,
    nextRevision: null,
    lastReviewed: null,
    revisionHistory: [],
  };
}

export function initialMlProjectProgress(): MlProjectProgress {
  return { startedOn: null, shippedOn: null };
}

/** Sparse-map access with the mandatory fallback, so no reader has to remember it. */
export function mlTrackProgressFor(
  byTrackId: Record<string, MlTrackProgress>,
  trackId: string,
): MlTrackProgress {
  return byTrackId[trackId] ?? initialMlTrackProgress();
}

/** Fills in fields absent from older payloads. The load-boundary normalizer. */
export function normalizeMlTrackProgress(raw: Partial<MlTrackProgress>): MlTrackProgress {
  const base = initialMlTrackProgress();
  return {
    rungs: { ...(raw.rungs ?? base.rungs) },
    revisionStage: raw.revisionStage ?? base.revisionStage,
    nextRevision: raw.nextRevision ?? base.nextRevision,
    lastReviewed: raw.lastReviewed ?? base.lastReviewed,
    revisionHistory: [...(raw.revisionHistory ?? base.revisionHistory)],
  };
}

export const isRungDone = (progress: MlTrackProgress, rungId: string): boolean =>
  typeof progress.rungs[rungId] === 'string';

/**
 * Every rung stamped. The track has been worked all the way through at least once.
 *
 * Reads the rung list from `mlTrackIndex` rather than from the track object, so nothing on this
 * path needs the 275 kB of track content — see that module's header for why that matters.
 */
export function isTrackClear(progress: MlTrackProgress): boolean {
  return ML_RUNG_IDS.every((rung) => isRungDone(progress, rung));
}

export function rungsDone(progress: MlTrackProgress): number {
  return ML_RUNG_IDS.filter((rung) => isRungDone(progress, rung)).length;
}

/* ------------------------------------------------------------------------------------------- */
/* The ladder                                                                                    */
/* ------------------------------------------------------------------------------------------- */

/**
 * Stamp a rung. Returns the same object when the rung is already stamped, so callers can treat an
 * unchanged reference as "nothing happened" and pay no XP for it.
 */
export function applyMlRung(
  progress: MlTrackProgress,
  rungId: string,
  date: string,
): MlTrackProgress {
  if (isRungDone(progress, rungId)) return progress;
  const next: MlTrackProgress = { ...progress, rungs: { ...progress.rungs, [rungId]: date } };
  // Entering the ladder is a property of the scratch rung, not of finishing the track: what a
  // review asks you to rebuild is the implementation, and that exists from this rung onward.
  return rungId === ML_LADDER_RUNG ? { ...next, ...ladderEntry(date) } : next;
}

export function applyMlRebuild(
  progress: MlTrackProgress,
  date: string,
  passed: boolean,
): MlTrackProgress {
  return {
    ...progress,
    lastReviewed: date,
    revisionHistory: [...progress.revisionHistory, { date, passed }],
    ...ladderAfterReview(progress.revisionStage, date, passed),
  };
}

export const isTrackRetained = (progress: MlTrackProgress): boolean =>
  progress.revisionStage >= MASTERED_STAGE;

/** One grade per track per calendar date — reruns are practice, exactly as drills and recall are. */
export function isRebuiltOn(progress: MlTrackProgress, date: string): boolean {
  return progress.revisionHistory.some((event) => event.date === date);
}

/**
 * Tracks on the ladder and not yet retained, each tagged with its track — the population every
 * revision surface (forecast, upcoming, the day plan) reads.
 */
export function mlLadderItems(
  byTrackId: Record<string, MlTrackProgress>,
): (MlTrackProgress & { trackId: string })[] {
  // Iterates the PROGRESS map, not the catalog: only a track whose scratch rung is stamped can be
  // on the ladder, and every one of those exists here by construction.
  return Object.entries(byTrackId)
    .map(([trackId, progress]) => ({ trackId, ...progress }))
    .filter((item) => isRungDone(item, ML_LADDER_RUNG) && !isTrackRetained(item));
}

/** Tracks whose rebuild date has arrived — earliest first, then track order. */
export function dueMlTrackIds(
  byTrackId: Record<string, MlTrackProgress>,
  today: string,
): string[] {
  return Object.entries(byTrackId)
    .filter(
      ([, progress]) => isRungDone(progress, ML_LADDER_RUNG) && isLadderDue(progress, today),
    )
    // Earliest due first; the track id breaks ties, so the order is stable across reloads rather
    // than dependent on object key order.
    .sort(([idA, a], [idB, b]) =>
      a.nextRevision! < b.nextRevision! ? -1 : a.nextRevision! > b.nextRevision! ? 1 : idA < idB ? -1 : 1,
    )
    .map(([trackId]) => trackId);
}

/* ------------------------------------------------------------------------------------------- */
/* Activity                                                                                     */
/* ------------------------------------------------------------------------------------------- */

/**
 * Track work per calendar date, derived rather than logged — the `courseActivityByDate` contract,
 * for the same reason: DayLog stays a DSA-only ledger, and deriving retroactively credits work
 * done before this channel existed.
 */
export function mlActivityByDate(
  tracksById: Record<string, MlTrackProgress>,
  projectsById: Record<string, MlProjectProgress> = {},
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (date: string | null | undefined) => {
    if (typeof date === 'string' && date !== '') counts.set(date, (counts.get(date) ?? 0) + 1);
  };
  for (const progress of Object.values(tracksById)) {
    for (const date of Object.values(progress.rungs)) bump(date);
    for (const review of progress.revisionHistory) bump(review.date);
  }
  for (const project of Object.values(projectsById)) {
    bump(project.startedOn);
    bump(project.shippedOn);
  }
  return counts;
}

/** How much of the eleven-track ladder has been worked, for the page's one progress line. */
export interface MlTrackStanding {
  tracksTouched: number;
  tracksClear: number;
  rungsDone: number;
  rungsTotal: number;
}

export function mlStanding(byTrackId: Record<string, MlTrackProgress>): MlTrackStanding {
  let touched = 0;
  let clear = 0;
  let done = 0;
  for (const trackId of Object.keys(ML_TRACK_TITLES)) {
    const progress = mlTrackProgressFor(byTrackId, trackId);
    const doneHere = rungsDone(progress);
    done += doneHere;
    if (doneHere > 0) touched += 1;
    if (doneHere === ML_RUNG_IDS.length) clear += 1;
  }
  return {
    tracksTouched: touched,
    tracksClear: clear,
    rungsDone: done,
    rungsTotal: Object.keys(ML_TRACK_TITLES).length * ML_RUNG_IDS.length,
  };
}
