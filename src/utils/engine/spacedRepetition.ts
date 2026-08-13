import type { QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';

export const REVISION_INTERVALS = [1, 3, 7, 15, 30] as const;
export const MASTERED_STAGE = 5;

// The one spaced-repetition ladder in the app. Questions and course weeks carry these two
// fields (plus their own bookkeeping) and share the exact transition table: entry schedules
// the first review at interval[0]; a pass climbs 1/3/7/15/30 until stage 5 retires the item
// (nextRevision null); any fail restarts at stage 0, due tomorrow.
export interface LadderState {
  revisionStage: number;
  nextRevision: string | null;
}

export function ladderEntry(date: string): LadderState {
  return { revisionStage: 0, nextRevision: addDays(date, REVISION_INTERVALS[0]) };
}

export function ladderAfterReview(stage: number, date: string, passed: boolean): LadderState {
  if (!passed) return { revisionStage: 0, nextRevision: addDays(date, 1) };
  const next = stage + 1;
  return {
    revisionStage: next,
    nextRevision: next >= MASTERED_STAGE ? null : addDays(date, REVISION_INTERVALS[next]!),
  };
}

export function isLadderDue(p: LadderState, today: string): boolean {
  return p.revisionStage < MASTERED_STAGE && p.nextRevision !== null && p.nextRevision <= today;
}

export function initialProgress(): QuestionProgress {
  return {
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0, hintLevelUsed: 0, reflection: '',
  };
}

// Boundary normalizer, mirroring normalizeCourseWeekProgress: imported/loaded entries pass
// through here so an optional QuestionProgress field gains its default instead of arriving
// undefined. hintLevelUsed/reflection shipped after the original shape, so pre-existing
// payloads reach the store without them and are defaulted here.
export function normalizeQuestionProgress(raw: Partial<QuestionProgress>): QuestionProgress {
  return { ...initialProgress(), ...raw };
}

export function applySolve(p: QuestionProgress, date: string): QuestionProgress {
  return { ...p, status: 'solved', completedAt: date, ...ladderEntry(date) };
}

export function applyRevision(p: QuestionProgress, date: string, passed: boolean): QuestionProgress {
  return {
    ...p,
    lastReviewed: date,
    revisionHistory: [...p.revisionHistory, { date, passed }],
    ...ladderAfterReview(p.revisionStage, date, passed),
  };
}

export const isMastered = (p: QuestionProgress) => p.revisionStage >= MASTERED_STAGE;

export function isDue(p: QuestionProgress, today: string): boolean {
  return p.status === 'solved' && isLadderDue(p, today);
}

export function dueIds(byId: Record<number, QuestionProgress>, today: string): number[] {
  return Object.entries(byId)
    .filter(([, p]) => isDue(p, today))
    .sort(([ia, a], [ib, b]) =>
      a.nextRevision! < b.nextRevision! ? -1 :
      a.nextRevision! > b.nextRevision! ? 1 : Number(ia) - Number(ib))
    .map(([id]) => Number(id));
}
