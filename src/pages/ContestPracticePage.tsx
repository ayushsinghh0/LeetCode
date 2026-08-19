import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight, SearchX } from 'lucide-react';
import {
  Disclosure,
  Meta,
  Panel,
  RuledItem,
  RuledList,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  CHIP_ACTIVE,
  CHIP_CLASS,
  CHIP_IDLE,
  DIFFICULTY_CHIP_LABEL,
  DIFFICULTY_OPTIONS,
  GROUP_CLASS,
  GROUP_LABEL_CLASS,
} from '@/components/shared/QuestionFilterRow';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { PATTERNS, patternById } from '@/data/patterns';
import { SUBPATTERNS } from '@/data/curriculum';
import { CONTEST_PROBLEMS, CONTEST_RATING_NOTE } from '@/data/contestLibrary';
import {
  RATING_BANDS,
  buildContestIndex,
  contestStateFromQuestionProgress,
  filterContestProblems,
  isFilterActive,
  type ContestFilter,
  type ContestProblemState,
  type CurriculumStatus,
  type ProgressLookup,
  type ProgressStatus,
} from '@/utils/engine/contestLibrary';
import { useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import type { ContestLibraryProblem, Difficulty, PatternId, PatternMeta } from '@/types';

/**
 * The Contest Library — the SECOND question universe (V13 §7.1), read-only in this slice.
 *
 * The 539 are a curated curriculum; these 2,561 rated contest problems are a pool you draw from.
 * Nothing here enters the roadmap or the daily plan, and this lazy route is the only kind of
 * module allowed to import `@/data/contestLibrary` — the dataset rides its own `data-contests`
 * chunk so a learner who never opens this route never downloads it.
 *
 * Simple mode by default (directive §61): pattern → rating. Everything else lives behind one
 * disclosure, the result count is always visible, and an empty result keeps the learner's filters
 * and suggests the loosening that would help (§55–§57).
 */

const NUM = new Intl.NumberFormat('en-US');

const BAND_LABEL: Record<string, string> = Object.fromEntries(
  RATING_BANDS.map((b) => [b.id, b.label]),
);

const PROGRESS_OPTIONS: ProgressStatus[] = ['unsolved', 'solved', 'attempted', 'never-attempted', 'due'];
const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  unsolved: 'Unsolved',
  solved: 'Solved',
  attempted: 'Attempted',
  'never-attempted': 'Never attempted',
  due: 'Due',
};

const CURRICULUM_OPTIONS: CurriculumStatus[] = ['curriculum', 'contest-only'];
const CURRICULUM_LABEL: Record<CurriculumStatus, string> = {
  curriculum: 'In the curriculum',
  'contest-only': 'Contest only',
};

// Sub-pattern ids resolve to their authored display names — the canonical surface
// (QuestionDetailModal) renders `subpattern.name`, and a raw kebab-case id is not the product's
// own language. Only the 207 bridged problems carry sub-patterns, so unknown ids cannot occur;
// the fallback exists so a future regeneration can never render `undefined`.
const SUBPATTERN_NAME: Record<string, string> = Object.fromEntries(
  Object.values(SUBPATTERNS)
    .flat()
    .map((group) => [group.id, group.name]),
);

const shortDate = (iso: string): string => format(parseISO(iso), 'MMM d');

/** UI filter state: one value per dimension, 'all' meaning unconstrained. */
interface Filters {
  pattern: 'all' | PatternId;
  band: string; // 'all' | RatingBand id
  difficulty: 'all' | Difficulty;
  contestType: 'all' | 'weekly' | 'biweekly';
  problemIndex: 'all' | number;
  topic: string; // 'all' | a LeetCode topic
  progress: 'all' | ProgressStatus;
  curriculum: 'all' | CurriculumStatus;
  freeOnly: boolean;
  includeInferred: boolean;
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  pattern: 'all',
  band: 'all',
  difficulty: 'all',
  contestType: 'all',
  problemIndex: 'all',
  topic: 'all',
  progress: 'all',
  curriculum: 'all',
  freeOnly: false,
  includeInferred: false,
  search: '',
};

function asPatternId(value: string | null): PatternId | null {
  if (!value) return null;
  const meta = (patternById as Record<string, PatternMeta | undefined>)[value];
  return meta ? (value as PatternId) : null;
}

