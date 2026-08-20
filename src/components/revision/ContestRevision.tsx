import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Disclosure,
  Meta,
  PageColumns,
  RuledItem,
  RuledList,
  Section,
} from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PATTERNS, patternById } from '@/data/patterns';
import { CONTEST_PROBLEMS, contestProblemBySlug } from '@/data/contestLibrary';
import {
  CONTEST_RATING_NOTE,
  MIN_BAND_EVIDENCE,
  contestStateFromQuestionProgress,
  recommendBand,
  scoreRevisionCandidates,
  type ContestFilter,
  type ContestProblemState,
  type ProgressLookup,
  type ScoredProblem,
} from '@/utils/engine/contestLibrary';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';
import { reviseLibraryProblem, reviseQuestion } from '@/store/actions';
import { selectPatternWeakness } from '@/store/selectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import type { ContestLibraryProblem, PatternId } from '@/types';

/**
 * Contest Revision — the second universe's half of the revision page (V13 slice 6, design §7.3).
 *
 * WHY THIS IS A SEPARATE, LAZILY-MOUNTED COMPONENT. It imports `@/data/contestLibrary`, and
 * `/revision` is a daily route: a static import would drag the 336 kB `data-contests` chunk onto
 * a page most learners open every morning without ever choosing this mode. `RevisionPage`
 * `lazy()`-es it behind the mode chips — the same latch idiom `AppShell` uses for the question
 * sheet — so the dataset is fetched the first time someone actually asks for contest revision.
 *
 * WHAT IT IS NOT. It is not a second revision engine and not a second session. Standard revision's
 * preview → frozen run → complete flow, `sessionSlice`, and every word of its copy are untouched;
 * this mode sits beside them under its own top-level state. Ranking is `scoreRevisionCandidates`
 * — the one contest-library scorer, already written and tested — and grading moves the one
 * 1/3/7/15/30 ladder through the ordinary thunks.
 *
 * The page splits the ranked pool in two because they are different offers, and merging them would
 * make one of them a lie: **Due now** is revision (the ladder's date has arrived, and a grade is
 * owed), while **Worth practising** is acquisition (nothing is due; these are simply the problems
 * the evidence ranks highest). A single list with a grade button on some rows and not others would
 * read as one queue you are behind on, which is precisely the debt notice the standard page was
 * rebuilt to stop being.
 */

/** Which pool the ranked list is drawn from. `standard` never reaches this component. */
export type ContestRevisionMode = 'contest' | 'weak' | 'pattern';

const NUM = new Intl.NumberFormat('en-US');

const DUE_INITIAL = 8;
const DUE_STEP = 12;
/** The practice list is a recommendation, not a queue — a handful, then the Library for the rest. */
const PRACTICE_SHOWN = 6;

const shortDate = (iso: string): string => format(parseISO(iso), 'MMM d');

/* ------------------------------------------------------------------------------------------- */
/* One row                                                                                      */
/* ------------------------------------------------------------------------------------------- */

function contestLabel(problem: ContestLibraryProblem): string | null {
  const { contest } = problem;
  if (contest.number === null) return null;
  return `${contest.type === 'biweekly' ? 'Biweekly' : 'Weekly'} Contest ${contest.number} · Q${contest.index}`;
}

interface RowProps {
  scored: ScoredProblem;
  state: ContestProblemState | undefined;
  today: string;
  /**
   * The pattern this pool is scoped to, when it is scoped to one. Named in preference to the
   * problem's first tag: a problem carrying ['bitwise-manipulation','modified-binary-search',
   * 'two-pointers'] is in a two-pointers pool because of its THIRD tag, and naming the first
   * explains the row with something that had nothing to do with why it is here.
   */
  scopedPattern?: PatternId;
  /** Grade controls, or the sentence that replaces them. Absent on the practice list. */
  action?: ReactNode;
}

