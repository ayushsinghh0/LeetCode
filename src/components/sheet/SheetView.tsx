import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Meta, RuledItem, RuledList, Section } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CHIP_ACTIVE, CHIP_CLASS, CHIP_IDLE } from '@/components/shared/QuestionFilterRow';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { SHEET_ROWS, SHEET_TOPICS } from '@/data/revisionSheet';
import { contestProblemBySlug } from '@/data/contestLibrary';
import { selectQuestionById } from '@/store/selectors';
import {
  sheetEntry,
  sheetStats,
  type SheetEntry,
  type SheetResolvers,
} from '@/utils/engine/revisionSheet';
import { CONTEST_RATING_NOTE, CONTEST_TARGET_MINUTES } from '@/utils/engine/contestLibrary';
import { selectContestSet, type ContestCandidate } from '@/utils/engine/contest';
import { solveSheetProblem, startFilteredContest } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import type { FilteredContestProblem } from '@/store/slices/contestSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import type { Difficulty, SheetSubtopic, SheetTopic } from '@/types';

/**
 * The revision sheet as a browsable lens (V14) — the second view on /contest-practice, never a
 * 17th nav destination (D4: the 590px rail has room for exactly sixteen rows).
 *
 * Every row here references the universe that owns it. Curriculum rows are REFERENCE rows:
 * status shown, opened through the question sheet, never mutated from here — the roadmap's own
 * surfaces do that. Library and sheet-only rows live on the slug register and take the sheet's
 * one direct write, `solveSheetProblem`. External rows are display only: platform named, nothing
 * linked, nothing tracked (D2 — a fabricated link is the failure this pipeline exists to avoid).
 *
 * This component is statically imported by ContestPracticePage, so it rides that page's lazy
 * chunk beside the `data-contests` and `data-sheet` datasets it reads. Nothing in the store
 * imports either.
 */

const NUM = new Intl.NumberFormat('en-US');

/** How many problems a timed sub-topic set aims for — the filtered draw's own size. */
const DRAW_COUNT = 4;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const shortDate = (iso: string): string => format(parseISO(iso), 'MMM d');

/** The number LeetCode displays for a row, resolved from whichever universe owns it. */
function frontendIdOf(entry: SheetEntry): number | undefined {
  const ref = entry.row.ref;
  if (ref.kind === 'sheet') return ref.problem.frontendId;
  if (ref.kind === 'library') return contestProblemBySlug.get(ref.slug)?.frontendId;
  if (ref.kind === 'curriculum') return selectQuestionById(ref.questionId)?.leetcodeId;
  return undefined;
}

/* ------------------------------------------------------------------------------------------- */
/* One sheet row                                                                                */
/* ------------------------------------------------------------------------------------------- */

interface SheetRowItemProps {
  entry: SheetEntry;
  onMarkSolved: (slug: string, difficulty: Difficulty) => void;
  onViewInCurriculum: (questionId: number) => void;
}

/** Exported for its own unit test — the verified-link rendering has no dataset row to pin it on
 *  while `external-links.json` ships empty. Everything else reaches it through SheetView. */
