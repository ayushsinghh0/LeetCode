// The revision sheet's pure core — entry resolution, stats, and the exclusion-by-default
// revision draw. Pure and deterministic like every engine module: ISO date strings in, no clock,
// no store, no React, no network — and, like `engine/contestLibrary`, NO dataset import. Rows
// and resolvers come in from the caller; answers go out.
//
// THE ONE RULE THIS MODULE OWNS: a roadmap problem never enters a sheet revision draw unless the
// caller explicitly asks (`includeRoadmap: true`). The exclusion is structural — implemented in
// `selectSheetRevision` itself, never as a UI filter — because the roadmap already schedules its
// own questions through the daily plan, and a second surface silently re-drawing them would put
// one problem on two schedules.
import type {
  ContestLibraryProblem,
  ContestProblemProgress,
  Difficulty,
  PatternId,
  Question,
  QuestionProgress,
  SheetRow,
} from '@/types';
import {
  contestStateFromQuestionProgress,
  scoreRevisionFacts,
  type ContestProblemState,
} from '@/utils/engine/contestLibrary';

/**
 * How a sheet surface reaches the two universes and the two progress registers. Functions rather
 * than datasets so this module stays dataset-free and a test can hand it four small Maps.
 */
export interface SheetResolvers {
  questionById: (id: number) => Question | undefined;
  libraryBySlug: (slug: string) => ContestLibraryProblem | undefined;
  questionState: (id: number) => QuestionProgress | undefined;
  slugState: (slug: string) => ContestProblemProgress | undefined;
}

export type SheetStatus = 'untouched' | 'attempted' | 'solved' | 'due';

/** One sheet row, resolved against the universe that owns it — what every sheet surface renders. */
export interface SheetEntry {
  row: SheetRow;
  /** Dedupe/progress identity: curriculum → "q<id>", other LC rows → slug, untracked → null. */
  identity: string | null;
  title: string;
  url: string | null;
  officialDifficulty: Difficulty | 'theory' | null;
  /** Library rows only; null everywhere else — unrated is stored as absence, never zero. */
  contestRating: number | null;
  /** Confident (exact/strong) patterns only. */
  patterns: PatternId[];
  unmapped: boolean;
  onRoadmap: boolean;
  questionId: number | null;
  slug: string | null;
  premium: boolean;
  platform: string | null;
  /** null = untracked (external/ambiguous rows record nothing). */
  status: SheetStatus | null;
  state: ContestProblemState | undefined;
}

function statusOf(state: ContestProblemState | undefined, today: string): SheetStatus {
  if (state === undefined) return 'untouched';
  if (state.solved && state.nextRevision !== null && state.nextRevision <= today) return 'due';
  if (state.solved) return 'solved';
  if (state.attempts > 0) return 'attempted';
  return 'untouched';
}

/**
 * Resolve one row. Returns null when the reference no longer resolves (a regenerated dataset
 * naming an id or slug the universes dropped) — inert, never an error, never an invented entry.
 */
export function sheetEntry(
  row: SheetRow,
  resolvers: SheetResolvers,
  today: string,
): SheetEntry | null {
  const ref = row.ref;
  switch (ref.kind) {
    case 'curriculum': {
      const q = resolvers.questionById(ref.questionId);
      if (q === undefined) return null;
      const qp = resolvers.questionState(ref.questionId);
      const state = qp === undefined ? undefined : contestStateFromQuestionProgress(qp);
      return {
        row,
        identity: `q${q.id}`,
        title: q.title,
        url: q.url ?? null,
        officialDifficulty: q.difficulty,
        contestRating: null,
        patterns: [q.pattern],
        unmapped: false,
        onRoadmap: true,
        questionId: q.id,
        slug: null,
        premium: q.premium === true,
        platform: null,
        status: statusOf(state, today),
        state,
      };
    }
    case 'library': {
      const p = resolvers.libraryBySlug(ref.slug);
      if (p === undefined) return null;
      const state = resolvers.slugState(ref.slug);
      return {
        row,
        identity: p.slug,
        title: p.title,
        url: p.url,
        officialDifficulty: p.officialDifficulty,
        contestRating: p.contestRating,
        patterns: p.aicmPatterns,
        unmapped: p.mappingConfidence === 'unmapped',
        onRoadmap: false,
        questionId: null,
        slug: p.slug,
        premium: p.premium,
        platform: null,
        status: statusOf(state, today),
        state,
      };
    }
    case 'sheet': {
      const p = ref.problem;
      const state = resolvers.slugState(p.slug);
      return {
        row,
        identity: p.slug,
        title: p.title,
        url: p.url,
        officialDifficulty: p.officialDifficulty,
        contestRating: null,
        patterns: p.aicmPatterns,
        unmapped: p.mappingConfidence === 'unmapped',
        onRoadmap: false,
        questionId: null,
        slug: p.slug,
        premium: p.premium,
        platform: null,
        status: statusOf(state, today),
        state,
      };
    }
    case 'external':
    case 'ambiguous':
      return {
        row,
        identity: null,
        title: ref.title,
        url: null,
        officialDifficulty: ref.difficulty,
        contestRating: null,
        patterns: [],
        unmapped: false,
        onRoadmap: false,
        questionId: null,
        slug: null,
        premium: false,
        platform: ref.kind === 'external' ? ref.platform : null,
        status: null,
        state: undefined,
      };
  }
}

