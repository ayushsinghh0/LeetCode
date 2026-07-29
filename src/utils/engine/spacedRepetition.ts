import type { QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';

export const REVISION_INTERVALS = [1, 3, 7, 15, 30] as const;
export const MASTERED_STAGE = 5;

export function initialProgress(): QuestionProgress {
  return {
    status: 'unsolved', revisionStage: 0, nextRevision: null, lastReviewed: null,
    revisionHistory: [], notes: '', bookmarked: false, completedAt: null,
    confidence: null, timeSpentMin: 0,
  };
}

export function applySolve(p: QuestionProgress, date: string): QuestionProgress {
  return {
    ...p, status: 'solved', completedAt: date, revisionStage: 0,
    nextRevision: addDays(date, REVISION_INTERVALS[0]),
  };
}

export function applyRevision(p: QuestionProgress, date: string, passed: boolean): QuestionProgress {
  const history = [...p.revisionHistory, { date, passed }];
  if (!passed) {
    return { ...p, revisionStage: 0, nextRevision: addDays(date, 1), lastReviewed: date, revisionHistory: history };
  }
  const stage = p.revisionStage + 1;
  return {
    ...p, revisionStage: stage, lastReviewed: date, revisionHistory: history,
    nextRevision: stage >= MASTERED_STAGE ? null : addDays(date, REVISION_INTERVALS[stage]),
  };
}

export const isMastered = (p: QuestionProgress) => p.revisionStage >= MASTERED_STAGE;

export function isDue(p: QuestionProgress, today: string): boolean {
  return p.status === 'solved' && !isMastered(p) && p.nextRevision !== null && p.nextRevision <= today;
}

export function dueIds(byId: Record<number, QuestionProgress>, today: string): number[] {
  return Object.entries(byId)
    .filter(([, p]) => isDue(p, today))
    .sort(([ia, a], [ib, b]) =>
      a.nextRevision! < b.nextRevision! ? -1 :
      a.nextRevision! > b.nextRevision! ? 1 : Number(ia) - Number(ib))
    .map(([id]) => Number(id));
}
