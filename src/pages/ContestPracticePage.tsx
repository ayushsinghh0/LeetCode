import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Play, SearchX } from 'lucide-react';
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
  CONTEST_TARGET_MINUTES,
  RATING_BANDS,
  WEAK_PATTERN_REASON,
  bandEvidenceFromRegister,
  buildContestIndex,
  contestStateFromQuestionProgress,
  filterContestProblems,
  isFilterActive,
  recommendBand,
  selectionReason,
  type ContestFilter,
  type ContestProblemState,
  type CurriculumStatus,
  type ProgressLookup,
  type ProgressStatus,
} from '@/utils/engine/contestLibrary';
import { selectContestSet, type ContestCandidate } from '@/utils/engine/contest';
import { startFilteredContest } from '@/store/actions';
import { selectPatternWeakness } from '@/store/selectors';
import type { FilteredContestProblem } from '@/store/slices/contestSlice';
import questionsData from '@/data/questions.json';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import type { ContestLibraryProblem, Difficulty, PatternId, PatternMeta, Question } from '@/types';

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

// Bridged rows are curriculum questions and keep their own authored estimate; only the 2,354
// library-only problems fall back to the explicit per-difficulty constants.
const questionEstimateById = new Map(
  (questionsData as Question[]).map((q) => [q.id, q.estimatedTime]),
);

/** How many problems a filtered draw aims for — Full Contest's own set size. */
const DRAW_COUNT = 4;

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
  /** Sit this problem's contest of origin again, Q1 first — the whole contest, under the clock. */
  onRecreate: () => void;
  recreateDisabled: boolean;
}

