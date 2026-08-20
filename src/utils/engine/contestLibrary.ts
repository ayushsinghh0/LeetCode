// The contest library's pure core — bands, one filter predicate, the indexes, and the revision
// pool. Pure and deterministic like every engine module: ISO date strings in, no clock, no store,
// no React, no network.
//
// This module deliberately does NOT import `@/data/contestLibrary`. The dataset is 336 kB in its
// own bundle chunk and every caller here already has the problems in hand; importing it would
// drag the chunk into whatever imports this file, with no error and no failing test — only a
// bigger bundle. Pool in, answer out.
//
// WHAT THIS MODULE IS FOR, in one line: the directive's §64 — the value is not the database, it
// is knowing which contest problem to practise next. `filterContestProblems` answers "what
// matches"; `contestRevisionPool` answers "what is worth doing now", and those are different
// questions with different rules.
import type {
  ContestLibraryProblem,
  ContestProblemProgress,
  Difficulty,
  MappingConfidence,
  PatternId,
  QuestionProgress,
  RatingBand,
} from '@/types';
import { diffDays } from '@/utils/dates';
import { isLadderDue, ladderAfterReview, ladderEntry } from '@/utils/engine/spacedRepetition';

/* ------------------------------------------------------------------------------------------- */
/* Rating bands                                                                                 */
/* ------------------------------------------------------------------------------------------- */

/**
 * Bands are data, not literals in JSX (directive §12), and they are deliberately coarse.
 *
 * A 100-point band would be more precise and less useful: contest ratings carry real estimation
 * error, and a learner choosing "1500–1599" would be selecting noise. 200-point bands are wide
 * enough that "I am comfortable here" is a claim the evidence can actually support.
 */
export const RATING_BANDS: RatingBand[] = [
  { id: 'u1200', label: 'Under 1200', min: 0, max: 1199 },
  { id: '1200', label: '1200–1399', min: 1200, max: 1399 },
  { id: '1400', label: '1400–1599', min: 1400, max: 1599 },
  { id: '1600', label: '1600–1799', min: 1600, max: 1799 },
  { id: '1800', label: '1800–1999', min: 1800, max: 1999 },
  { id: '2000', label: '2000–2199', min: 2000, max: 2199 },
  { id: '2200', label: '2200+', min: 2200, max: Infinity },
];

export function ratingBand(rating: number): RatingBand {
  return RATING_BANDS.find((b) => rating >= b.min && rating <= b.max) ?? RATING_BANDS[0]!;
}

export function bandById(id: string): RatingBand | undefined {
  return RATING_BANDS.find((b) => b.id === id);
}

/* ------------------------------------------------------------------------------------------- */
/* Learner state                                                                                */
/* ------------------------------------------------------------------------------------------- */

/**
 * What the learner has done with one contest problem, in the shape the engine needs.
 *
 * Deliberately structural rather than the slice's own type: the engine must stay usable from a
 * test that hand-builds three objects, and must not know that a Redux slice exists.
 */
export interface ContestProblemState {
  solved: boolean;
  attempts: number;
  lastAttemptedOn: string | null;
  solvedOn: string | null;
  /** Ladder position, shared with questions and course weeks. */
  revisionStage: number;
  nextRevision: string | null;
}

export type ProgressLookup = (slug: string) => ContestProblemState | undefined;

/**
 * The bridged problems' read-through: a curriculum question's progress, in contest-state shape.
 *
 * The 207 problems that are both rated contest problems and curriculum questions keep their one
 * record in `progress.byId` (one problem, one identity, never a second copy), so any surface
 * filtering the library needs that record translated into `ContestProblemState`. This is the one
 * translation, shared by the Library page and Contest Revision, because two ad-hoc mappings would
 * eventually disagree about what "attempted" means for a bridged problem.
 *
 * `attempts` is a floor, not a count — the curriculum register never counted attempts, so the
 * honest translation is "worked on at least once" (solved or in progress) versus "untouched".
 */
