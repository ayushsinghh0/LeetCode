import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchX, Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { EmptyState } from '@/components/shared/EmptyState';
import { Ledger, Meta, Page, PageHeader, Section } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { patternById } from '@/data/patterns';
import { SUBPATTERNS } from '@/data/curriculum';
import { companiesNamingPattern } from '@/data/companies';
import questionsData from '@/data/questions.json';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPatternStats } from '@/store/selectors';
import { useToday } from '@/hooks/useToday';
import { initialProgress, isDue } from '@/utils/engine/spacedRepetition';
import { MIN_PASS_RATE_ATTEMPTS, isPassRateReportable } from '@/utils/engine/stats';
import type { Confidence, Difficulty, PatternId, Question, QuestionProgress } from '@/types';

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

// The filter row is chrome, not content: it already has its own boundary (two bordered controls),
// so it sits on the page ground rather than inside a plate that drew a second one around it.
const FILTER_LABEL_CLASS = 'figures text-xs uppercase tracking-[0.14em] text-muted-foreground';

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

  // Sub-pattern sections over the *filtered* list; questions outside any group gather at the
  // end. Patterns without a curated subdivision fall back to the flat grid below.
  const sections = useMemo(() => {
    const groups = (patternId && SUBPATTERNS[patternId]) || [];
    if (groups.length === 0) return [];
    const bySubpattern = groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: filtered.filter((q) => q.subpattern === g.id),
    }));
    const rest = filtered.filter((q) => q.subpattern === undefined);
    if (rest.length > 0) bySubpattern.push({ id: 'other', name: 'More problems', items: rest });
    return bySubpattern.filter((s) => s.items.length > 0);
  }, [patternId, filtered]);

  if (!patternId || !isPatternId(patternId)) {
    return (
      <Page width="reading">
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={SearchX} title="Pattern not found" hint="This pattern doesn't exist in the roadmap." />
          <Link to="/patterns" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to Patterns
          </Link>
        </div>
      </Page>
    );
  }

  const meta = patternById[patternId];
  const Icon = iconByName(meta.icon, Shapes);
  const stat = stats.find((s) => s.pattern === patternId)!;
  const namingCompanies = companiesNamingPattern(patternId);
  const passRate = stat.revisionPassRate;
  const reviews = stat.revisionAttempts;
  const passRateMeasured = passRate !== null && isPassRateReportable(reviews);
  const avgConfidence = stat.avgConfidence !== null ? (Math.round(stat.avgConfidence) as Confidence) : null;

  const difficultyCounts = DIFFICULTIES.map((d) => ({
    difficulty: d,
    count: patternQuestions.filter((q) => q.difficulty === d).length,
  })).filter((d) => d.count > 0);

  function openQuestion(id: number) {
    dispatch(activeQuestionSet(id));
  }

  const questionGrid = (items: Question[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          progress={progressById[q.id] ?? initialProgress()}
          context="browse"
          onOpenDetail={openQuestion}
        />
      ))}
    </div>
  );

  return (
    <Page>
      {/* The pattern's ink rides its icon, beside the title — not on a 96px ring parked at the
          far end of a header plate with 500px of nothing between them. */}
      <PageHeader
        eyebrow={`${patternQuestions.length} questions`}
        title={
          <span className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            {meta.name}
          </span>
        }
      />

      <Section aria-label="Progress">
        <Meta
          items={[
            ...difficultyCounts.map(({ difficulty: d, count }) => (
              <span key={d} className="inline-flex items-center gap-1.5">
                <DifficultyBadge difficulty={d} />
                <span className="figures">{count}</span>
              </span>
            )),
            avgConfidence !== null && (
              <span key="confidence" className="inline-flex items-center gap-2">
                Avg. confidence
                <ConfidenceRating value={avgConfidence} />
              </span>
            ),
          ]}
        />

        <Progress value={stat.pct} className="h-1.5" aria-label={`${meta.name} completion`} />

        <Ledger
          items={[
            {
              label: 'Solved',
              value: `${stat.solved}/${stat.total}`,
              sub: `${stat.pct}% · ${stat.remaining} remaining`,
            },
            { label: 'Mastered', value: stat.mastered },
            { label: 'In revision', value: stat.inRevision },
            // A pass rate is passes/attempts, so its resolution is 1/attempts: one failed recall
            // renders "0%" in the stat voice, indistinguishable from 0% over forty attempts. The
            // denominator is therefore never omitted, and below the reporting minimum the figure
            // is a dash with the shortfall named — the posture engine/timeEstimate.ts and
            // engine/insights.ts already hold everywhere else.
            {
              label: 'Pass rate',
              value: passRateMeasured ? `${Math.round(passRate! * 100)}%` : '—',
              sub:
                reviews === 0
                  ? 'no reviews yet'
                  : passRateMeasured
                    ? `over ${reviews} reviews`
                    : `needs ${MIN_PASS_RATE_ATTEMPTS} reviews — you have ${reviews}`,
            },
          ]}
        />
      </Section>

      {/* Interview relevance, at the only level the evidence supports: which companies name
          this topic in their own published prep guidance. Never a per-problem claim. */}
      {namingCompanies.length > 0 && (
        <Section
          title="Named in company prep guidance"
          support="These companies' own interview-prep pages list topics this pattern covers. That is a statement about the topic, not about any question below."
          aria-label="Interview relevance"
        >
          <ul className="flex flex-wrap gap-2">
            {namingCompanies.map((company) => (
              <li key={company.id}>
                <Link
                  to={`/companies/${company.id}`}
                  className="inline-flex rounded-sm border border-border px-2 py-1 text-xs transition-colors duration-150 ease-swift hover:border-primary/40 hover:text-primary"
                >
                  {company.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Questions"
        support={`Showing ${filtered.length} of ${patternQuestions.length}.`}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className={FILTER_LABEL_CLASS}>Status</span>
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
            <span className={FILTER_LABEL_CLASS}>Difficulty</span>
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
        ) : sections.length === 0 ? (
          questionGrid(filtered)
        ) : null}
      </Section>

      {/* Sub-pattern sections: the taxonomy layer that turns "20 stack problems" into "matching,
          monotonic, parsing..." — recognition starts with the grouping. They are sections in
          their own right, so they are siblings under `Page` and take the between-sections step
          from it. They used to sit in a hand-rolled `gap-10` wrapper, which held them 40px apart
          at every width while every other section on the page moved to 48px at md. `sections` is
          derived from `filtered`, so it is already empty whenever the filters match nothing. */}
      {sections.map(({ id, name, items }) => (
        <Section
          key={id}
          level={3}
          title={
            <>
              {name} <span className="figures text-sm font-normal text-muted-foreground">· {items.length}</span>
            </>
          }
          aria-label={name}
        >
          {questionGrid(items)}
        </Section>
      ))}
    </Page>
  );
}
