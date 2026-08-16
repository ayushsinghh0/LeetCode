import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsightLead, InsightList } from '@/components/shared/InsightPanel';
import {
  Disclosure,
  Ledger,
  Meta,
  Panel,
  RuledItem,
  RuledList,
  Screen,
  ScreenHeader,
  Section,
} from '@/components/layout/Page';
import { SolvedPerDayChart } from '@/components/charts/SolvedPerDayChart';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { patternById } from '@/data/patterns';
import { useToday } from '@/hooks/useToday';
import { useAppSelector } from '@/store/hooks';
import {
  selectOtherTrackActiveDates,
  selectCourseProjectedFinish,
  selectCourseStats,
  selectDifficultyStats,
  selectForecast,
  selectPatternWeakness,
  selectPaceSamples,
  selectRecallRecord,
  selectStreaks,
} from '@/store/selectors';
import {
  selectAccuracyTrend,
  selectCalibration,
  selectCourseRetention,
  selectInsights,
  selectPaceAgainstEstimate,
  selectPaceTrend,
  selectRecognitionRecord,
  selectSolveCoverage,
  selectTransferRecord,
} from '@/store/analyticsSelectors';
import {
  HIGH_CONFIDENCE,
  LOW_CONFIDENCE,
  MIN_CALIBRATION_SAMPLES,
  MIN_DRILLS,
  MIN_PACE_TREND_SAMPLES,
  MIN_TREND_ATTEMPTS,
  studyTime,
} from '@/utils/engine/insights';
import { MIN_TRANSFER_OBSERVATIONS } from '@/utils/engine/weakness';
import { MIN_SAMPLES } from '@/utils/engine/timeEstimate';
import {
  consistency,
  isPassRateReportable,
  MIN_PASS_RATE_ATTEMPTS,
  solvedPerDaySeries,
} from '@/utils/engine/stats';
import { formatMinutes, formatProjection } from '@/utils/engine/planner';

const ACTIVE_WINDOW_DAYS = 14;
type SolvedRange = 30 | 90;

const DASH = '—';
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Analytics — five questions, in the order that decides what to do next.
 *
 * Am I showing up · am I getting faster · am I getting more accurate · can I solve unfamiliar
 * problems · what should I do next. Every figure on the page belongs to one of those questions and
 * has to change a decision to be here at all; the ones that did not are gone, along with the six
 * chart plates that used to wrap them.
 *
 * Two rules run through it, both inherited from the engine rather than invented here:
 *
 * - **Suppress, never pad.** Every measurement states its floor and returns null under it, and
 *   this page prints what it would take instead of a confident zero. "Not measurable yet, you have
 *   6 of the 8 rated solves it needs" is a more useful thing to read than a percentage that would
 *   move twenty points on the next recall.
 * - **Findings before figures.** The one reading worth acting on is the page's `Lead`, and the
 *   rest of the findings follow it directly — they used to sit ~2,600px down, filed inside the
 *   last question, so the rule was true of the copy and inverted by the layout. The two
 *   surviving charts are the raw series behind the readings, so each waits behind a closed
 *   disclosure under the heading that interprets it.
 *
 * The ML track is context on a page about the roadmap, not a sixth question, so it rides the
 * `PageColumns` rail beside the questions rather than standing under them.
 */