export function contestStateFromQuestionProgress(
  qp: Pick<QuestionProgress, 'status' | 'revisionStage' | 'nextRevision' | 'completedAt'>,
): ContestProblemState {
  const solved = qp.status === 'solved';
  return {
    solved,
    attempts: solved || qp.status === 'in_progress' ? 1 : 0,
    lastAttemptedOn: qp.completedAt,
    solvedOn: qp.completedAt,
    revisionStage: qp.revisionStage,
    nextRevision: qp.nextRevision,
  };
}

/**
 * The sentence every surface showing a contest rating must be able to reach.
 *
 * It lives HERE, not in `@/data/contestLibrary`, because the run surface (`ContestPage`) shows
 * ratings from the sitting's snapshot and is forbidden to import the 336 kB dataset — a basis
 * sentence locked inside the data chunk would leave that surface's claim unexplainable. The data
 * module re-exports it for its own importers.
 */
export const CONTEST_RATING_NOTE =
  'Estimated contest difficulty from ZeroTrac. Useful for relative comparison; not an official LeetCode rating.';

/**
 * Target minutes for a contest-library problem with no authored estimate, keyed by official
 * difficulty. Explicit constants in the `engine/planner.ts` discipline — the UI writes `~`
 * before every figure built on these. The values are the midpoints of the authored curriculum
 * bands (easy 8–20, medium 20–35, hard 35–60): honest defaults for 2,354 unauthored problems,
 * never a claim about any one of them. A bridged problem uses its own authored estimate instead.
 */
export const CONTEST_TARGET_MINUTES: Record<Difficulty, number> = {
  easy: 14,
  medium: 28,
  hard: 48,
};

/* ------------------------------------------------------------------------------------------- */
/* Filtering — ONE predicate                                                                    */
/* ------------------------------------------------------------------------------------------- */

export type CurriculumStatus = 'curriculum' | 'contest-only';
export type ProgressStatus = 'unsolved' | 'solved' | 'never-attempted' | 'attempted' | 'due';

/**
 * Every filter dimension, all optional. Absent means unconstrained; an empty array means the same
 * thing, so a UI that clears a multi-select does not accidentally ask for nothing.
 *
 * There is exactly one predicate over this object (directive §19). A function per combination
 * would be sixty functions that can each disagree with the others about what "unsolved" means.
 */
export interface ContestFilter {
  contestType?: ('weekly' | 'biweekly')[];
  problemIndex?: number[];
  ratingBands?: string[];
  ratingMin?: number;
  ratingMax?: number;
  difficulty?: Difficulty[];
  leetcodeTopics?: string[];
  aicmPatterns?: PatternId[];
  aicmSubpatterns?: string[];
  curriculumStatus?: CurriculumStatus[];
  progress?: ProgressStatus[];
  /** Substring match on title. Case-insensitive. */
  search?: string;
  includePremium?: boolean;
  /**
   * Allow `heuristic` mappings to satisfy a pattern filter. Off by default and off in every
   * shipped surface: an inferred pattern is shown to the learner as inferred and never used to
   * claim a problem *is* that pattern. The flag exists so the Library can offer "include
   * inferred" explicitly, which is the learner choosing to widen, not the app pretending.
   */
  includeInferredPatterns?: boolean;
}

const hasAny = <T,>(list: T[] | undefined): list is T[] => Array.isArray(list) && list.length > 0;
const overlaps = <T,>(a: readonly T[], b: readonly T[]): boolean => a.some((x) => b.includes(x));

function matchesProgress(
  status: ProgressStatus,
  state: ContestProblemState | undefined,
  today: string,
): boolean {
  switch (status) {
    case 'unsolved':
      return !state?.solved;
    case 'solved':
      return state?.solved === true;
    case 'never-attempted':
      return state === undefined || state.attempts === 0;
    case 'attempted':
      return (state?.attempts ?? 0) > 0;
    case 'due':
      return (
        state !== undefined && state.nextRevision !== null && state.nextRevision <= today
      );
  }
}

