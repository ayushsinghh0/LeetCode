import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, ExternalLink, Flag, Pause, Play, Swords, XCircle } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Eyebrow,
  Lead,
  Meta,
  Page,
  PageHeader,
  Rule,
  RuledItem,
  RuledList,
  Section,
} from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectContestAnalysis,
  selectContestProblems,
  selectContestTimeReading,
} from '@/store/selectors';
import {
  blurContestProblem,
  clearContest,
  finishContest,
  focusContestProblem,
  logContestWrongSubmit,
  setAsideContestProblem,
  solveContestProblem,
  startContest,
} from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { useToday } from '@/hooks/useToday';
import { contestElapsedMin, type ContestAttemptState } from '@/store/slices/contestSlice';
import type { Outcome } from '@/utils/engine/contest';
import { cn } from '@/utils/cn';
import type { Question } from '@/types';

const questions = questionsData as Question[];

// Minute-resolution clock; a 15s tick keeps the displayed minute honest without meaningful work.
const TICK_MS = 15_000;

/**
 * The row controls are the only ones in the product operated with a clock running, on a phone,
 * against a problem the learner is trying to think about. `size="sm"` is 36px, which is the
 * app-wide browsing default and the wrong trade here — so these get the 44px minimum the chip
 * idiom already uses (DESIGN.md § Capacity chips). Height only: the widths still wrap.
 */
const CLOCK_CONTROL = 'min-h-[44px]';

const OUTCOME_LABEL: Record<Outcome, string> = {
  clean: 'Clean solve',
  slow: 'Solved slowly',
  stalled: 'Stalled',
  'set-aside': 'Set aside',
  untouched: 'Barely touched',
};

// The easy/hard inks already carry right/wrong in the drill (see DrillsPage's option borders);
// the same idiom applies here. Untouched deliberately gets the muted voice — it is a non-claim.
// Set-aside gets the medium ink rather than the hard one: it names a decision, and the decision
// was a reasonable one however the minutes behind it read.
const OUTCOME_CLASS: Record<Outcome, string> = {
  clean: 'text-easy',
  slow: 'text-medium',
  stalled: 'text-hard',
  'set-aside': 'text-medium',
  untouched: 'text-muted-foreground',
};

/**
 * Contest mode: a timed set under pressure, then an honest reading of what happened.
 *
 * Composition: each lifecycle state (start / running / verdict) is the page's one thing, so each
 * lives in the single `Lead` — and the `Lead` holds only that one thing. While the clock runs it
 * is the clock band and nothing else: the four-problem list with its per-row controls is the
 * working surface, not the lead, and putting ~400px of it inside a plate turned the plate into a
 * border around the page. The list is an open `Section` beneath, exactly as Revision does it.
 * Problem rows are hairline-ruled, never boxed.
 *
 * The sitting is frozen the moment it starts (the slice snapshots the set — see contestSlice),
 * and problems deliberately do NOT open the in-app question sheet while the clock runs: the
 * sheet carries hints and notes, and a contest is the one surface in the product that is meant
 * to be cold. The external link is the honest way out.
 */