function toEngineFilter(f: Filters): ContestFilter {
  return {
    aicmPatterns: f.pattern === 'all' ? undefined : [f.pattern],
    ratingBands: f.band === 'all' ? undefined : [f.band],
    difficulty: f.difficulty === 'all' ? undefined : [f.difficulty],
    contestType: f.contestType === 'all' ? undefined : [f.contestType],
    problemIndex: f.problemIndex === 'all' ? undefined : [f.problemIndex],
    leetcodeTopics: f.topic === 'all' ? undefined : [f.topic],
    progress: f.progress === 'all' ? undefined : [f.progress],
    curriculumStatus: f.curriculum === 'all' ? undefined : [f.curriculum],
    includePremium: f.freeOnly ? false : undefined,
    includeInferredPatterns: f.includeInferred ? true : undefined,
    search: f.search.trim() === '' ? undefined : f.search,
  };
}

/**
 * The loosening most likely to help, stated as a suggestion — the filters themselves are kept.
 *
 * Each candidate is VERIFIED against the pool before being suggested: an empty result caused by
 * the status filter must not be answered with "widen the rating range" when widening it would
 * change nothing. Runs only when the result is already empty, so the extra filter passes are
 * off the hot path.
 */
function wideningHint(f: Filters, lookup: ProgressLookup, today: string): string {
  const candidates: { hint: string; patch: Partial<Filters>; applies: boolean }[] = [
    { hint: 'Try widening the rating range.', patch: { band: 'all' }, applies: f.band !== 'all' },
    { hint: 'Try a shorter search.', patch: { search: '' }, applies: f.search.trim() !== '' },
    { hint: 'Try clearing the status filter.', patch: { progress: 'all' }, applies: f.progress !== 'all' },
    {
      hint: 'Try including inferred pattern matches.',
      patch: { includeInferred: true },
      applies: f.pattern !== 'all' && !f.includeInferred,
    },
    { hint: 'Try clearing the difficulty filter.', patch: { difficulty: 'all' }, applies: f.difficulty !== 'all' },
    { hint: 'Try clearing the topic filter.', patch: { topic: 'all' }, applies: f.topic !== 'all' },
  ];
  for (const c of candidates) {
    if (!c.applies) continue;
    const widened = filterContestProblems(CONTEST_PROBLEMS, toEngineFilter({ ...f, ...c.patch }), lookup, today);
    if (widened.length > 0) return c.hint;
  }
  return 'Try clearing a filter or two.';
}

/* ------------------------------------------------------------------------------------------- */
/* Filter chips — the QuestionFilterRow idiom, applied to the library's own dimensions          */
/* ------------------------------------------------------------------------------------------- */

interface FilterChipsProps<T extends string | number> {
  label: string;
  options: readonly T[];
  value: T | 'all';
  onToggle: (option: T) => void;
  format?: (option: T) => string;
}

