import recallJson from '@/data/courseRecall.json';

// Retrieval-practice checks for the AI/ML course, one small set per core week — authored in
// original wording, adversarially reviewed for technical correctness before merging. The JSON
// is produced by a merge script from per-week-band sources; treat it as generated (don't
// hand-edit entries in place — fix the source content and re-merge).
export interface RecallPrompt {
  id: string; // `<weekId>-r<N>`
  weekId: string;
  prompt: string;
  answer: string; // intuition first, then the precise mechanism
  depth: 'core' | 'stretch';
}

export const COURSE_RECALL = recallJson as RecallPrompt[];

export const recallByWeekId: Record<string, RecallPrompt[]> = {};
for (const prompt of COURSE_RECALL) {
  (recallByWeekId[prompt.weekId] ??= []).push(prompt);
}