export function SheetRowItem({ entry, onMarkSolved, onViewInCurriculum }: SheetRowItemProps) {
  const ref = entry.row.ref;

  // Untracked rows: a muted statement, no disclosure for externals (there is nothing behind it),
  // a note disclosure for the one ambiguous row. A link appears ONLY when the hand-verified
  // external-links table supplied one (T1.13) — unlisted rows stay unlinked, never guessed.
  if (ref.kind === 'external') {
    return (
      <RuledItem padded={false}>
        <div className="flex min-h-11 items-center gap-3 py-2 text-sm text-muted-foreground">
          <span aria-hidden="true" className="figures w-8 shrink-0 text-right text-xs">
            {entry.row.order + 1}
          </span>
          {ref.url !== null ? (
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-medium text-foreground transition-colors duration-150 ease-swift hover:text-primary"
            >
              {entry.title}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          )}
          <span className="shrink-0 truncate text-xs">not on LeetCode · {ref.platform}</span>
        </div>
      </RuledItem>
    );
  }
  if (ref.kind === 'ambiguous') {
    return (
      <RuledItem padded={false}>
        <details className="group">
          <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors duration-150 ease-swift marker:content-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform duration-150 ease-swift group-open:rotate-90 motion-reduce:transition-none"
            />
            <span className="min-w-0 flex-1 truncate">{entry.title}</span>
            <span className="shrink-0 text-xs">unresolved</span>
          </summary>
          <p className="max-w-prose pb-4 pl-7 text-sm text-muted-foreground">{ref.note}</p>
        </details>
      </RuledItem>
    );
  }

  const due = entry.status === 'due';
  const statusLabel =
    due ? 'Due' : entry.status === 'solved' ? 'Solved' : entry.status === 'attempted' ? 'Attempted' : null;
  const solved = entry.state?.solved === true;
  const frontendId = frontendIdOf(entry);

  return (
    <RuledItem padded={false}>
      <details className="group">
        <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-150 ease-swift marker:content-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-swift group-open:rotate-90 motion-reduce:transition-none"
          />
          <span aria-hidden="true" className="figures w-8 shrink-0 text-right text-xs text-muted-foreground">
            {entry.row.order + 1}
          </span>
          {/* The id yields below `sm` — the library row's own 375px correction, kept. */}
          {frontendId !== undefined && (
            <span aria-hidden="true" className="figures hidden w-12 shrink-0 text-right text-xs text-muted-foreground sm:inline">
              {frontendId}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{entry.title}</span>
          {entry.onRoadmap && (
            <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">On roadmap</span>
          )}
          <span className="w-14 shrink-0 text-right text-xs">
            {entry.officialDifficulty !== null && entry.officialDifficulty !== 'theory' && (
              <DifficultyBadge difficulty={entry.officialDifficulty} variant="bare" />
            )}
          </span>
          {/* The ZeroTrac estimate rides only rows that HAVE one — absence stays absent. */}
          <span className="figures hidden w-10 shrink-0 text-right text-xs text-muted-foreground sm:inline">
            {entry.contestRating ?? ''}
          </span>
          <span
            className={cn(
              'w-16 shrink-0 text-right text-xs',
              due ? 'text-medium' : statusLabel === 'Solved' ? 'text-easy' : 'text-muted-foreground',
            )}
          >
            {statusLabel}
          </span>
        </summary>

        <div className="flex flex-col gap-3 pb-4 pl-7">
          <Meta
            items={[
              entry.officialDifficulty !== null && entry.officialDifficulty !== 'theory' && (
                <DifficultyBadge difficulty={entry.officialDifficulty} variant="bare" />
              ),
              entry.contestRating !== null && (
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                    Contest rating {entry.contestRating}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">{CONTEST_RATING_NOTE}</TooltipContent>
                </Tooltip>
              ),
              frontendId !== undefined && <span className="figures">#{frontendId}</span>,
              entry.premium && 'Premium',
            ]}
          />

          {entry.state && statusLabel && (
            <p className="figures text-xs text-muted-foreground">
              {due
                ? `Due for revision · scheduled ${shortDate(entry.state.nextRevision!)}`
                : solved
                  ? `Solved${entry.state.solvedOn ? ` ${shortDate(entry.state.solvedOn)}` : ''}${
                      entry.state.nextRevision
                        ? ` · next review ${shortDate(entry.state.nextRevision)}`
                        : entry.state.revisionStage >= 5
                          ? ' · mastered'
                          : ''
                    }`
                  : 'Attempted · not solved yet'}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {ref.kind === 'curriculum' ? (
              // A reference row: the roadmap owns it. Status shown above; mutation happens on the
              // roadmap's own surfaces, through the question sheet (D9).
              <Button variant="outline" size="sm" onClick={() => onViewInCurriculum(ref.questionId)}>
                View in curriculum
              </Button>
            ) : solved ? (
              <p className="figures text-xs text-muted-foreground">
                Solved{entry.state?.nextRevision ? ` · next review ${shortDate(entry.state.nextRevision)}` : ''}
              </p>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  entry.slug !== null &&
                  entry.officialDifficulty !== null &&
                  entry.officialDifficulty !== 'theory' &&
                  onMarkSolved(entry.slug, entry.officialDifficulty)
                }
              >
                Mark solved
              </Button>
            )}
            {entry.url !== null && ref.kind !== 'curriculum' && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Open on LeetCode →
              </a>
            )}
          </div>
        </div>
      </details>
    </RuledItem>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* The view                                                                                     */
/* ------------------------------------------------------------------------------------------- */

export interface SheetViewProps {
  /** A live sitting is a commitment; the Start buttons say so instead of stomping it. */
  contestRunning: boolean;
}

export function SheetView({ contestRunning }: SheetViewProps) {
  const today = useToday();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const progressById = useAppSelector((s) => s.progress.byId);
  const contestBySlug = useAppSelector((s) => s.contestLibrary.bySlug);

  const [includeRoadmap, setIncludeRoadmap] = useState(false);

  const resolvers = useMemo<SheetResolvers>(
    () => ({
      questionById: selectQuestionById,
      libraryBySlug: (slug) => contestProblemBySlug.get(slug),
      questionState: (id) => progressById[id],
      slugState: (slug) => contestBySlug[slug],
    }),
    [progressById, contestBySlug],
  );

  const stats = useMemo(() => sheetStats(SHEET_ROWS, resolvers, today), [resolvers, today]);

  /** The sub-topic's revisable pool for a timed set — the exclusion rule applied at draw time. */
  function eligibleOf(sub: SheetSubtopic): SheetEntry[] {
    return sub.rows
      .map((row) => sheetEntry(row, resolvers, today))
      .filter((e): e is SheetEntry => e !== null && e.identity !== null)
      .filter((e) => e.state?.solved !== true)
      .filter((e) => includeRoadmap || !e.onRoadmap);
  }

  /**
   * A timed set from one sub-topic, through the same door every other draw uses:
   * `selectContestSet` composes it, `startFilteredContest` normalizes and runs it.
   * `distinctPatterns: false` on purpose — a sub-topic IS one theme (the weak-areas precedent).
   *
   * Row mapping extends the page's negative-id rule to entries the library index cannot resolve:
   * a curriculum row keeps its REAL id (one problem, one record), everything else — library and
   * sheet-only alike — gets a sitting-local negative ordinal, so no number here can ever collide
   * with the roadmap's id space (the ID trap).
   */
  function startTimedSet(topic: SheetTopic, sub: SheetSubtopic) {
    const eligible = eligibleOf(sub);
    const byIdentity = new Map(eligible.map((e) => [e.identity!, e]));
    const seed = `${today}|sheet|${topic.name}|${sub.name}|${includeRoadmap}`;

    const candidates: ContestCandidate[] = eligible.map((e) => {
      const difficulty =
        e.officialDifficulty === 'easy' || e.officialDifficulty === 'hard'
          ? e.officialDifficulty
          : 'medium';
      return {
        key: e.identity!,
        difficulty,
        patterns: e.patterns,
        targetMinutes:
          (e.questionId !== null ? selectQuestionById(e.questionId)?.estimatedTime : undefined) ??
          CONTEST_TARGET_MINUTES[difficulty],
        contestRating: e.contestRating,
        contestSlug: e.slug !== null ? (contestProblemBySlug.get(e.slug)?.contest.slug ?? null) : null,
      };
    });

    const picked = selectContestSet(
      candidates,
      { count: DRAW_COUNT, distinctPatterns: false, distinctContests: true },
      seed,
    );

    const rows: FilteredContestProblem[] = picked.map((candidate, i) => {
      const e = byIdentity.get(candidate.key)!;
      const lib = e.slug !== null ? contestProblemBySlug.get(e.slug) : undefined;
      return {
        id: e.questionId ?? -(i + 1),
        kind: e.questionId !== null ? ('curriculum' as const) : ('library' as const),
        slug: e.slug ?? `q${e.questionId}`,
        title: e.title,
        url: e.url ?? '',
        difficulty: candidate.difficulty,
        targetMinutes: candidate.targetMinutes,
        patterns: e.patterns,
        contestLabel:
          lib && lib.contest.number !== null
            ? `${lib.contest.type === 'biweekly' ? 'Biweekly' : 'Weekly'} Contest ${lib.contest.number} · Q${lib.contest.index}`
            : null,
        contestRating: e.contestRating,
        frontendId: frontendIdOf(e) ?? 0,
        premium: e.premium,
        reasons: [
          `From the sheet: ${topic.name} → ${sub.name}`,
          e.contestRating !== null
            ? `Contest rating ${e.contestRating}`
            : DIFFICULTY_LABEL[candidate.difficulty],
          (e.state?.attempts ?? 0) > 0 ? 'Attempted before, never solved' : 'Not solved yet',
        ],
      };
    });

    if (rows.length === 0) return;
    dispatch(startFilteredContest(rows, seed));
    navigate('/contest');
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Unique problems, not rows — a problem listed under two sub-topics counts once. */}
        <Meta
          items={[
            <span>
              <span className="figures font-medium text-foreground">{NUM.format(stats.solved)}</span> of{' '}
              <span className="figures">{NUM.format(stats.tracked)}</span> solved
            </span>,
            <span className="figures">{stats.due} due</span>,
            <span className="figures">{stats.untracked} not on LeetCode</span>,
          ]}
        />
        {/* THE toggle (spec §6): roadmap problems are structurally excluded from draws until the
            learner asks — the roadmap already schedules them through the daily plan. */}
        <button
          type="button"
          aria-pressed={includeRoadmap}
          onClick={() => setIncludeRoadmap((v) => !v)}
          className={cn(CHIP_CLASS, includeRoadmap ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          Include problems already on my roadmap
        </button>
      </div>

      <RuledList aria-label="Sheet topics">
        {SHEET_TOPICS.map((topic) => {
          const topicRows = topic.subtopics.flatMap((s) => s.rows);
          const topicStats = sheetStats(topicRows, resolvers, today);
          return (
            <RuledItem key={topic.index} padded={false}>
              <details className="group">
                <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 ease-swift marker:content-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-swift group-open:rotate-90 motion-reduce:transition-none"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
                  {topicStats.due > 0 && (
                    <span className="figures shrink-0 text-xs text-medium">{topicStats.due} due</span>
                  )}
                  <span className="figures w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {topicStats.solved}/{topicStats.tracked}
                  </span>
                </summary>

                <div className="flex flex-col gap-6 pb-6 pl-7 pt-2">
                  {topic.subtopics.map((sub) => {
                    const eligible = eligibleOf(sub);
                    return (
                      <Section
                        key={sub.index}
                        level={3}
                        title={sub.name}
                        aria-label={sub.name}
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startTimedSet(topic, sub)}
                            disabled={eligible.length === 0 || contestRunning}
                            title={
                              contestRunning
                                ? 'A contest is already running — finish it first.'
                                : eligible.length === 0
                                  ? 'Nothing here is left to draw — everything is solved or on your roadmap.'
                                  : undefined
                            }
                          >
                            Start timed set
                          </Button>
                        }
                      >
                        <RuledList aria-label={`${sub.name} problems`}>
                          {sub.rows.map((row) => {
                            const entry = sheetEntry(row, resolvers, today);
                            if (entry === null) return null;
                            return (
                              <SheetRowItem
                                key={`${row.subtopicIndex}|${row.order}`}
                                entry={entry}
                                onMarkSolved={(slug, difficulty) =>
                                  dispatch(solveSheetProblem(slug, difficulty))
                                }
                                onViewInCurriculum={(id) => dispatch(activeQuestionSet(id))}
                              />
                            );
                          })}
                        </RuledList>
                      </Section>
                    );
                  })}
                </div>
              </details>
            </RuledItem>
          );
        })}
      </RuledList>
    </div>
  );
}