export default function AnalyticsPage() {
  const today = useToday();
  const [range, setRange] = useState<SolvedRange>(30);

  const insights = useAppSelector((s) => selectInsights(s, today));
  const streaks = useAppSelector((s) => selectStreaks(s, today));
  const weakness = useAppSelector((s) => selectPatternWeakness(s, today));
  const forecast = useAppSelector((s) => selectForecast(s, today));
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const otherTrackActiveDates = useAppSelector(selectOtherTrackActiveDates);
  const courseStats = useAppSelector(selectCourseStats);
  const courseFinish = useAppSelector((s) => selectCourseProjectedFinish(s, today));
  const courseRetention = useAppSelector(selectCourseRetention);
  const difficultyStats = useAppSelector(selectDifficultyStats);
  const recall = useAppSelector(selectRecallRecord);
  const accuracy = useAppSelector(selectAccuracyTrend);
  const calibration = useAppSelector(selectCalibration);
  const coverage = useAppSelector(selectSolveCoverage);
  const recognition = useAppSelector(selectRecognitionRecord);
  const transfer = useAppSelector(selectTransferRecord);
  const paceFigure = useAppSelector(selectPaceAgainstEstimate);
  const paceDirection = useAppSelector(selectPaceTrend);
  const paceSampleCount = useAppSelector(selectPaceSamples).length;

  // Unified activity definition, matching the streak: a course-only day is an active day.
  const activeDays = useMemo(
    () => Math.round(consistency(dayLogs, today, ACTIVE_WINDOW_DAYS, otherTrackActiveDates) * ACTIVE_WINDOW_DAYS),
    [dayLogs, today, otherTrackActiveDates],
  );

  // Focus-timer minutes and what they bought. DayLog.focusMinutes is the canonical time ledger;
  // per-question timeSpentMin is a breakdown of these same minutes and is never added to them.
  const time = useMemo(() => studyTime(dayLogs, today, ACTIVE_WINDOW_DAYS), [dayLogs, today]);
  const solvedPerDay = useMemo(() => solvedPerDaySeries(dayLogs, today, range), [dayLogs, today, range]);

  // Deliberately labelled rather than "corrected": focusMinutes is the canonical total-time
  // ledger and includes minutes spent on the course, while the denominator counts DSA items
  // only. The two dimensions cannot be separated here (that is the time-attribution invariant),
  // so the figure names what it actually divides instead of implying a clean per-question cost.
  const completedItems = time.solves + time.reviews;
  const minutesPerItem = completedItems > 0 && time.minutes > 0
    ? Math.round(time.minutes / completedItems)
    : null;

  // The lead takes insights[0]; the next three follow it openly and the rest wait behind a latch.
  // `buildInsights` can return sixteen, and eight of them at 221px each is 1,768px of findings
  // between the lead and the page's first figure — the directive's "first viewport: 3–5 genuinely
  // useful insights" inverted into "every finding, before anything else". Four is the top of that
  // range because the lead is one of them. Nothing is dropped: `restInsights` renders the tail in
  // the same component, one click away, with its count on the summary.
  const secondaryInsights = insights.slice(1, 4);
  const restInsights = insights.slice(4);

  return (
    <Screen>
      {/* No support line — the tab strip below lists the five questions by name. */}
      <ScreenHeader eyebrow="The record" title="Analytics" />

      {/* The reading left with the ML-track context under it, the five questions wide on the
          right — the aiml recipe, for the same reason: tabbed catalogues need their width, and
          stacking the lead above them pushed every answer below a 590px fold. DOM order is
          unchanged: lead, tabs, context. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* The reading, then the evidence behind it.

            This screen was 3,451px of stacked analysis — five question-titled sections plus an
            uncapped findings list, every one of them full width, so "what should I change?" was
            answered four screens below the question. The five sections are unchanged and
            nothing was removed; they are siblings, exactly one of which you are reading, which
            is what a tab is for. The lead reading stays above the strip because it is the
            answer — the tabs are where you go to check it. */}
        <div className="contents">
          <InsightLead insight={insights[0] ?? null} />

          <Tabs
            defaultValue="next"
            className="flex min-w-0 flex-col gap-3 lg:col-start-1 xl:col-start-2 xl:row-start-1 xl:row-span-2"
          >
            <TabsList>
              <TabsTrigger value="next">What next</TabsTrigger>
              <TabsTrigger value="findings">Findings</TabsTrigger>
              <TabsTrigger value="showing-up">Showing up</TabsTrigger>
              <TabsTrigger value="faster">Faster</TabsTrigger>
              <TabsTrigger value="accurate">Accurate</TabsTrigger>
              <TabsTrigger value="unfamiliar">Unfamiliar</TabsTrigger>
            </TabsList>

            <TabsContent value="next">
              <Panel>
            <Section
              title="What should I do next?"
              support="One weakness model, built from every signal the record holds."
            >
              {weakness.length === 0 ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  Nothing has failed on repeated evidence yet. A pattern appears here once at least one
                  signal has gone wrong twice — one miss is a bad evening, not a weakness.
                </p>
              ) : (
                <RuledList aria-label="Patterns to work on">
                  {weakness.map((pattern) => (
                    <RuledItem key={pattern.id} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: patternById[pattern.id].color }}
                            aria-hidden="true"
                          />
                          <Link
                            to={`/patterns/${pattern.id}`}
                            className="text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
                          >
                            {pattern.name}
                          </Link>
                        </span>
                        <span className="figures text-xs text-muted-foreground">
                          {pattern.signals.length} {plural(pattern.signals.length, 'signal', 'signals')}
                        </span>
                      </div>
                      {/* The model's own explanation. A ranking that cannot say why is a number to obey. */}
                      <p className="max-w-prose text-sm text-muted-foreground">Because {pattern.summary}.</p>
                    </RuledItem>
                  ))}
                </RuledList>
              )}

              {/* The model's inputs, in full. This used to be the section's support line — five lines
                  of masthead, the longest string on the page, met before any finding it produced. As a
                  footnote under the list it is what it always was: the working, for the reader who
                  wants to check it. */}
              {/* The working, one tap away: method prose read once, not 100px of every visit. */}
              <Disclosure summary="The signals, in full">
                <p className="max-w-prose text-sm text-muted-foreground">
                  The signals: drill misses, failed recalls, your own ratings, unfinished attempts, time
                  against estimate, hint use, stalls under a contest clock, and whether an idea carried
                  into its next disguise. Recent evidence outweighs old, and nothing is scored on a
                  single observation.
                </p>
              </Disclosure>

              <Section
                level={3}
                title="Review load ahead"
                support="Reviewing early costs nothing on the ladder; arriving at a day you cannot finish does."
              >
                {/* Same latch as the solved-per-day plot: the support line carries the section's one
                    claim, and the day-by-day forecast is the working behind it. */}
                <Disclosure summary="The forecast, plotted">
                  <ForecastChart data={forecast} />
                </Disclosure>
              </Section>
            </Section>

              </Panel>
            </TabsContent>

            <TabsContent value="findings">
              <Panel>
                {/* The findings that follow the lead. They used to sit open above every figure
                    on the screen; capped at three there and latched beyond that, they are now a
                    destination of their own — same components, same order, nothing dropped. */}
                <InsightList insights={secondaryInsights} />
                {restInsights.length > 0 && (
                  <Disclosure summary="More findings" meta={`${restInsights.length} more`}>
                    <InsightList insights={restInsights} />
                  </Disclosure>
                )}
              </Panel>
            </TabsContent>

            <TabsContent value="showing-up">
              <Panel>
            <Section
              title="Am I showing up?"
              support="Cadence is the input that compounds. Both tracks count — a day spent only on the ML course is an active day."
            >
              {/* Three figures, because the section makes three claims: how often, how unbroken, and
                  what the time bought. The solve count that used to sit here was the same series the
                  chart below plots day by day — it now qualifies the figure it is actually the
                  denominator of. */}
              <Ledger
                columns={3}
                items={[
                  {
                    label: 'Active days',
                    value: `${activeDays} / ${ACTIVE_WINDOW_DAYS}`,
                    sub: 'last 14 days, both tracks',
                  },
                  {
                    label: 'Current streak',
                    value: streaks.current,
                    sub: `longest ${streaks.longest}`,
                  },
                  {
                    label: 'Focus time',
                    value: time.minutes > 0 ? formatMinutes(time.minutes) : DASH,
                    sub:
                      time.minutes === 0
                        ? 'not measured — the timer has not run'
                        : minutesPerItem !== null
                          ? `~${minutesPerItem} min per DSA item — ${time.solves} solved, ${time.reviews} recalled, course time included`
                          : 'no items finished in this window',
                  },
                ]}
              />

              <Section level={3} title="Solved per day">
                {/* The plot is the raw series behind the ledger above, so it waits behind a latch: a
                    reader who wants the day-by-day shape is one click away, and everyone else reaches
                    the next question a third of a viewport sooner.

                    The range tabs are INSIDE the latch. They used to ride the section heading, where —
                    with the plot closed, which is the default — pressing "90 days" changed nothing on
                    screen: an interactive control whose only effect was invisible. The current range
                    now rides the summary instead, so the shut row still says what opening it will
                    show, and the control appears next to the thing it controls. */}
                <Disclosure summary="Solved per day, plotted" meta={`last ${range} days`}>
                  <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as SolvedRange)}>
                    <TabsList>
                      <TabsTrigger value="30">30 days</TabsTrigger>
                      <TabsTrigger value="90">90 days</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <SolvedPerDayChart data={solvedPerDay} />
                </Disclosure>
              </Section>
            </Section>

            {/* ------------------------------------------------------------------- 2. Faster ------ */}
              </Panel>
            </TabsContent>

            <TabsContent value="faster">
              <Panel>
            <Section
              title="Am I getting faster?"
              support="Minutes only mean something next to what they bought. A pace figure needs solves measured through the focus timer, so it stays silent until it has them — an unmeasured solve is not a measurement of zero."
            >
              <Ledger
                columns={2}
                items={[
                  {
                    label: 'Pace against estimate',
                    value: paceFigure
                      ? Math.abs(paceFigure.ratio - 1) < 0.05
                        ? 'On estimate'
                        : `${Math.round(Math.abs(1 - paceFigure.ratio) * 100)}% ${paceFigure.ratio < 1 ? 'faster' : 'slower'}`
                      : DASH,
                    sub: paceFigure
                      ? `median over ${paceFigure.samples} timed solves`
                      : `needs ${MIN_SAMPLES} timed solves — you have ${paceSampleCount}`,
                  },
                  {
                    label: 'Direction',
                    value: paceDirection
                      ? paceDirection.verdict === 'faster'
                        ? 'Speeding up'
                        : paceDirection.verdict === 'slower'
                          ? 'Slowing down'
                          : 'Holding steady'
                      : DASH,
                    sub: paceDirection
                      ? `recent half of ${paceDirection.samples} timed solves against the earlier half`
                      : `needs ${MIN_PACE_TREND_SAMPLES * 2} timed solves — you have ${paceSampleCount}`,
                  },
                ]}
              />
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {paceFigure
                  ? paceFigure.ratio < 1
                    ? 'Your daily plan already budgets at your pace, so finishing early means there is room for a harder variant rather than a longer list.'
                    : 'The plan already budgets at your pace. Lower the capacity rather than rushing — a plan you finish beats a plan that was theoretically right.'
                  : 'Run the focus timer on a question and its minutes are attributed to it. Until then the plan uses the dataset estimate, which is honest but is not about you.'}
              </p>
            </Section>

            {/* ----------------------------------------------------------------- 3. Accuracy ------ */}
              </Panel>
            </TabsContent>

            <TabsContent value="accurate">
              <Panel>
            <Section
              title="Am I getting more accurate?"
              support="A solve is only proved by recalling it after a gap. Question revisions and course-week reviews climb the same ladder, so they are graded together."
            >
              {/* The rate, its direction, and the learner's own prediction of it — which is what the
                  paragraph under this section is about. A mastery count sat here too and belonged to a
                  different question. */}
              <Ledger
                columns={3}
                items={[
                  {
                    // Gated on the one pass-rate threshold (engine/stats.ts), the same one the
                    // difficulty ledger below and the pattern pages read. Ungated, a single failed
                    // recall printed a headline "0%" fifty pixels above a row correctly reporting
                    // "needs 5 reviews — you have 1": one page, two answers to "has this been measured".
                    label: 'Recall pass rate',
                    value:
                      recall.rate === null || !isPassRateReportable(recall.attempts)
                        ? DASH
                        : pct(recall.rate),
                    sub:
                      recall.attempts === 0
                        ? 'no graded recall yet'
                        : isPassRateReportable(recall.attempts)
                          ? `${recall.passed} passed · ${recall.failed} failed`
                          : `needs ${MIN_PASS_RATE_ATTEMPTS} reviews — you have ${recall.attempts}`,
                  },
                  {
                    label: 'Recent vs earlier',
                    value: accuracy ? `${accuracy.deltaPp > 0 ? '+' : ''}${accuracy.deltaPp} pts` : DASH,
                    sub: accuracy
                      ? accuracy.verdict === 'steady'
                        ? `inside the ±${accuracy.noiseFloorPp} pts these samples can resolve`
                        : `${pct(accuracy.recent.passRate)} over the last ${accuracy.recent.attempts}, ${pct(accuracy.prior.passRate)} before`
                      : `needs ${MIN_TREND_ATTEMPTS * 2} graded recalls — you have ${recall.attempts}`,
                  },
                  {
                    label: 'Your own rating',
                    value: !calibration
                      ? DASH
                      : calibration.verdict === 'overconfident'
                        ? 'Optimistic'
                        : calibration.verdict === 'underconfident'
                          ? 'Cautious'
                          : calibration.verdict === 'calibrated'
                            ? 'Well judged'
                            : DASH,
                    sub: !calibration
                      ? 'no rated solve has been recalled yet'
                      : calibration.verdict === 'unmeasured'
                        ? `needs ${MIN_CALIBRATION_SAMPLES} rated solves in one band — you have ${Math.max(calibration.highCount, calibration.lowCount)}`
                        : `over ${calibration.observations} rated solves`,
                  },
                ]}
              />

              <Section
                level={3}
                title="By difficulty"
                support="Where the pass rate falls off is where to slow down, not where to stop."
              >
                <Ledger
                  columns={3}
                  // Same rule as the pattern page: a pass rate is only shown once enough recalls back
                  // it, and it always carries its denominator. One attempt printed as a confident
                  // "0%" is the padding this section exists not to do.
                  items={difficultyStats.map((s) => ({
                    label: s.difficulty[0]!.toUpperCase() + s.difficulty.slice(1),
                    value:
                      s.revisionPassRate === null || !isPassRateReportable(s.revisionAttempts)
                        ? DASH
                        : pct(s.revisionPassRate),
                    sub:
                      s.revisionAttempts === 0
                        ? `${s.solved} of ${s.total} solved, none recalled`
                        : isPassRateReportable(s.revisionAttempts)
                          ? `over ${s.revisionAttempts} reviews`
                          : `needs ${MIN_PASS_RATE_ATTEMPTS} reviews — you have ${s.revisionAttempts}`,
                  }))}
                />
              </Section>

              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {calibration && calibration.verdict === 'overconfident' && calibration.high
                  ? `Solves you rated ${HIGH_CONFIDENCE} or above failed their first recall ${pct(1 - calibration.high.passRate)} of the time. The rating decides what gets reviewed first, so an optimistic one quietly removes work you needed.`
                  : calibration && calibration.verdict === 'underconfident' && calibration.low
                    ? `Solves you rated ${LOW_CONFIDENCE} or below still passed ${pct(calibration.low.passRate)} of the time. Rating everything low front-loads reviews you do not need.`
                    : calibration && calibration.verdict === 'calibrated'
                      ? 'Your confidence rating is predicting the recall, which makes it worth trusting when the plan uses it to order your reviews.'
                      : `Calibration compares the confidence you record at a solve against its first graded recall. It needs ${MIN_CALIBRATION_SAMPLES} rated solves in one confidence band before it can say anything that would not flip on a single review.`}
              </p>
            </Section>

            {/* ---------------------------------------------------------------- 4. Unfamiliar ----- */}
              </Panel>
            </TabsContent>

            <TabsContent value="unfamiliar">
              <Panel>
            <Section
              title="Can I solve unfamiliar problems?"
              support="Solving a question you have just read about is a different skill. These measure the cold read: naming the technique on sight, carrying an idea into a new disguise, and getting there unaided."
            >
              {/* Exactly the three cold reads the support line above names, in that order. A fourth
                  figure here counted solved-but-untested questions, which is a coverage fact belonging
                  to the accuracy question — and the insight that acts on it says the number anyway. */}
              <Ledger
                columns={3}
                items={[
                  {
                    label: 'Recognition',
                    value: recognition ? pct(recognition.rate) : DASH,
                    sub: recognition
                      ? `${recognition.total} prompts · ${pct(recognition.chance)} is guessing`
                      : `needs ${MIN_DRILLS} recorded drill days`,
                  },
                  {
                    label: 'Transfer',
                    value: transfer && transfer.rate !== null ? `${transfer.carried} / ${transfer.met}` : DASH,
                    sub:
                      transfer && transfer.rate !== null
                        ? 'carried into a problem from a family you had met'
                        : `needs ${MIN_TRANSFER_OBSERVATIONS} problems from families you have met — you have ${transfer?.met ?? 0}`,
                  },
                  {
                    label: 'Unaided solves',
                    value: coverage.solved === 0 ? DASH : `${coverage.unaided} / ${coverage.solved}`,
                    sub: 'hints are support, not a penalty — this only says where to re-derive',
                  },
                ]}
              />
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {recognition
                  ? `Recognition is the only cold read in the product: a four-option prompt with no code and no hint. ${pct(recognition.rate)} over ${recognition.total} prompts, against ${pct(recognition.chance)} for guessing.`
                  : 'Recognition drills are the only cold read in the product — a four-option prompt with no code and no hint. Three recorded days is the least that can be read as a rate rather than a mood.'}
              </p>
            </Section>

            {/* --------------------------------------------------------------------- 5. Next ------ */}
              </Panel>
            </TabsContent>

          </Tabs>
        </div>

        {/* The other track is context on a screen about the roadmap, not a sixth question, so it
            rides the rail beside the tabs rather than standing under them. */}
        {/* No `aria-label`: the section inside is already titled "The ML track", and labelling the
            landmark with the same words announces it twice. */}
        <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 xl:col-start-1 xl:row-start-2 xl:row-span-1">
        <Section
          title="The ML track"
          support="Measured the same way as the roadmap: sessions completed is attendance, the review ladder is retention."
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/aiml">Open the course</Link>
            </Button>
          }
        >
          {/* The other track is a secondary reading on a page about the roadmap: four serif
              figures once gave it the same weight as the questions, and a sixth full-width
              section still made it a stop on the way to nothing. In the rail it sits beside
              the record instead of after it — and the divider it carried at the foot of the
              stack has no stack to rule off any more. */}
          <Meta
            items={[
              <>
                <span className="figures">
                  {courseStats.sessionsDone} / {courseStats.sessionsTotal}
                </span>{' '}
                sessions attended
              </>,
              <>
                <span className="figures">
                  {courseStats.weeksDone} / {courseStats.weeksTotal}
                </span>{' '}
                weeks cleared
              </>,
              <>
                <span className="figures">{courseRetention.retained}</span> at the top of the ladder
              </>,
              courseRetention.attempts === 0 ? (
                'No week reviewed yet'
              ) : (
                <>
                  <span className="figures">{pct(courseRetention.passRate!)}</span> of{' '}
                  <span className="figures">{courseRetention.attempts}</span> graded{' '}
                  {plural(courseRetention.attempts, 'review', 'reviews')} passed
                </>
              ),
              courseFinish ? (
                <>Finish {formatProjection(courseFinish, today)}</>
              ) : (
                'Every core week cleared'
              ),
            ]}
          />
          {/* The reading behind the figures, one tap away — same treatment as "The signals, in
              full": method prose whose place is on demand, not on every visit's height budget. */}
          <Disclosure summary="What these figures rest on">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {courseRetention.onLadder === 0
                ? 'No week has been cleared yet, so there is nothing on the review ladder to measure. Attendance is the only number here until then.'
                : courseRetention.neverReviewed > 0
                  ? `${courseRetention.neverReviewed} cleared ${plural(courseRetention.neverReviewed, 'week has', 'weeks have')} never been reviewed. Sessions completed is attendance; only the ladder says the material is still there.`
                  : 'Every cleared week has been through the ladder at least once, so the attendance figure above is backed by recall rather than standing on its own.'}
            </p>
          </Disclosure>
        </Section>
        </aside>
      </div>
    </Screen>
  );
}