export interface SheetStats {
  total: number;
  tracked: number;
  solved: number;
  due: number;
  untracked: number;
  onRoadmap: number;
}

/** Unique problems (not rows): a problem listed under two sub-topics counts once. */
export function sheetStats(
  rows: readonly SheetRow[],
  resolvers: SheetResolvers,
  today: string,
): SheetStats {
  const tracked = new Map<string, SheetEntry>();
  const untracked = new Set<string>();
  for (const row of rows) {
    const entry = sheetEntry(row, resolvers, today);
    if (entry === null) continue;
    if (entry.identity === null) {
      untracked.add(`${entry.platform ?? ''}|${entry.title}`);
    } else if (!tracked.has(entry.identity)) {
      tracked.set(entry.identity, entry);
    }
  }
  let solved = 0;
  let due = 0;
  let onRoadmap = 0;
  for (const entry of tracked.values()) {
    if (entry.status === 'due') due++;
    if (entry.status === 'solved' || entry.status === 'due') solved++;
    if (entry.onRoadmap) onRoadmap++;
  }
  return {
    total: tracked.size + untracked.size,
    tracked: tracked.size,
    solved,
    due,
    untracked: untracked.size,
    onRoadmap,
  };
}

export interface SheetRevisionInput {
  rows: readonly SheetRow[];
  resolvers: SheetResolvers;
  today: string;
  /** THE exclusion rule (spec §6). Default false: roadmap problems never enter the draw. */
  includeRoadmap?: boolean;
  weakPatterns?: PatternId[];
}

export interface ScoredSheetEntry {
  entry: SheetEntry;
  score: number;
  reasons: string[];
}

const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Rank the sheet's revisable problems through the ONE revision scorer's core
 * (`scoreRevisionFacts`) — the same arithmetic the contest revision pool uses, so the two
 * surfaces can never disagree about what is worth doing now. Deterministic, explainable, no RNG.
 */
export function selectSheetRevision(input: SheetRevisionInput): ScoredSheetEntry[] {
  const { rows, resolvers, today, includeRoadmap = false, weakPatterns = [] } = input;

  const seen = new Set<string>();
  const scored: ScoredSheetEntry[] = [];
  for (const row of rows) {
    const entry = sheetEntry(row, resolvers, today);
    if (entry === null || entry.identity === null) continue;
    // The structural exclusion: roadmap problems never enter the draw unless asked for.
    if (entry.onRoadmap && !includeRoadmap) continue;
    // Dedupe by identity, first occurrence (sheet order) kept.
    if (seen.has(entry.identity)) continue;
    seen.add(entry.identity);

    const { score, reasons } = scoreRevisionFacts(
      { patterns: entry.patterns, unmapped: entry.unmapped },
      entry.state,
      today,
      weakPatterns,
    );
    if (entry.onRoadmap) reasons.push('On your roadmap');
    scored.push({ entry, score, reasons });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (DIFFICULTY_RANK[a.entry.officialDifficulty as string] ?? 3) -
        (DIFFICULTY_RANK[b.entry.officialDifficulty as string] ?? 3) ||
      (a.entry.contestRating ?? Infinity) - (b.entry.contestRating ?? Infinity) ||
      a.entry.identity!.localeCompare(b.entry.identity!),
  );
  return scored;
}