/**
 * Everything in `pool` satisfying EVERY active constraint. Order is preserved from the pool, so
 * a caller that wants a particular ordering sorts afterwards rather than depending on this.
 */
export function filterContestProblems(
  pool: readonly ContestLibraryProblem[],
  filter: ContestFilter,
  progress: ProgressLookup = () => undefined,
  today = '',
): ContestLibraryProblem[] {
  const search = filter.search?.trim().toLowerCase() ?? '';

  return pool.filter((p) => {
    if (filter.includePremium === false && p.premium) return false;
    if (hasAny(filter.contestType) && !filter.contestType.includes(p.contest.type as 'weekly')) return false;
    if (hasAny(filter.problemIndex) && !filter.problemIndex.includes(p.contest.index)) return false;
    if (hasAny(filter.difficulty) && !filter.difficulty.includes(p.officialDifficulty)) return false;

    if (filter.ratingMin !== undefined && p.contestRating < filter.ratingMin) return false;
    if (filter.ratingMax !== undefined && p.contestRating > filter.ratingMax) return false;
    if (hasAny(filter.ratingBands)) {
      const band = ratingBand(p.contestRating);
      if (!filter.ratingBands.includes(band.id)) return false;
    }

    if (hasAny(filter.leetcodeTopics) && !overlaps(p.leetcodeTopics, filter.leetcodeTopics)) return false;

    if (hasAny(filter.aicmPatterns)) {
      const claimed: PatternId[] = filter.includeInferredPatterns
        ? [...p.aicmPatterns, ...p.inferredPatterns]
        : p.aicmPatterns;
      if (!overlaps(claimed, filter.aicmPatterns)) return false;
    }
    if (hasAny(filter.aicmSubpatterns) && !overlaps(p.aicmSubpatterns, filter.aicmSubpatterns)) return false;

    if (hasAny(filter.curriculumStatus)) {
      const status: CurriculumStatus = p.curriculumQuestionId !== null ? 'curriculum' : 'contest-only';
      if (!filter.curriculumStatus.includes(status)) return false;
    }

    if (hasAny(filter.progress)) {
      const state = progress(p.slug);
      // Several progress chips together read as "any of these", which is how a filter row with
      // multiple pills is universally understood.
      if (!filter.progress.some((s) => matchesProgress(s, state, today))) return false;
    }

    if (search !== '' && !p.title.toLowerCase().includes(search)) return false;

    return true;
  });
}