export default function ContestPage() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const contest = useAppSelector((s) => s.contest);
  const problems = useAppSelector(selectContestProblems);
  const analysis = useAppSelector(selectContestAnalysis);
  const timeSpread = useAppSelector(selectContestTimeReading);
  const byId = useAppSelector((s) => s.progress.byId);

  const running = contest.seed !== null && contest.finishedAtMs === null;
  const finished = analysis !== null;
  // Everything after the one named next step. `patternGaps[0]` is `next`, and it already has the
  // page's one recommendation attached to it.
  const otherGaps = analysis ? analysis.patternGaps.slice(1) : [];

  // Mirrors buildContest's eligibility filter — mastered-out-of-existence catalogs are rare, but
  // a Start button that silently does nothing would be worse than the empty state.
  const hasEligible = useMemo(
    () =>
      questions.some((q) => {
        const status = byId[q.id]?.status ?? 'unsolved';
        return status === 'unsolved' || status === 'in_progress';
      }),
    [byId],
  );

  // The page's own clock read, ticked while running. Selectors stay clock-free (see selectors.ts
  // header); the single live consumer of "now" is this display state.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // Unmount settles whatever is on the clock: a page that is gone cannot be paused, and minutes
  // credited to a problem nobody has open would be exactly the invented claim contest.ts's header
  // refuses to make.
  //
  // Hiding the tab deliberately does NOT settle. It used to, on `visibilitychange → hidden`, and
  // that sounded protective while being fatal: the only sanctioned work surface here is the
  // external LeetCode link, so *attempting* a problem always hid this tab. Every unsolved problem
  // therefore settled at ~0 minutes, classified `untouched`, every sitting came out
  // `inconclusive`, and the whole contest→weakness evidence path could never carry anything. The
  // contract is now the explicit control instead: arming a problem is a deliberate commitment,
  // and Pause is the learner's own honest exit. The copy beside the clock says so.
  useEffect(() => {
    if (!running) return;
    return () => {
      dispatch(blurContestProblem()); // unmount: navigating away, or the contest ending
    };
  }, [running, dispatch]);

  const elapsed = contestElapsedMin(contest, nowMs);
  const overTime = running && elapsed > contest.durationMin;

  function liveMinutes(questionId: number, attempt: ContestAttemptState): number {
    const active = contest.activeQuestionId === questionId && contest.activeSinceMs !== null;
    return (
      attempt.minutesSpent +
      (active ? Math.max(0, Math.round((nowMs - contest.activeSinceMs!) / 60_000)) : 0)
    );
  }

  return (
    // `reading`, like Drills and Interview: the three rehearsal surfaces are prose-and-list
    // pages, and they had no business each choosing a different measure.
    <Page width="reading">
      <PageHeader
        eyebrow={format(parseISO(today), 'EEEE, MMMM d')}
        title="Contest"
        support="Practice measures whether you can solve it. A contest measures whether you can solve it now, cold, with a clock running — which is the thing an interview actually tests."
        action={
          running ? (
            <Button onClick={() => dispatch(finishContest())}>
              <Flag /> Finish
            </Button>
          ) : undefined
        }
      />

      {!running && !finished && !hasEligible ? (
        <EmptyState
          icon={Swords}
          title="Nothing left to contest"
          hint="Contests draw from problems you haven't solved or skipped, and there are none left."
        />
      ) : !running && !finished ? (
        <Section aria-label="Start a contest">
          <Lead className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Eyebrow>Today's set</Eyebrow>
              <h2 className="text-xl font-semibold md:text-2xl">Four problems, one clock.</h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                An easy opener, two mediums, and a hard closer — drawn from problems you haven't
                solved, patterns kept distinct so the set measures more than one technique. The
                schedule is the sum of the problems' own estimates with a little slack: tight, not
                impossible.
              </p>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Time counts only while a problem is on the clock, and you can move the clock
                freely; once a problem is on it, it keeps counting until you pause it, tab away or
                not. At the end there is no score and no rank — just an honest reading of each
                problem, and the one pattern worth acting on when the set supports a claim at all.
              </p>
              {/* What the seed actually guarantees. The old line promised "reloading rebuilds the
                  same set", which two mechanisms contradict: `buildContest` draws only from
                  problems you have not solved, so solving one changes the pool the next draw
                  reads, and the contest slice is deliberately not persisted, so a reload ends the
                  sitting rather than restoring it. */}
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Seeded by today's date and drawn only from problems you haven't solved: start
                another one later today and you get this same set — until you solve one of them,
                which takes it out of the pool and changes the draw. Reloading mid-contest ends the
                sitting rather than restoring it; a stopped clock is not a paused one.
              </p>
            </div>
            <div>
              <Button onClick={() => dispatch(startContest())}>
                <Play /> Start the contest
              </Button>
            </div>
          </Lead>
        </Section>
      ) : running ? (
        <>
          <Section aria-label="Contest in progress">
            {/* The lead is the clock and the count — the one thing the page is about while a
                contest runs. The set itself lives in its own section below. */}
            <Lead className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-3">
                <p className="figures font-serif text-[1.75rem] font-semibold leading-none tracking-tight">
                  {elapsed} min
                </p>
                <p className="text-sm text-muted-foreground">
                  of ~{contest.durationMin} scheduled{overTime && ' — over time'}
                </p>
              </div>
              <Eyebrow>
                {problems.filter((p) => contest.attempts[p.question.id]?.solved).length} of{' '}
                {problems.length} solved
              </Eyebrow>
            </Lead>
          </Section>

          <Section
            title="The set"
            support="Time counts only while a problem is on the clock. Once a problem is on it, the clock runs until you pause it — including while you work in another tab, which is where the solving actually happens. Pause it when you step away."
          >
            <RuledList aria-label="Contest problems" as="ol">
              {problems.map(({ question, order, targetMinutes }) => {
                const attempt = contest.attempts[question.id];
                if (!attempt) return null;
                const active = contest.activeQuestionId === question.id;
                const spent = liveMinutes(question.id, attempt);
                return (
                  <RuledItem key={question.id} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="font-medium leading-snug">
                          <span className="figures text-muted-foreground">{order}.</span>{' '}
                          {question.title}
                        </p>
                        <Meta
                          items={[
                            <DifficultyBadge difficulty={question.difficulty} />,
                            <span className="figures">~{targetMinutes} min target</span>,
                            question.url && (
                              <a
                                href={question.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 underline-offset-2 transition-colors duration-150 ease-swift hover:text-foreground hover:underline"
                              >
                                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Open on LeetCode
                              </a>
                            ),
                          ]}
                        />
                      </div>
                      {/* `shrink-0` used to sit here. It was survivable with three controls (352px,
                          inside a 375px viewport) and overflowed the moment an armed row grew to
                          four: a flex item that cannot shrink lays out at its natural width and
                          takes the page with it. Wrapping is the correct behaviour on a phone. */}
                      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
                        {attempt.solved ? (
                          <p className="flex items-center gap-1.5 text-sm text-easy">
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Solved
                            <span className="figures text-muted-foreground">· {spent} min</span>
                          </p>
                        ) : (
                          <>
                            <p
                              className={cn(
                                'figures text-sm',
                                active ? 'text-foreground' : 'text-muted-foreground',
                              )}
                            >
                              {attempt.setAside
                                ? `set aside · ${spent} min`
                                : active
                                  ? `on the clock · ${spent} min`
                                  : `${spent} min`}
                              {attempt.wrongSubmits > 0 &&
                                ` · ${attempt.wrongSubmits} didn't pass`}
                            </p>
                            {active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className={CLOCK_CONTROL}
                                onClick={() => dispatch(blurContestProblem())}
                              >
                                <Pause /> Pause
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className={CLOCK_CONTROL}
                                onClick={() => dispatch(focusContestProblem(question.id))}
                              >
                                <Play /> {attempt.setAside ? 'Pick it back up' : 'Put on the clock'}
                              </Button>
                            )}
                            {/* Reporting a failed submission is only meaningful for the problem
                                actually being worked, and keeping it off the other rows keeps
                                four controls from landing on a phone-width row. */}
                            {active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={CLOCK_CONTROL}
                                onClick={() => dispatch(logContestWrongSubmit(question.id))}
                              >
                                <XCircle /> Didn't pass
                              </Button>
                            )}
                            {!attempt.setAside && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={CLOCK_CONTROL}
                                onClick={() => dispatch(setAsideContestProblem(question.id))}
                              >
                                Set aside
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className={CLOCK_CONTROL}
                              onClick={() => dispatch(solveContestProblem(question.id))}
                            >
                              Mark solved
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </RuledItem>
                );
              })}
            </RuledList>
          </Section>
        </>
      ) : finished && analysis ? (
        <>
          <Section aria-label="Contest verdict">
            <Lead className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Eyebrow>The verdict</Eyebrow>
                <p className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight">
                  {analysis.solved} of {analysis.total} solved
                </p>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  <span className="figures">{analysis.minutesSpent} min</span> on the clock against
                  a <span className="figures">~{contest.durationMin} min</span> schedule.
                </p>
                {/* Where the minutes went — the one thing a contest can observe that self-paced
                    practice cannot. It reports the distribution and stops there; whether the
                    allocation was right needs a counterfactual nobody has. */}
                {timeSpread && (
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {timeSpread}
                  </p>
                )}
              </div>

              {analysis.inconclusive ? (
                <>
                  <Rule />
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Too little of this set was genuinely attempted to read anything into it — that
                    is a fact about the sitting, not about your ability. It counts for nothing and
                    it costs nothing.
                  </p>
                </>
              ) : analysis.next ? (
                <>
                  <Rule />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">
                      Worth acting on:{' '}
                      {patternById[analysis.next.pattern]?.name ?? analysis.next.pattern}
                    </p>
                    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {analysis.next.why}
                    </p>
                    {/* The other patterns that stalled, stated once and quietly. They are real
                        evidence and the learner should see them, but only one thing can be the
                        next thing — a second heading here would make four findings compete. */}
                    {otherGaps.length > 0 && (
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                        It also stalled on{' '}
                        {otherGaps.map((p) => patternById[p]?.name ?? p).join(', ')}.
                      </p>
                    )}
                  </div>
                </>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {analysis.next && (
                  <Button asChild>
                    <Link to={`/patterns/${analysis.next.pattern}`}>Open the pattern</Link>
                  </Button>
                )}
                <Button variant={analysis.next ? 'outline' : 'default'} onClick={() => dispatch(clearContest())}>
                  Done
                </Button>
              </div>
            </Lead>
          </Section>

          <Section
            title="How each problem read"
            support="Each reading states only what the evidence supports — a problem you barely touched produces no claim about you."
            aria-label="Problem readings"
          >
            <RuledList aria-label="Readings" as="ol">
              {analysis.readings.map((reading) => (
                <RuledItem key={reading.question.id} className="flex flex-col gap-1.5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <p className="font-medium leading-snug">{reading.question.title}</p>
                    <p className={cn('text-sm font-medium', OUTCOME_CLASS[reading.outcome])}>
                      {OUTCOME_LABEL[reading.outcome]}
                    </p>
                  </div>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {reading.reading}
                  </p>
                  {/* The clock is off now, so the problem that beat it can be opened with
                      everything the sheet carries — hints, the family, the notes field. The
                      contest withheld all of that on purpose; the point of finishing is that it
                      stops being withheld. */}
                  {analysis.stalledQuestionIds.includes(reading.question.id) && (
                    <div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => dispatch(activeQuestionSet(reading.question.id))}
                      >
                        Take a calm second look
                      </Button>
                    </div>
                  )}
                </RuledItem>
              ))}
            </RuledList>
          </Section>
        </>
      ) : null}
    </Page>
  );
}