function ProblemRow({ problem, state, today, onRecreate, recreateDisabled }: ProblemRowProps) {
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
          {/* The id yields below `sm`. Measured at 375px, the fixed id and status columns left the
              title 111px — about twelve characters — on the one width where the title is the only
              thing a reader has. It is `aria-hidden` scanning furniture, and the expanded detail
              states it as `#1108`, so nothing is lost by dropping it on a phone. */}
          <span aria-hidden="true" className="figures hidden w-12 shrink-0 text-right text-xs text-muted-foreground sm:inline">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Every contest in the library is complete (639 × Q1–Q4, one × Q1–Q5, measured
                2026-08-20), so this is always the whole contest — never a partial set wearing
                the name. */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRecreate}
              disabled={recreateDisabled}
              title={recreateDisabled ? 'A contest is already running — finish it first.' : undefined}
            >
              Recreate this contest
            </Button>
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open on LeetCode →
            </a>
          </div>
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
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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
  // A live sitting is a commitment; the thunk refuses to stomp one, and the button says so here.
  const contestRunning = useAppSelector(
    (s) => s.contest.seed !== null && s.contest.finishedAtMs === null,
  );

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

  // The draw pool: exactly what the filters show, minus anything already solved in either
  // register — a contest draws from problems you haven't solved, same premise as Full Contest.
  const drawPool = useMemo(
    () => matches.filter((p) => lookup(p.slug)?.solved !== true),
    [matches, lookup],
  );

  // Weak patterns resolve HERE, at the lazy page's call site, never in the store — the one
  // weakness model's output, head-of-list order preserved. Only confident (exact/strong)
  // mappings may satisfy the `aicmPatterns` filter, so a problem can never land in the weak
  // pool on the strength of a guess.
  const weakness = useAppSelector((s) => selectPatternWeakness(s, today));
  const weakPatterns = useMemo(() => weakness.map((w) => w.id), [weakness]);
  const weakPool = useMemo(
    () =>
      weakPatterns.length === 0
        ? []
        : filterContestProblems(
            CONTEST_PROBLEMS,
            { aicmPatterns: weakPatterns },
            lookup,
            today,
          ).filter((p) => lookup(p.slug)?.solved !== true),
    [weakPatterns, lookup, today],
  );

  /**
   * What the learner's own contest practice says about the band worth working in. The evidence is
   * the slug register only — bridged curriculum solves are done with the roadmap's guidance and no
   * clock, so they say nothing about contest conditions, and self-reported sheet ticks are
   * excluded inside `bandEvidenceFromRegister` for the same reason (the register holds sheet work
   * too now; an untimed tick is a claim, not an outcome). Below `recommendBand`'s stated minimum
   * this is null and the page simply says nothing; the Contest Revision rail is the surface that
   * narrates progress toward the threshold.
   */
  const bandReading = useMemo(
    () =>
      recommendBand(
        bandEvidenceFromRegister(contestBySlug, (slug) => index.bySlug.get(slug)?.contestRating),
      ),
    [contestBySlug, index],
  );

  const toCandidates = (pool: readonly ContestLibraryProblem[]): ContestCandidate[] =>
    pool.map((p) => ({
      key: p.slug,
      difficulty: p.officialDifficulty,
      patterns: p.aicmPatterns,
      targetMinutes:
        (p.curriculumQuestionId !== null
          ? questionEstimateById.get(p.curriculumQuestionId)
          : undefined) ?? CONTEST_TARGET_MINUTES[p.officialDifficulty],
      contestRating: p.contestRating,
      contestSlug: p.contest.slug,
    }));

  // The ONE FilteredContestProblem mapping, shared by every entry point — the negative-id rule
  // lives here and nowhere else. Bridged rows keep their curriculum identity (one problem, one
  // record); library-only rows get a sitting-local NEGATIVE key so nothing numeric can ever
  // collide with the roadmap's id space (the ID trap).
  const toRows = (
    picked: ContestCandidate[],
    reasonsFor: (p: ContestLibraryProblem) => string[],
  ): FilteredContestProblem[] =>
    picked.map((candidate, i) => {
      const p = index.bySlug.get(candidate.key)!;
      return {
        id: p.curriculumQuestionId ?? -(i + 1),
        kind: p.curriculumQuestionId !== null ? ('curriculum' as const) : ('library' as const),
        slug: p.slug,
        title: p.title,
        url: p.url,
        difficulty: p.officialDifficulty,
        targetMinutes: candidate.targetMinutes,
        patterns: p.aicmPatterns,
        contestLabel:
          p.contest.number !== null
            ? `${p.contest.type === 'biweekly' ? 'Biweekly' : 'Weekly'} Contest ${p.contest.number} · Q${p.contest.index}`
            : null,
        contestRating: p.contestRating,
        frontendId: p.frontendId,
        premium: p.premium,
        reasons: reasonsFor(p),
      };
    });

  function startSitting(rows: FilteredContestProblem[], seed: string) {
    if (rows.length === 0) return;
    dispatch(startFilteredContest(rows, seed));
    navigate('/contest');
  }

  // The §63 journey: filters → a seeded 4-problem timed set → ContestPage's clock. Seeded by the
  // date AND the filter signature, so the same filters rebuild the same set today — until a solve
  // removes a problem from the pool, exactly Full Contest's own seeding promise.
  function startContestFromFilters() {
    const seed = `${today}|${JSON.stringify(engineFilter)}`;
    const picked = selectContestSet(
      toCandidates(drawPool),
      { count: DRAW_COUNT, distinctPatterns: true, distinctContests: true },
      seed,
    );
    startSitting(
      toRows(picked, (p) => {
        // The reason names the pattern the learner FILTERED BY, not the problem's first tag.
        // "Minimum Operations to Make Binary Palindrome" carries
        // ['bitwise-manipulation','modified-binary-search','two-pointers'], so a two-pointers
        // draw was explaining itself with "Why this problem? Bitwise Manipulation" — a stated
        // reason that had nothing to do with why the problem was selected. Falls back to the
        // first tag when no pattern filter is set, or when the match came from an inferred
        // pattern (which is evidentially inert and must never be named as a confident claim).
        const primary =
          filters.pattern !== 'all' && p.aicmPatterns.includes(filters.pattern)
            ? filters.pattern
            : p.aicmPatterns[0];
        return selectionReason(
          p,
          lookup(p.slug),
          today,
          primary ? patternById[primary].name : undefined,
        );
      }),
      seed,
    );
  }

  // The weak-areas contest (slice 7): a mixed-pattern set drawn from the patterns the one
  // weakness model names. `distinctPatterns: false` on purpose — this draw exists to concentrate
  // on weakness, and forcing the set to span patterns would dilute the very thing it is for.
  // Contest diversity stays on: four problems from one afternoon is a different sitting.
  function startWeakAreasContest() {
    const seed = `${today}|weak|${weakPatterns.join(',')}`;
    const picked = selectContestSet(
      toCandidates(weakPool),
      { count: DRAW_COUNT, distinctPatterns: false, distinctContests: true },
      seed,
    );
    startSitting(
      toRows(picked, (p) => {
        // The stated reason is the actual selection reason: the weak pattern this problem
        // carries (strongest-ranked first), then the one weakness model's own sentence.
        const primary = weakPatterns.find((w) => p.aicmPatterns.includes(w)) ?? p.aicmPatterns[0];
        const reasons = selectionReason(
          p,
          lookup(p.slug),
          today,
          primary ? patternById[primary].name : undefined,
        );
        reasons.splice(primary ? 1 : 0, 0, WEAK_PATTERN_REASON);
        return reasons;
      }),
      seed,
    );
  }

  // Recreate contest (slice 7): one contest's own problems, original Q-order, under the clock.
  // Solved rows are INCLUDED — a recreation is the whole contest, not the unsolved remainder of
  // one, and both solve paths are idempotent so nothing can be farmed. `distinctContests: false`
  // because taking every problem from one sitting is the entire point; the count is the contest's
  // own size, so Weekly 68's Q5 rides along rather than being capped at the draw size.
  function recreateContest(contestSlug: string) {
    const members = (index.byContest.get(contestSlug) ?? []).map(
      (slug) => index.bySlug.get(slug)!,
    );
    const seed = `${today}|recreate|${contestSlug}`;
    const picked = selectContestSet(
      toCandidates(members),
      { count: members.length, distinctPatterns: false, distinctContests: false },
      seed,
    );
    picked.sort(
      (a, b) => index.bySlug.get(a.key)!.contest.index - index.bySlug.get(b.key)!.contest.index,
    );
    startSitting(
      toRows(picked, (p) =>
        selectionReason(
          p,
          lookup(p.slug),
          today,
          p.aicmPatterns[0] ? patternById[p.aicmPatterns[0]].name : undefined,
        ),
      ),
      seed,
    );
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${NUM.format(CONTEST_PROBLEMS.length)} rated problems`}
        title="Contest Library"
        support="A pool of rated contest problems to draw practice from — filter by pattern and rating, then start a timed set from what matches."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* A mixed-pattern draw from the one weakness model's output. Disabled — never
                hidden — when weakness has nothing to say: the affordance stays discoverable
                while the claim it rests on fails toward silence. */}
            <Button
              variant="outline"
              onClick={startWeakAreasContest}
              disabled={weakPool.length === 0 || contestRunning}
              title={
                contestRunning
                  ? 'A contest is already running — finish it first.'
                  : weakPatterns.length === 0
                    ? 'Nothing yet says a pattern is not holding — recognition drills and graded reviews build that evidence.'
                    : undefined
              }
            >
              Weak-areas contest
            </Button>
            <Button
              onClick={startContestFromFilters}
              disabled={drawPool.length === 0 || contestRunning}
              title={contestRunning ? 'A contest is already running — finish it first.' : undefined}
            >
              <Play /> Start contest
            </Button>
          </div>
        }
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

            {/* The band reading (slice 7), beside the control it informs. A statement about the
                PROBLEMS, never about the learner (§31), with its sample size in the sentence —
                the timeEstimate.ts discipline. Below the evidence minimum it renders nothing;
                the Contest Revision rail is where progress toward the threshold is narrated. */}
            {bandReading && (
              <p className="max-w-prose text-sm text-muted-foreground">
                {bandReading.statement}{' '}
                {/* The basis travels with the claim (A5.4): the register holds sheet ticks too
                    now, so the sentence says which work counted. */}
                <span className="figures">
                  From {bandReading.sampleSize} rated{' '}
                  {bandReading.sampleSize === 1 ? 'outcome' : 'outcomes'} in timed practice.
                </span>
                {filters.band !== bandReading.band.id && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => set({ band: bandReading.band.id })}
                      className="font-medium text-primary hover:underline"
                    >
                      Filter to {bandReading.band.label}
                    </button>
                  </>
                )}
              </p>
            )}

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
                  <ProblemRow
                    key={p.slug}
                    problem={p}
                    state={lookup(p.slug)}
                    today={today}
                    onRecreate={() => recreateContest(p.contest.slug)}
                    recreateDisabled={contestRunning}
                  />
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