/** Single-select-with-clear toggles: clicking the active chip clears its dimension to 'all'. */
function FilterChips<T extends string | number>({
  label,
  options,
  value,
  onToggle,
  format,
}: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={GROUP_CLASS}>
      <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onToggle(option)}
          className={cn(CHIP_CLASS, value === option ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          {format ? format(option) : option}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* One problem row — a ruled details row: dense summary line, expanded detail                   */
/* ------------------------------------------------------------------------------------------- */

interface ProblemRowProps {
  problem: ContestLibraryProblem;
  state: ContestProblemState | undefined;
  today: string;
}

function ProblemRow({ problem, state, today }: ProblemRowProps) {
  const due = state !== undefined && state.nextRevision !== null && state.nextRevision <= today;
  const status =
    state === undefined ? null : due ? 'Due' : state.solved ? 'Solved' : state.attempts > 0 ? 'Attempted' : null;

  const { contest } = problem;
  const contestShort =
    contest.number !== null
      ? `${contest.type === 'biweekly' ? 'B' : 'W'}${contest.number} · Q${contest.index}`
      : `Q${contest.index}`;
  const contestLong =
    contest.number !== null
      ? `${contest.type === 'biweekly' ? 'Biweekly' : 'Weekly'} Contest ${contest.number} · Q${contest.index}`
      : `Q${contest.index}`;

  const firstPattern = problem.aicmPatterns[0];
  const firstInferred = problem.inferredPatterns[0];

  return (
    <RuledItem padded={false}>
      <details className="group">
        {/* The Disclosure idiom (Page.tsx) at row density: chevron-only affordance, no plate. */}
        <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-150 ease-swift marker:content-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-swift group-open:rotate-90 motion-reduce:transition-none"
          />
          <span aria-hidden="true" className="figures w-12 shrink-0 text-right text-xs text-muted-foreground">
            {problem.frontendId}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{problem.title}</span>

          {/* Pattern column: a confident mapping is a bare claim; an inferred one says so; an
              unmapped problem claims nothing at all (— is absence, not "no pattern exists"). */}
          <span className="hidden w-44 shrink-0 items-center gap-2 truncate text-xs text-muted-foreground lg:flex">
            {firstPattern ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: patternById[firstPattern].color }}
                />
                <span className="truncate text-foreground">{patternById[firstPattern].name}</span>
                {problem.aicmPatterns.length > 1 && (
                  <span className="figures shrink-0">+{problem.aicmPatterns.length - 1}</span>
                )}
              </>
            ) : firstInferred ? (
              <span className="truncate">Inferred · {patternById[firstInferred].name}</span>
            ) : (
              <span aria-hidden="true">—</span>
            )}
          </span>

          <span className="hidden w-20 shrink-0 text-right md:inline">
            <span className="figures text-xs text-muted-foreground">{contestShort}</span>
          </span>
          {/* Official difficulty is the one signal every row keeps at every width; the ZeroTrac
              estimate is the one that yields below `sm`. The reverse — rating shown, difficulty
              hidden — would present the estimate INSTEAD of the official difficulty on phones,
              which the type's own contract forbids (§3.4: beside, never instead). */}
          <span className="w-14 shrink-0 text-right text-xs">
            <DifficultyBadge difficulty={problem.officialDifficulty} variant="bare" />
          </span>
          <span className="figures hidden w-10 shrink-0 text-right text-xs text-muted-foreground sm:inline">
            <span className="sr-only">Contest rating </span>
            {problem.contestRating}
          </span>
          <span
            className={cn(
              'w-16 shrink-0 text-right text-xs',
              due ? 'text-medium' : status === 'Solved' ? 'text-easy' : 'text-muted-foreground',
            )}
          >
            {status}
          </span>
        </summary>

        <div className="flex flex-col gap-3 pb-4 pl-7">
          {/* Both signals, side by side, never merged: official difficulty AND the estimate. */}
          <Meta
            items={[
              <DifficultyBadge difficulty={problem.officialDifficulty} variant="bare" />,
              <Tooltip>
                <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                  Contest rating {problem.contestRating}
                </TooltipTrigger>
                <TooltipContent className="max-w-72">{CONTEST_RATING_NOTE}</TooltipContent>
              </Tooltip>,
              contestLong,
              <span className="figures">#{problem.frontendId}</span>,
              problem.premium && 'Premium',
              problem.curriculumQuestionId !== null && 'In the curriculum',
            ]}
          />

          {problem.aicmPatterns.length > 0 ? (
            <Meta
              items={[
                ...problem.aicmPatterns.map((id) => (
                  <Link
                    key={id}
                    to={`/patterns/${id}`}
                    className="transition-colors duration-150 ease-swift hover:text-primary"
                  >
                    <PatternChip pattern={patternById[id]} variant="bare" />
                  </Link>
                )),
                ...problem.aicmSubpatterns.map((id) => SUBPATTERN_NAME[id] ?? id),
              ]}
            />
          ) : problem.inferredPatterns.length > 0 ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              Inferred pattern:{' '}
              {problem.inferredPatterns.map((id) => patternById[id].name).join(', ')} — read from
              LeetCode topic tags, not verified.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Pattern mapping unavailable</p>
          )}

          {problem.leetcodeTopics.length > 0 && (
            <p className="text-xs text-muted-foreground">
              LeetCode topics: {problem.leetcodeTopics.join(' · ')}
            </p>
          )}

          {status && state && (
            <p className="figures text-xs text-muted-foreground">
              {due
                ? `Due for revision · scheduled ${shortDate(state.nextRevision!)}`
                : state.solved
                  ? `Solved${state.solvedOn ? ` ${shortDate(state.solvedOn)}` : ''}${
                      state.nextRevision
                        ? ` · next review ${shortDate(state.nextRevision)}`
                        : state.revisionStage >= 5
                          ? ' · mastered'
                          : ''
                    }`
                  : 'Attempted · not solved yet'}
            </p>
          )}

          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm font-medium text-primary hover:underline"
          >
            Open on LeetCode →
          </a>
        </div>
      </details>
    </RuledItem>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* The page                                                                                     */
/* ------------------------------------------------------------------------------------------- */