/** True when any dimension is actually constraining. Drives the "Clear filters" affordance. */
export function isFilterActive(filter: ContestFilter): boolean {
  return (
    hasAny(filter.contestType) ||
    hasAny(filter.problemIndex) ||
    hasAny(filter.ratingBands) ||
    hasAny(filter.difficulty) ||
    hasAny(filter.leetcodeTopics) ||
    hasAny(filter.aicmPatterns) ||
    hasAny(filter.aicmSubpatterns) ||
    hasAny(filter.curriculumStatus) ||
    hasAny(filter.progress) ||
    filter.ratingMin !== undefined ||
    filter.ratingMax !== undefined ||
    (filter.search ?? '').trim() !== '' ||
    filter.includePremium === false ||
    filter.includeInferredPatterns === true
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Indexes                                                                                      */
/* ------------------------------------------------------------------------------------------- */

/**
 * Precomputed lookups so no React render ever scans 2,561 records (directive §11, §52).
 *
 * Built once per pool identity and memoized by the caller. Every value is a slug list rather than
 * a problem list: slugs are cheap to hold, and the caller already has `bySlug`.
 */
export interface ContestIndex {
  bySlug: Map<string, ContestLibraryProblem>;
  byFrontendId: Map<number, ContestLibraryProblem>;
  byContest: Map<string, string[]>;
  byContestType: Map<string, string[]>;
  byProblemIndex: Map<number, string[]>;
  byRatingBand: Map<string, string[]>;
  byDifficulty: Map<Difficulty, string[]>;
  byLeetcodeTopic: Map<string, string[]>;
  byAicmPattern: Map<PatternId, string[]>;
  byAicmSubpattern: Map<string, string[]>;
  byCurriculumStatus: Map<CurriculumStatus, string[]>;
  byMappingConfidence: Map<MappingConfidence, string[]>;
  /** Every topic that actually appears, sorted by frequency — the filter UI's option list. */
  topicsByFrequency: { topic: string; count: number }[];
}

const push = <K,>(map: Map<K, string[]>, key: K, slug: string): void => {
  const list = map.get(key);
  if (list) list.push(slug);
  else map.set(key, [slug]);
};

export function buildContestIndex(pool: readonly ContestLibraryProblem[]): ContestIndex {
  const index: ContestIndex = {
    bySlug: new Map(),
    byFrontendId: new Map(),
    byContest: new Map(),
    byContestType: new Map(),
    byProblemIndex: new Map(),
    byRatingBand: new Map(),
    byDifficulty: new Map(),
    byLeetcodeTopic: new Map(),
    byAicmPattern: new Map(),
    byAicmSubpattern: new Map(),
    byCurriculumStatus: new Map(),
    byMappingConfidence: new Map(),
    topicsByFrequency: [],
  };

  for (const p of pool) {
    index.bySlug.set(p.slug, p);
    index.byFrontendId.set(p.frontendId, p);
    push(index.byContest, p.contest.slug, p.slug);
    push(index.byContestType, p.contest.type, p.slug);
    push(index.byProblemIndex, p.contest.index, p.slug);
    push(index.byRatingBand, ratingBand(p.contestRating).id, p.slug);
    push(index.byDifficulty, p.officialDifficulty, p.slug);
    for (const t of p.leetcodeTopics) push(index.byLeetcodeTopic, t, p.slug);
    // Only confident patterns are indexed. An inferred pattern is not a claim that the problem
    // IS that pattern, and an index is exactly where that distinction would quietly dissolve.
    for (const pat of p.aicmPatterns) push(index.byAicmPattern, pat, p.slug);
    for (const s of p.aicmSubpatterns) push(index.byAicmSubpattern, s, p.slug);
    push(index.byCurriculumStatus, p.curriculumQuestionId !== null ? 'curriculum' : 'contest-only', p.slug);
    push(index.byMappingConfidence, p.mappingConfidence, p.slug);
  }

  index.topicsByFrequency = [...index.byLeetcodeTopic.entries()]
    .map(([topic, slugs]) => ({ topic, count: slugs.length }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  return index;
}

/* ------------------------------------------------------------------------------------------- */
/* Revision pool — "what is worth doing now"                                                    */
/* ------------------------------------------------------------------------------------------- */

/** Solved this recently and it is not a review — showing it again teaches nothing. */
export const RECENCY_STRONG_DAYS = 7;
/** Past this, a solved problem is fully eligible again. Never an infinite exclusion (§26). */
export const RECENCY_CLEAR_DAYS = 30;

export interface RevisionPoolInput {
  pool: readonly ContestLibraryProblem[];
  progress: ProgressLookup;
  today: string;
  filter?: ContestFilter;
  /** Patterns the one weakness model marks as not holding, strongest first. Optional. */
  weakPatterns?: PatternId[];
}

export interface ScoredProblem {
  problem: ContestLibraryProblem;
  score: number;
  /** Human-readable, in the learner's terms — this is what "Why this problem?" renders (§45). */
  reasons: string[];
}

/**
 * Rank contest problems by how much practising them now is worth.
 *
 * The ordering principle mirrors the product's existing one: **retention outranks acquisition**. A
 * problem whose ladder date has arrived is knowledge actively being lost; an unsolved problem is
 * knowledge not yet gained. Everything below that is tie-breaking on evidence, and every term is
 * additive and explainable — a score nobody can read back is a black box, and this product does
 * not ship those.
 */
export function scoreRevisionCandidates(input: RevisionPoolInput): ScoredProblem[] {
  const { pool, progress, today, weakPatterns = [] } = input;
  const filtered = input.filter
    ? filterContestProblems(pool, input.filter, progress, today)
    : [...pool];

  const scored: ScoredProblem[] = [];

  for (const problem of filtered) {
    const state = progress(problem.slug);
    const reasons: string[] = [];
    let score = 0;

    // 1. Due on the ladder. The single strongest signal, and the only one that can make a
    //    already-solved problem the best thing to do.
    if (state?.nextRevision != null && state.nextRevision <= today) {
      const overdue = diffDays(today, state.nextRevision);
      score += 100 + Math.min(overdue, 30);
      reasons.push(
        overdue > 0
          ? `Due for revision — ${overdue} ${overdue === 1 ? 'day' : 'days'} past its scheduled date`
          : 'Due for revision today',
      );
    } else if (state?.solved) {
      // 2. Recency penalty, decaying rather than excluding (§26). Solved yesterday is nearly
      //    worthless to redo; solved two months ago is worth as much as anything else.
      const since = state.solvedOn === null ? RECENCY_CLEAR_DAYS : diffDays(today, state.solvedOn);
      if (since < RECENCY_STRONG_DAYS) {
        score -= 60;
        reasons.push(`Solved ${since === 0 ? 'today' : `${since}d ago`} — not due yet`);
      } else if (since < RECENCY_CLEAR_DAYS) {
        score -= 30 * (1 - (since - RECENCY_STRONG_DAYS) / (RECENCY_CLEAR_DAYS - RECENCY_STRONG_DAYS));
        reasons.push(`Solved ${since}d ago`);
      } else {
        reasons.push('Solved over a month ago');
      }
    } else {
      // 3. Unsolved. The default case, and worth something on its own.
      score += 30;
      if ((state?.attempts ?? 0) > 0) {
        score += 15;
        reasons.push('Attempted before, never solved');
      } else {
        reasons.push('Not solved yet');
      }
    }

    // 4. Weakness. Reads the ONE weakness model's output — this module never computes weakness
    //    itself, because weakness is claimed in exactly one place.
    const weakIndex = problem.aicmPatterns.findIndex((p) => weakPatterns.includes(p));
    if (weakIndex !== -1) {
      const rank = weakPatterns.indexOf(problem.aicmPatterns[weakIndex]!);
      score += Math.max(20 - rank * 4, 8);
      reasons.push('In a pattern your recent evidence says is not holding');
    }

    // 5. Confidence in the classification. A problem we can only guess at is a worse
    //    recommendation than one we know, all else equal — but it is not excluded.
    if (problem.mappingConfidence === 'unmapped') score -= 5;

    scored.push({ problem, score, reasons });
  }

  // Deterministic ordering: score, then rating (easier first inside a tie so a set opens
  // achievably), then slug so the result never depends on pool order.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.problem.contestRating - b.problem.contestRating ||
      a.problem.slug.localeCompare(b.problem.slug),
  );
  return scored;
}

/**
 * The reasons a specific problem was chosen, for the "Why this problem?" disclosure (§45).
 *
 * Facts only, in the learner's terms — its pattern, its rating, where it came from, and what the
 * learner has done with it. Never a persuasion.
 */
export function selectionReason(
  problem: ContestLibraryProblem,
  state: ContestProblemState | undefined,
  today: string,
  patternName?: string,
): string[] {
  const out: string[] = [];
  if (patternName) out.push(patternName);
  else if (problem.aicmPatterns.length === 0) out.push('Pattern mapping unavailable');

  out.push(`Contest rating ${problem.contestRating}`);
  if (problem.contest.number !== null) {
    const kind = problem.contest.type === 'biweekly' ? 'Biweekly' : 'Weekly';
    out.push(`${kind} Contest ${problem.contest.number} · Q${problem.contest.index}`);
  }

  if (state?.nextRevision != null && state.nextRevision <= today) out.push('Due for revision');
  else if (state?.solved && state.solvedOn) out.push(`Last solved ${state.solvedOn}`);
  else if ((state?.attempts ?? 0) > 0) out.push('Attempted, not solved');
  else out.push('Not solved recently');

  return out;
}

/* ------------------------------------------------------------------------------------------- */
/* Conservative band recommendation                                                             */
/* ------------------------------------------------------------------------------------------- */

/** Below this many rated outcomes there is no honest reading at all. */
export const MIN_BAND_EVIDENCE = 4;

export interface BandEvidence {
  /** Contest ratings of problems the learner solved, most recent first. */
  solvedRatings: number[];
  /** Contest ratings of problems attempted without a solution. */
  missedRatings: number[];
}

export interface BandReading {
  /** The band the evidence supports practising at now. */
  band: RatingBand;
  /** Plain-English statement about the PROBLEMS, never about the learner (§31). */
  statement: string;
  /** How many outcomes the reading rests on — always shown beside it. */
  sampleSize: number;
}

/**
 * What band to practise next, or null when the evidence cannot support a reading.
 *
 * Two rules keep this honest. It never claims a learner rating — the sentence is always about the
 * band of problems that went well (§31), because "you performed on problems around 1600–1700" is
 * something the evidence actually shows and "your rating is 1670" is not. And it advances **at
 * most one band per reading** (§28, §51): one good afternoon is not a promotion, and a system that
 * jumps two bands on a 4/4 will hand someone a wall and call it progress.
 */
export function recommendBand(evidence: BandEvidence, current?: RatingBand): BandReading | null {
  const sampleSize = evidence.solvedRatings.length + evidence.missedRatings.length;
  if (sampleSize < MIN_BAND_EVIDENCE) return null;
  if (evidence.solvedRatings.length === 0) {
    // Everything was missed. Step down at most one band, and say why plainly.
    const base = current ?? ratingBand(Math.min(...evidence.missedRatings));
    const idx = RATING_BANDS.findIndex((b) => b.id === base.id);
    const band = RATING_BANDS[Math.max(0, idx - 1)]!;
    return {
      band,
      statement: `None of these landed. ${band.label} is a step back to solid ground.`,
      sampleSize,
    };
  }

  const sorted = [...evidence.solvedRatings].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const comfortable = ratingBand(median);
  const comfortableIdx = RATING_BANDS.findIndex((b) => b.id === comfortable.id);

  const solveRate = evidence.solvedRatings.length / sampleSize;
  // Advance only on a clear majority AND enough evidence to mean it. One band, never two.
  const step = solveRate >= 0.75 && sampleSize >= MIN_BAND_EVIDENCE ? 1 : 0;
  const band = RATING_BANDS[Math.min(RATING_BANDS.length - 1, comfortableIdx + step)]!;

  // The wording follows whether the band ACTUALLY moved, not whether a step was intended. From
  // the top band the clamp holds `band` at `comfortable`, and reading the intent instead produced
  // "You solved problems around the 2200+ band. 2200+ is the next step up." — a sentence that
  // names a band as the step up from itself.
  const statement =
    band.id !== comfortable.id
      ? `You solved problems around the ${comfortable.label} band. ${band.label} is the next step up.`
      : `You solved problems around the ${comfortable.label} band. Worth staying here for now.`;

  return { band, statement, sampleSize };
}

/* ------------------------------------------------------------------------------------------- */
/* Progress records — the SAME ladder, a second register                                        */
/* ------------------------------------------------------------------------------------------- */

/**
 * Contest-library problems climb the exact 1/3/7/15/30 ladder that questions and course weeks do,
 * via `engine/spacedRepetition.ts`. Nothing here re-implements scheduling; these are thin
 * appliers, mirroring `applySolve`/`applyRevision` and `applyMlRung`/`applyMlRebuild`.
 *
 * The reason this is a separate register rather than more rows in `progress.byId` is not
 * stylistic. `progress.byId` is keyed by roadmap ids 1–539 and LeetCode's ids run past 4,000, so
 * the two key spaces overlap directly: solving contest problem 47 would have corrupted roadmap
 * question 47. Keying by slug removes the collision by removing the shared number entirely.
 */
export function initialContestProgress(): ContestProblemProgress {
  return {
    solved: false,
    attempts: 0,
    lastAttemptedOn: null,
    solvedOn: null,
    revisionStage: 0,
    nextRevision: null,
    lastReviewed: null,
    revisionHistory: [],
  };
}

/** Boundary normalizer, mirroring normalizeQuestionProgress / normalizeMlTrackProgress. */
export function normalizeContestProgress(
  raw: Partial<ContestProblemProgress>,
): ContestProblemProgress {
  return { ...initialContestProgress(), ...raw };
}

/** An attempt that did not produce a solution. Recorded; never punished. */
export function applyContestAttempt(
  p: ContestProblemProgress,
  date: string,
): ContestProblemProgress {
  return { ...p, attempts: p.attempts + 1, lastAttemptedOn: date };
}

/**
 * A solve. Enters the shared ladder at the first rung — the same moment a curriculum solve does,
 * for the same reason: this is the first instant there is something to forget.
 *
 * Re-solving an already-laddered problem does NOT restart it. A learner revisiting something for
 * practice must not be able to reset their own schedule by accident.
 */
export function applyContestSolve(
  p: ContestProblemProgress,
  date: string,
): ContestProblemProgress {
  const base = {
    ...p,
    solved: true,
    attempts: p.attempts + 1,
    lastAttemptedOn: date,
    solvedOn: p.solvedOn ?? date,
  };
  return p.solved ? base : { ...base, ...ladderEntry(date) };
}

/** A graded review. Pass climbs, fail restarts at stage 0 due tomorrow — the one ladder. */
export function applyContestReview(
  p: ContestProblemProgress,
  date: string,
  passed: boolean,
): ContestProblemProgress {
  return {
    ...p,
    lastReviewed: date,
    revisionHistory: [...p.revisionHistory, { date, passed }],
    ...ladderAfterReview(p.revisionStage, date, passed),
  };
}

export const isContestProblemDue = (p: ContestProblemProgress, today: string): boolean =>
  p.solved && isLadderDue(p, today);

/**
 * Days on which contest-library work happened, and how much — DERIVED, never logged.
 *
 * This is `mlActivityByDate`'s pattern applied to the second question universe, and the reason is
 * the same one that put it there: `DayLog` is the curriculum's ledger and must stay one, but a
 * streak that breaks on an evening spent solving four rated contest problems is a streak that
 * lies. Deriving the activity from the records the learner already has means no new write, no
 * second ledger, and nothing that can drift out of step with the progress it describes.
 *
 * `lastAttemptedOn` counts only when it differs from `solvedOn`: a solve stamps both, and counting
 * that day twice would inflate the heatmap's intensity for no reason. Bridged problems never
 * appear here — their record lives in `progress.byId` and already reaches `DayLog` through
 * `solveQuestion`, so counting them again would double-count the same afternoon.
 */
export function contestLibraryActivityByDate(
  bySlug: Record<string, ContestProblemProgress>,
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (date: string | null | undefined) => {
    if (typeof date === 'string' && date !== '') counts.set(date, (counts.get(date) ?? 0) + 1);
  };
  for (const p of Object.values(bySlug)) {
    bump(p.solvedOn);
    if (p.lastAttemptedOn !== p.solvedOn) bump(p.lastAttemptedOn);
    for (const review of p.revisionHistory) bump(review.date);
  }
  return counts;
}

/** Slugs whose ladder date has arrived. The one input the store needs with no dataset at hand. */
export function dueContestSlugs(
  bySlug: Record<string, ContestProblemProgress>,
  today: string,
): string[] {
  return Object.entries(bySlug)
    .filter(([, p]) => isContestProblemDue(p, today))
    .sort(([sa, a], [sb, b]) =>
      a.nextRevision! < b.nextRevision! ? -1 : a.nextRevision! > b.nextRevision! ? 1 : sa.localeCompare(sb),
    )
    .map(([slug]) => slug);
}