function CandidateRow({ scored, state, today, scopedPattern, action }: RowProps) {
  const { problem, reasons } = scored;
  const label = contestLabel(problem);
  const primary =
    scopedPattern !== undefined && problem.aicmPatterns.includes(scopedPattern)
      ? scopedPattern
      : problem.aicmPatterns[0];

  return (
    <RuledItem className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Meta
            items={[
              <DifficultyBadge difficulty={problem.officialDifficulty} variant="bare" />,
              // The estimate is shown BESIDE the official difficulty, never instead of it, and it
              // carries its own basis (§3.4 — the rating is ZeroTrac's and is never called official).
              <Tooltip>
                <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                  Contest rating {problem.contestRating}
                </TooltipTrigger>
                <TooltipContent className="max-w-72">{CONTEST_RATING_NOTE}</TooltipContent>
              </Tooltip>,
              label,
              // A confident mapping names the pattern; an unmapped problem claims nothing at all
              // rather than borrowing an inferred one, which is evidentially inert by contract.
              primary ? patternById[primary].name : null,
              problem.curriculumQuestionId !== null && 'In the curriculum',
              problem.premium && 'Premium',
            ]}
          />
          <p className="font-medium">{problem.title}</p>
          {/* The scorer's own reasons, verbatim — "Why this problem?" (§45) answered by the thing
              that actually did the choosing, never by a sentence written next to it. */}
          <p className="max-w-prose text-sm text-muted-foreground">{reasons.join(' · ')}</p>
          {/* The schedule belongs to the practice list alone, and both halves of that are
              deliberate. A due row's date is in the PAST, so "Next review Aug 13" would read as a
              future appointment that has already gone; and the moment it is graded its own action
              says "Reviewed today · next review Aug 27" — printing the same date directly above
              that is the figure-stated-twice problem, which only invites hunting for a difference
              that is not there. Absence of an `action` is what identifies the practice list. */}
          {action === undefined && state?.solved && state.nextRevision !== null && state.nextRevision > today && (
            <p className="figures text-xs text-muted-foreground">
              Next review {shortDate(state.nextRevision)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {action}
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
    </RuledItem>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* The mode                                                                                     */
/* ------------------------------------------------------------------------------------------- */

export default function ContestRevision({ mode }: { mode: ContestRevisionMode }) {
  const today = useToday();
  const dispatch = useAppDispatch();

  const progressById = useAppSelector((s) => s.progress.byId);
  const contestBySlug = useAppSelector((s) => s.contestLibrary.bySlug);
  const weakness = useAppSelector((s) => selectPatternWeakness(s, today));
  const revisionEnabled = useAppSelector((s) => s.settings.revisionEnabled);

  const [pattern, setPattern] = useState<PatternId | ''>('');
  const [dueShown, setDueShown] = useState(DUE_INITIAL);

  // The two registers behind one lookup, exactly as the Library page composes it: a bridged
  // problem reads through to its ONE curriculum record, a contest-only problem to the slug-keyed
  // slice. Two ad-hoc mappings would eventually disagree about what "solved" means.
  const lookup = useMemo<ProgressLookup>(
    () => (slug: string) => {
      const problem = contestProblemBySlug.get(slug);
      if (problem && problem.curriculumQuestionId !== null) {
        const qp = progressById[problem.curriculumQuestionId];
        return qp ? contestStateFromQuestionProgress(qp) : undefined;
      }
      return contestBySlug[slug];
    },
    [progressById, contestBySlug],
  );

  const weakPatterns = useMemo(() => weakness.map((w) => w.id), [weakness]);

  const filter = useMemo<ContestFilter | undefined>(() => {
    if (mode === 'pattern') return pattern === '' ? undefined : { aicmPatterns: [pattern] };
    // Weak-areas scopes the POOL to the patterns the one weakness model names. Only confident
    // mappings satisfy an `aicmPatterns` filter (inferred ones are excluded by default), so a
    // problem can never land here on the strength of a guess.
    if (mode === 'weak') return weakPatterns.length === 0 ? undefined : { aicmPatterns: weakPatterns };
    return undefined;
  }, [mode, pattern, weakPatterns]);

  // Pattern mode scopes to exactly one, so a row can be explained by it. Weak areas scopes to
  // several, so there is no single pattern a row is "here for" — it stays unscoped rather than
  // picking one of the weak patterns and implying that was the reason.
  const scopedPattern = mode === 'pattern' && pattern !== '' ? pattern : undefined;

  const ranked = useMemo(
    () =>
      scoreRevisionCandidates({
        pool: CONTEST_PROBLEMS,
        progress: lookup,
        today,
        filter,
        weakPatterns,
      }),
    [lookup, today, filter, weakPatterns],
  );

  const rankedBySlug = useMemo(
    () => new Map(ranked.map((scored) => [scored.problem.slug, scored])),
    [ranked],
  );

  /** What is due right now, in ranked order — the live answer, before the sitting freezes it. */
  const liveDueSlugs = useMemo(
    () =>
      ranked
        .filter((scored) => {
          const state = lookup(scored.problem.slug);
          return state?.nextRevision != null && state.nextRevision <= today;
        })
        .map((scored) => scored.problem.slug),
    [ranked, lookup, today],
  );

  /**
   * THE DUE LIST IS FROZEN FOR THE SITTING, and this is the same commitment `sessionSlice.frozen`
   * makes for Standard revision — arrived at the same way, by watching it fail.
   *
   * Grading a review moves its ladder date days out, so the moment a row is graded it stops being
   * due and the live list drops it. The learner sees the row they just answered disappear, the
   * count above shrink, and the rows below jump up — work vanishing as it is completed, which is
   * precisely the behaviour CLAUDE.md records as the reason the standard session snapshots its
   * plan. Freezing membership AND order keeps the graded row on screen, stating its outcome.
   *
   * The freeze is keyed by date and pool, so changing mode or pattern composes a new sitting while
   * grading inside one never reshuffles it. Setting state during render is React's own documented
   * way to adjust state when an input changes; the render it happens on falls back to the live
   * list, and the immediate re-render uses the frozen one.
   */
  const frozenKey = `${today}|${mode}|${pattern}`;
  const [frozenDue, setFrozenDue] = useState<{ key: string; slugs: string[] }>({
    key: '',
    slugs: [],
  });
  if (frozenDue.key !== frozenKey) setFrozenDue({ key: frozenKey, slugs: liveDueSlugs });
  const dueSlugs = frozenDue.key === frozenKey ? frozenDue.slugs : liveDueSlugs;

  const due = useMemo(
    () =>
      dueSlugs
        .map((slug) => rankedBySlug.get(slug))
        .filter((scored): scored is ScoredProblem => scored !== undefined),
    [dueSlugs, rankedBySlug],
  );

  // Everything held by the due list is excluded here, so a problem is only ever offered once and
  // "nothing is due on these" stays true of every row under that heading.
  const practice = useMemo(() => {
    const held = new Set(dueSlugs);
    const out: ScoredProblem[] = [];
    for (const scored of ranked) {
      if (held.has(scored.problem.slug)) continue;
      out.push(scored);
      if (out.length === PRACTICE_SHOWN) break;
    }
    return out;
  }, [ranked, dueSlugs]);

  /**
   * What the learner's own contest practice says about the band worth working in.
   *
   * The evidence is the SLUG register only — contest problems solved as contest practice. Bridged
   * curriculum solves are deliberately excluded: those are done with the roadmap's guidance, its
   * hints and no clock, so counting them here would read a band off work that was not performed
   * under anything like contest conditions. `recommendBand` then stays quiet below its own stated
   * minimum and never advances more than one band.
   */
  const band = useMemo(() => {
    const solved: { rating: number; on: string }[] = [];
    const missed: number[] = [];
    for (const [slug, p] of Object.entries(contestBySlug)) {
      const problem = contestProblemBySlug.get(slug);
      if (!problem) continue; // a retired slug is inert, never an error
      if (p.solved) solved.push({ rating: problem.contestRating, on: p.solvedOn ?? '' });
      else if (p.attempts > 0) missed.push(problem.contestRating);
    }
    solved.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0)); // most recent first
    const evidence = { solvedRatings: solved.map((s) => s.rating), missedRatings: missed };
    return { reading: recommendBand(evidence), sampleSize: solved.length + missed.length };
  }, [contestBySlug]);

  function grade(scored: ScoredProblem, passed: boolean) {
    const { problem } = scored;
    // One problem, one record. A bridged problem's ladder lives in `progress.byId`, so its grade
    // goes through the curriculum's own thunk — never through the slug register, which holds
    // nothing for it.
    if (problem.curriculumQuestionId !== null) {
      dispatch(reviseQuestion(problem.curriculumQuestionId, passed));
      return;
    }
    dispatch(reviseLibraryProblem(problem.slug, problem.officialDifficulty, passed));
  }

  const visibleDue = due.slice(0, dueShown);
  const hiddenDue = due.length - visibleDue.length;

  return (
    <PageColumns
      railLabel="Contest context"
      rail={
        <>
          {/* Said here for the same reason the standard rail says it: with the setting off the
              ladder schedules nothing, so an absence of due reviews is a choice the learner made
              rather than a claim that their recall is safe. The two rails must never disagree. */}
          {!revisionEnabled && (
            <p className="text-sm text-muted-foreground">
              Spaced revision is switched off in Settings, so the ladder is not scheduling reviews.
              Anything here is practice, not recall that came due.
            </p>
          )}

          <Section
            title="Your band"
            support="Read from contest practice only — not from curriculum solves."
          >
            {band.reading ? (
              <>
                {/* A statement about the PROBLEMS, never about the learner (§31). The sample size
                    travels with it, in the `timeEstimate.ts` discipline: a personal figure appears
                    only past a stated threshold, and it says what the threshold was. */}
                <p className="max-w-prose text-sm">{band.reading.statement}</p>
                <p className="figures text-xs text-muted-foreground">
                  From {band.reading.sampleSize} rated{' '}
                  {band.reading.sampleSize === 1 ? 'outcome' : 'outcomes'}
                </p>
              </>
            ) : (
              <p className="max-w-prose text-sm text-muted-foreground">
                {band.sampleSize === 0
                  ? 'No contest practice recorded yet, so there is no band to read.'
                  : `${band.sampleSize} of ${MIN_BAND_EVIDENCE} rated outcomes so far — not enough to suggest a band.`}
              </p>
            )}
          </Section>

          <Section
            title="The pool"
            // Counted from the dataset, never written into the sentence: the library is
            // regenerated from its snapshots, and a hand-typed total is a claim that goes stale
            // the first time it grows.
            support={`${NUM.format(CONTEST_PROBLEMS.length)} rated contest problems. Nothing here enters the roadmap or the daily plan.`}
          >
            <Link
              to="/contest-practice"
              className="text-sm font-medium text-primary hover:underline"
            >
              Browse the Contest Library →
            </Link>
          </Section>
        </>
      }
    >
      {mode === 'pattern' && (
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Pattern
          </span>
          <Select value={pattern} onValueChange={(v) => setPattern(v as PatternId)}>
            <SelectTrigger aria-label="Revise a pattern" className="w-full sm:w-64">
              <SelectValue placeholder="Choose a pattern" />
            </SelectTrigger>
            <SelectContent>
              {PATTERNS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === 'weak' && weakPatterns.length === 0 && (
        // Fails toward silence. Weakness is claimed in exactly one place, and where that one place
        // has no evidence the honest surface says so rather than picking something to show.
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing yet says a pattern is not holding — weak areas needs recognition drills or graded
          reviews behind it first. Until then this is the whole library, ranked.
        </p>
      )}

      {mode === 'pattern' && pattern === '' ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Choose a pattern and the library will rank its problems by what is worth doing now.
        </p>
      ) : (
        <>
          <Section
            title="Due now"
            support={
              due.length === 0
                ? 'Nothing on the contest ladder has come due. A late review costs nothing here either.'
                : 'The ladder date has arrived. Re-implement it, then say how it went.'
            }
            action={
              due.length > 0 ? (
                <p className="figures text-sm text-muted-foreground">
                  {due.length} {due.length === 1 ? 'problem' : 'problems'}
                </p>
              ) : undefined
            }
          >
            {due.length > 0 && (
              <RuledList aria-label="Contest problems due for revision">
                {visibleDue.map((scored) => {
                  const state = lookup(scored.problem.slug);
                  const gradedToday = gradedTodayFor(scored, progressById, contestBySlug, today);
                  return (
                    <CandidateRow
                      key={scored.problem.slug}
                      scored={scored}
                      state={state}
                      today={today}
                      scopedPattern={scopedPattern}
                      action={
                        gradedToday ? (
                          // The ladder takes one grade per calendar day, so there is no control to
                          // offer — the same treatment the standard session gives a row already
                          // reviewed today. Offering buttons that record nothing is the app
                          // telling the learner work happened that did not.
                          <p className="text-right text-sm text-muted-foreground">
                            Reviewed today
                            {gradedToday.nextRevision !== null
                              ? ` · next review ${shortDate(gradedToday.nextRevision)}`
                              : ' · no further reviews'}
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => grade(scored, true)}>
                              Recalled it
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => grade(scored, false)}>
                              Not yet
                            </Button>
                          </div>
                        )
                      }
                    />
                  );
                })}
                {hiddenDue > 0 && (
                  <RuledItem padded={false}>
                    <button
                      type="button"
                      onClick={() => setDueShown((s) => s + DUE_STEP)}
                      className="flex min-h-11 w-full items-center gap-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground lg:min-h-9"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>Show {Math.min(DUE_STEP, hiddenDue)} more</span>
                      <span className="figures ml-auto text-xs">{hiddenDue} remaining</span>
                    </button>
                  </RuledItem>
                )}
              </RuledList>
            )}
          </Section>

          <Section
            title="Worth practising"
            support="Nothing is due on these. They are what the evidence ranks highest right now."
          >
            {practice.length === 0 ? (
              <p className="max-w-prose text-sm text-muted-foreground">
                No unsolved problems match — try another pattern, or widen the pool in the Contest
                Library.
              </p>
            ) : (
              <RuledList aria-label="Contest problems worth practising">
                {practice.map((scored) => (
                  <CandidateRow
                    key={scored.problem.slug}
                    scored={scored}
                    state={lookup(scored.problem.slug)}
                    today={today}
                    scopedPattern={scopedPattern}
                  />
                ))}
              </RuledList>
            )}

            <Disclosure summary="Why these, and not a timer">
              <p className="max-w-prose text-sm text-muted-foreground">
                This list ranks retention above acquisition: a problem whose ladder date has arrived
                is knowledge being lost, an unsolved one is knowledge not yet gained. To practise
                these against a clock — and record the solves — start a timed set from the Contest
                Library instead.
              </p>
              <Link
                to={
                  mode === 'pattern' && pattern !== ''
                    ? `/contest-practice?pattern=${pattern}`
                    : '/contest-practice'
                }
                className="self-start text-sm font-medium text-primary hover:underline"
              >
                Start a timed set →
              </Link>
            </Disclosure>
          </Section>
        </>
      )}
    </PageColumns>
  );
}

/**
 * Has this problem already taken its one grade today?
 *
 * Read from whichever register actually owns the record — the bridged case is the curriculum's,
 * and asking the slug register about it would always answer "no" and offer buttons that both
 * thunks would then refuse.
 */
function gradedTodayFor(
  scored: ScoredProblem,
  progressById: Record<number, { lastReviewed: string | null; nextRevision: string | null }>,
  contestBySlug: Record<string, { lastReviewed: string | null; nextRevision: string | null; revisionStage: number }>,
  today: string,
): { nextRevision: string | null } | null {
  const id = scored.problem.curriculumQuestionId;
  if (id !== null) {
    const qp = progressById[id];
    return qp && qp.lastReviewed === today ? { nextRevision: qp.nextRevision } : null;
  }
  const p = contestBySlug[scored.problem.slug];
  if (!p) return null;
  if (p.lastReviewed === today) return { nextRevision: p.nextRevision };
  // Mastered problems leave the ladder entirely; `reviseLibraryProblem` refuses them, so the row
  // must not offer a grade it would silently drop.
  if (p.revisionStage >= MASTERED_STAGE) return { nextRevision: null };
  return null;
}
