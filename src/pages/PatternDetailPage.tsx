import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchX, Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProgressRing } from '@/components/shared/ProgressRing';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { QuestionCard } from '@/components/questions/QuestionCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { patternById } from '@/data/patterns';
import questionsData from '@/data/questions.json';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPatternStats } from '@/store/selectors';
import { useToday } from '@/hooks/useToday';
import { initialProgress, isDue } from '@/utils/engine/spacedRepetition';
import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type StatusFilter = 'all' | 'solved' | 'unsolved' | 'needs-revision' | 'bookmarked';
export type DifficultyFilterValue = 'all' | Difficulty;

export interface PatternFilters {
  status: StatusFilter;
  difficulty: DifficultyFilterValue;
}

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  solved: 'Solved',
  unsolved: 'Unsolved',
  'needs-revision': 'Needs Revision',
  bookmarked: 'Bookmarked',
};

const DIFFICULTY_FILTER_LABEL: Record<DifficultyFilterValue, string> = {
  all: 'All',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function isPatternId(id: string): id is PatternId {
  return Object.prototype.hasOwnProperty.call(patternById, id);
}

// Pure, dependency-free filter over one pattern's question list — kept outside the component
// (and exported) so it's unit-testable directly: jsdom has no pointer-capture support, so Radix
// Select's listbox can't be driven open in tests (see
// src/components/ui/__tests__/primitives.test.tsx's Select smoke test). "unsolved" here means
// "not currently solved" (covers the unsolved/in_progress/skipped statuses alike) — the filter
// row offers one bucket for "still to do", not one per QuestionStatus.
export function filterPatternQuestions(
  questions: Question[],
  byId: Record<number, QuestionProgress>,
  filters: PatternFilters,
  today: string,
): Question[] {
  return questions.filter((q) => {
    if (filters.difficulty !== 'all' && q.difficulty !== filters.difficulty) return false;

    const progress = byId[q.id] ?? initialProgress();
    switch (filters.status) {
      case 'all':
        return true;
      case 'solved':
        return progress.status === 'solved';
      case 'unsolved':
        return progress.status !== 'solved';
      case 'needs-revision':
        return progress.status === 'solved' && isDue(progress, today);
      case 'bookmarked':
        return progress.bookmarked;
    }
  });
}

export default function PatternDetailPage() {
  const { patternId } = useParams<{ patternId: string }>();
  const dispatch = useAppDispatch();
  const today = useToday();
  const progressById = useAppSelector((s) => s.progress.byId);
  const stats = useAppSelector(selectPatternStats);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilterValue>('all');

  const patternQuestions = useMemo(
    () => (patternId ? questions.filter((q) => q.pattern === patternId) : []),
    [patternId],
  );

  const filtered = useMemo(
    () => filterPatternQuestions(patternQuestions, progressById, { status, difficulty }, today),
    [patternQuestions, progressById, status, difficulty, today],
  );

  if (!patternId || !isPatternId(patternId)) {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState icon={SearchX} title="Pattern not found" hint="This pattern doesn't exist in the roadmap." />
        <Link to="/patterns" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to Patterns
        </Link>
      </div>
    );
  }

  const meta = patternById[patternId];
  const Icon = iconByName(meta.icon, Shapes);
  const stat = stats.find((s) => s.pattern === patternId)!;

  const difficultyCounts = DIFFICULTIES.map((d) => ({
    difficulty: d,
    count: patternQuestions.filter((q) => q.difficulty === d).length,
  })).filter((d) => d.count > 0);

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gradient">{meta.name}</h1>
            <p className="text-sm text-muted-foreground">{patternQuestions.length} Questions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {difficultyCounts.map(({ difficulty: d, count }) => (
                <span key={d} className="inline-flex items-center gap-1">
                  <DifficultyBadge difficulty={d} />
                  <span className="text-xs text-muted-foreground">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <ProgressRing value={stat.solved} max={stat.total} size={96}>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold">{stat.pct}%</span>
              <span className="text-[10px] text-muted-foreground">
                {stat.solved}/{stat.total}
              </span>
            </div>
          </ProgressRing>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{stat.mastered} mastered</span>
            <span>{stat.inRevision} in revision</span>
            <span>{stat.revisionPassRate !== null ? `${Math.round(stat.revisionPassRate * 100)}% pass rate` : '— pass rate'}</span>
          </div>
        </div>
      </header>

      <div className="glass flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger aria-label="Filter by status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Difficulty</span>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyFilterValue)}>
            <SelectTrigger aria-label="Filter by difficulty" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DIFFICULTY_FILTER_LABEL) as DifficultyFilterValue[]).map((d) => (
                <SelectItem key={d} value={d}>
                  {DIFFICULTY_FILTER_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No questions match these filters" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              progress={progressById[q.id] ?? initialProgress()}
              context="browse"
              onOpenDetail={openQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
