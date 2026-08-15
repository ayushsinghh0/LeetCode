import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchX, Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { EmptyState } from '@/components/shared/EmptyState';
import { Disclosure, Ledger, Meta, Page, PageColumns, PageHeader, RuledList, Section } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { QuestionRow } from '@/components/questions/QuestionCard';
import { ALL_STATUS_OPTIONS, QuestionFilterRow } from '@/components/shared/QuestionFilterRow';
import { Progress } from '@/components/ui/progress';
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

  // The group the learner is standing in — the first with an unsolved question — opens by
  // default; every other group is a 44px summary row. All groups open at once was the exact
  // anti-pattern the composition pass exists to remove: 34 rows and six headings before the
  // second sub-pattern's name was even visible.
  const openSectionIndex = useMemo(() => {
    const idx = sections.findIndex((s) =>
      s.items.some((q) => (progressById[q.id]?.status ?? 'unsolved') !== 'solved'),
    );
    return idx === -1 ? 0 : idx;
  }, [sections, progressById]);

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

  // Hairline-ruled rows, not a grid of cards. Thirty questions in a pattern used to render thirty
  // bordered rectangles of identical weight (and, at xl, three to a line inside a 60rem measure —
  // 309px for a title, a sentence, a pattern and an estimate). A browse list is an index, and an
  // index entry is a row: DESIGN.md § The plate rule, "a list does not become plates".
  const questionList = (items: Question[], label: string) => (
    <RuledList aria-label={label}>
      {items.map((q) => (
        <QuestionRow
          key={q.id}
          question={q}
          progress={progressById[q.id] ?? initialProgress()}
          onOpen={openQuestion}
        />
      ))}
    </RuledList>
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

      {/* Work left, context right. The questions are what the learner came for, and they used to
          begin ~500px down, under a stat block and a company section that only ever explain. On a
          phone the DOM order keeps the same priority: questions first, record after. */}
      <PageColumns
        railLabel="Pattern context"
        rail={
          <>
            <Section aria-label="Progress">
              <Meta
                items={[
                  // Borderless inside a Meta line: the counts and the difficulties describe one
                  // breakdown, and a bordered chip here would box one fact inside plain text.
                  ...difficultyCounts.map(({ difficulty: d, count }) => (
                    <span key={d} className="inline-flex items-center gap-1.5">
                      <DifficultyBadge difficulty={d} variant="bare" />
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
                columns={2}
                items={[
                  {
                    label: 'Solved',
                    value: `${stat.solved}/${stat.total}`,
                    sub: `${stat.pct}% · ${stat.remaining} remaining`,
                  },
                  { label: 'Mastered', value: stat.mastered },
                  { label: 'In revision', value: stat.inRevision },
                  // A pass rate is passes/attempts, so its resolution is 1/attempts: one failed
                  // recall renders "0%" in the stat voice, indistinguishable from 0% over forty
                  // attempts. The denominator is therefore never omitted, and below the reporting
                  // minimum the figure is a dash with the shortfall named — the posture
                  // engine/timeEstimate.ts and engine/insights.ts already hold everywhere else.
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
          </>
        }
      >
        <Section
          title="Questions"
          support={`Showing ${filtered.length} of ${patternQuestions.length}.`}
        >
          {/* The same filter row Bookmarks and the search palette use. This page used to roll its
              own pair of Selects for the identical job, so two adjacent surfaces had two designs
              for one control. Chips clear by re-clicking, which is why there is no "All" option. */}
          <QuestionFilterRow
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            status={status}
            onStatusChange={setStatus}
            statusOptions={ALL_STATUS_OPTIONS}
          />

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="No questions match these filters" />
          ) : sections.length === 0 ? (
            questionList(filtered, 'Questions')
          ) : (
            /* Sub-pattern groups: the taxonomy layer that turns "20 stack problems" into
               "matching, monotonic, parsing..." — recognition starts with the grouping. Each is
               a disclosure row now, not an always-open section: the chapter list is legible in
               one glance, and only the group the learner is standing in spends the vertical
               space. `sections` derives from `filtered`, so it empties with the filters. */
            <div className="flex flex-col border-t border-border">
              {sections.map(({ id, name, items }, i) => {
                const solvedIn = items.filter(
                  (q) => (progressById[q.id]?.status ?? 'unsolved') === 'solved',
                ).length;
                return (
                  <Disclosure
                    key={id}
                    defaultOpen={i === openSectionIndex}
                    summary={<span className="font-medium">{name}</span>}
                    meta={`${solvedIn}/${items.length}`}
                  >
                    {questionList(items, `${name} questions`)}
                  </Disclosure>
                );
              })}
            </div>
          )}
        </Section>
      </PageColumns>
    </Page>
  );
}