/** Rows painted before the first fold. Filters, not scrolling, are the intended way in. */
const FOLD_INITIAL = 50;
const FOLD_STEP = 150;

export default function ContestPracticePage() {
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPattern = asPatternId(searchParams.get('pattern'));

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    pattern: urlPattern ?? 'all',
  }));
  const [shown, setShown] = useState(FOLD_INITIAL);

  // The pattern-page CTA deep-links here with the filter already applied (§7.2). The initializer
  // covers the mount; this covers an in-app navigation that changes the query string while the
  // page is already mounted.
  useEffect(() => {
    if (urlPattern) setFilters((f) => ({ ...f, pattern: urlPattern }));
  }, [urlPattern]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  // The URL param mirrors the pattern choice, both ways. A stale `?pattern=` would silently
  // resurrect a filter the learner replaced or cleared the moment the page reloads.
  function syncPatternParam(value: Filters['pattern']) {
    const wanted = value === 'all' ? null : value;
    if (searchParams.get('pattern') === wanted) return;
    const next = new URLSearchParams(searchParams);
    if (wanted === null) next.delete('pattern');
    else next.set('pattern', wanted);
    setSearchParams(next, { replace: true });
  }

  function selectPattern(value: Filters['pattern']) {
    set({ pattern: value });
    syncPatternParam(value);
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    syncPatternParam('all');
  }

  const index = useMemo(() => buildContestIndex(CONTEST_PROBLEMS), []);

  const progressById = useAppSelector((s) => s.progress.byId);
  const contestBySlug = useAppSelector((s) => s.contestLibrary.bySlug);

  // The two registers behind one lookup: a bridged problem reads through to its ONE curriculum
  // record (progress.byId), a contest-only problem to the slug-keyed slice. Never two copies.
  const lookup = useMemo<ProgressLookup>(
    () => (slug: string) => {
      const problem = index.bySlug.get(slug);
      if (problem && problem.curriculumQuestionId !== null) {
        const qp = progressById[problem.curriculumQuestionId];
        return qp ? contestStateFromQuestionProgress(qp) : undefined;
      }
      return contestBySlug[slug];
    },
    [index, progressById, contestBySlug],
  );

  const engineFilter = useMemo(() => toEngineFilter(filters), [filters]);
  const active = isFilterActive(engineFilter);

  const matches = useMemo(
    () =>
      // Rating ascending: a filtered pool reads shallow end first, the same "opens achievably"
      // principle the session arc follows. Slug tiebreak keeps the order fully deterministic.
      filterContestProblems(CONTEST_PROBLEMS, engineFilter, lookup, today).sort(
        (a, b) => a.contestRating - b.contestRating || a.slug.localeCompare(b.slug),
      ),
    [engineFilter, lookup, today],
  );

  // A changed filter starts the fold over — the count above the list is the whole-result truth.
  const filterKey = JSON.stringify(filters);
  useEffect(() => setShown(FOLD_INITIAL), [filterKey]);

  const visible = matches.slice(0, shown);
  const hidden = matches.length - visible.length;

  const positions = useMemo(
    () => [...index.byProblemIndex.keys()].sort((a, b) => a - b),
    [index],
  );

  const advancedActive =
    [filters.difficulty, filters.contestType, filters.problemIndex, filters.topic, filters.progress, filters.curriculum].filter(
      (v) => v !== 'all',
    ).length +
    (filters.freeOnly ? 1 : 0) +
    (filters.includeInferred ? 1 : 0) +
    (filters.search.trim() !== '' ? 1 : 0);

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${NUM.format(CONTEST_PROBLEMS.length)} rated problems`}
        title="Contest Library"
        support="A pool of rated contest problems to draw practice from — filter by pattern and rating."
      />

      <ScreenBody>
        {/* The Screen step (`gap-5 lg:gap-6`) rides the Panel itself — a page-local wrapper
            re-declaring it is how rhythm drifts (DESIGN.md § The rhythm: pages do not set their
            own section step). */}
        <Panel className="gap-5 lg:gap-6">
          <section aria-label="Filters" className="flex flex-col gap-2">
            {/* Simple mode: pattern → rating. Everything else is behind the disclosure. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
                  Pattern
                </span>
                <Select
                  value={filters.pattern}
                  onValueChange={(v) => selectPattern(v as Filters['pattern'])}
                >
                  <SelectTrigger aria-label="Filter by pattern" className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patterns</SelectItem>
                    {PATTERNS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({index.byAicmPattern.get(p.id)?.length ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FilterChips
                label="Rating"
                options={RATING_BANDS.map((b) => b.id)}
                value={filters.band}
                onToggle={(id) => set({ band: filters.band === id ? 'all' : id })}
                format={(id) => BAND_LABEL[id] ?? id}
              />
            </div>

            <Disclosure
              summary="More filters"
              meta={advancedActive > 0 ? `${advancedActive} active` : undefined}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <FilterChips
                  label="Difficulty"
                  options={DIFFICULTY_OPTIONS}
                  value={filters.difficulty}
                  onToggle={(d) => set({ difficulty: filters.difficulty === d ? 'all' : d })}
                  format={(d) => DIFFICULTY_CHIP_LABEL[d]}
                />
                <FilterChips
                  label="Contest"
                  options={['weekly', 'biweekly'] as const}
                  value={filters.contestType}
                  onToggle={(t) => set({ contestType: filters.contestType === t ? 'all' : t })}
                  format={(t) => (t === 'weekly' ? 'Weekly' : 'Biweekly')}
                />
                <FilterChips
                  label="Position"
                  options={positions}
                  value={filters.problemIndex}
                  onToggle={(q) => set({ problemIndex: filters.problemIndex === q ? 'all' : q })}
                  format={(q) => `Q${q}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <FilterChips
                  label="Status"
                  options={PROGRESS_OPTIONS}
                  value={filters.progress}
                  onToggle={(s) => set({ progress: filters.progress === s ? 'all' : s })}
                  format={(s) => PROGRESS_LABEL[s]}
                />
                <FilterChips
                  label="Source"
                  options={CURRICULUM_OPTIONS}
                  value={filters.curriculum}
                  onToggle={(c) => set({ curriculum: filters.curriculum === c ? 'all' : c })}
                  format={(c) => CURRICULUM_LABEL[c]}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
                    Topic
                  </span>
                  <Select
                    value={filters.topic}
                    onValueChange={(v) => set({ topic: v })}
                  >
                    <SelectTrigger aria-label="Filter by LeetCode topic" className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All topics</SelectItem>
                      {index.topicsByFrequency.map(({ topic, count }) => (
                        <SelectItem key={topic} value={topic}>
                          {topic} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  aria-pressed={filters.freeOnly}
                  onClick={() => set({ freeOnly: !filters.freeOnly })}
                  className={cn(CHIP_CLASS, filters.freeOnly ? CHIP_ACTIVE : CHIP_IDLE)}
                >
                  Free only
                </button>
                {/* The learner choosing to widen — never the app pretending an inferred pattern
                    is a claim (engine/contestLibrary.ts on includeInferredPatterns). */}
                <button
                  type="button"
                  aria-pressed={filters.includeInferred}
                  onClick={() => set({ includeInferred: !filters.includeInferred })}
                  className={cn(CHIP_CLASS, filters.includeInferred ? CHIP_ACTIVE : CHIP_IDLE)}
                >
                  Include inferred patterns
                </button>
              </div>

              <Input
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
                placeholder="Search titles…"
                aria-label="Search problem titles"
                className="max-w-xs"
              />
            </Disclosure>
          </section>

          {/* Unnamed on purpose: the RuledList inside already carries the accessible name, and
              a second identical label would announce the same landmark twice. */}
          <section className="flex flex-col gap-2">
            <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span className="figures font-medium text-foreground">
                  {NUM.format(matches.length)}
                </span>{' '}
                matching {matches.length === 1 ? 'problem' : 'problems'}
              </p>
              {active && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>

            {matches.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching contest problems."
                hint={wideningHint(filters, lookup, today)}
              />
            ) : (
              <RuledList aria-label="Contest problems">
                {visible.map((p) => (
                  <ProblemRow key={p.slug} problem={p} state={lookup(p.slug)} today={today} />
                ))}
                {hidden > 0 && (
                  <RuledItem padded={false}>
                    {/* The fold: the last row of its own list, one-way (DESIGN.md § projection kit). */}
                    <button
                      type="button"
                      onClick={() => setShown((s) => s + FOLD_STEP)}
                      className="flex min-h-11 w-full items-center gap-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground lg:min-h-9"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>Show {NUM.format(Math.min(FOLD_STEP, hidden))} more</span>
                      <span className="figures ml-auto text-xs">{NUM.format(hidden)} remaining</span>
                    </button>
                  </RuledItem>
                )}
              </RuledList>
            )}
          </section>
        </Panel>
      </ScreenBody>
    </Screen>
  );
}
