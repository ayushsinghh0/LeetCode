import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';
import { initialProgress, isDue } from '@/utils/engine/spacedRepetition';

// "needs-revision" reuses isDue's semantics (solved && !mastered && due-or-overdue) rather than
// duplicating that logic here — see src/utils/engine/spacedRepetition.ts.
export type QuestionStatusFilter = 'solved' | 'unsolved' | 'needs-revision' | 'bookmarked';

export interface QuestionFilter {
  query?: string;
  difficulty?: Difficulty;
  status?: QuestionStatusFilter;
  pattern?: PatternId;
}

// Pure filter over a question list — no field means "no constraint" (AND across whichever
// fields are set). Deliberately takes `today` as an explicit argument instead of calling
// todayISO() itself, so it stays a pure, directly-unit-testable function; only UI callers
// (SearchDialog, BookmarksPage) resolve "today" via useToday()/todayISO().
export function filterQuestions(
  all: Question[],
  byId: Record<number, QuestionProgress>,
  filter: QuestionFilter,
  today: string,
): Question[] {
  const query = filter.query?.trim().toLowerCase();

  return all.filter((q) => {
    if (query) {
      // Titles and the user's own notes are both searchable — "that trick I wrote down about
      // heaps" should be findable without remembering which question it was written under.
      const notes = (byId[q.id] ?? initialProgress()).notes;
      if (!q.title.toLowerCase().includes(query) && !notes.toLowerCase().includes(query)) return false;
    }
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
    if (filter.pattern && q.pattern !== filter.pattern) return false;

    if (filter.status) {
      const progress = byId[q.id] ?? initialProgress();
      switch (filter.status) {
        case 'solved':
          if (progress.status !== 'solved') return false;
          break;
        case 'unsolved':
          if (progress.status === 'solved') return false;
          break;
        case 'needs-revision':
          if (!(progress.status === 'solved' && isDue(progress, today))) return false;
          break;
        case 'bookmarked':
          if (!progress.bookmarked) return false;
          break;
      }
    }

    return true;
  });
}
