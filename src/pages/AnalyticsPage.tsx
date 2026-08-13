import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsightLead, InsightList } from '@/components/shared/InsightPanel';
import { Ledger, Meta, Page, PageHeader, RuledItem, RuledList, Section } from '@/components/layout/Page';
import { SolvedPerDayChart } from '@/components/charts/SolvedPerDayChart';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { patternById } from '@/data/patterns';
import { useToday } from '@/hooks/useToday';
import { useAppSelector } from '@/store/hooks';
import {
  selectAccuracyTrend,
  selectCalibration,
  selectCourseActiveDates,
  selectCourseProjectedFinish,
  selectCourseRetention,
  selectCourseStats,
  selectDifficultyStats,
  selectForecast,
  selectInsights,
  selectPaceAgainstEstimate,
  selectPaceTrend,
  selectPatternWeakness,
  selectPaceSamples,
  selectRecallRecord,
  selectRecognitionRecord,
  selectSolveCoverage,
  selectStreaks,
  selectTransferRecord,
} from '@/store/selectors';
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
 * - **Findings before figures.** The one reading worth acting on is the page's `Lead`. A learner
 *   opening analytics has a decision to make, and a wall of charts hands the interpreting work
 *   straight back to them.
 */
export default function AnalyticsPage() {
  const today = useToday();
  const [range, setRange] = useState<SolvedRange>(30);

  const insights = useAppSelector((s) => selectInsights(s, today));
  const streaks = useAppSelector((s) => selectStreaks(s, today));
  const weakness = useAppSelector((s) => selectPatternWeakness(s, today));
  const forecast = useAppSelector((s) => selectForecast(s, today));
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const courseActiveDates = useAppSelector(selectCourseActiveDates);
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
    () => Math.round(consistency(dayLogs, today, ACTIVE_WINDOW_DAYS, courseActiveDates) * ACTIVE_WINDOW_DAYS),
    [dayLogs, today, courseActiveDates],
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

  const secondaryInsights = insights.slice(1);

  return (
    <Page>
      <PageHeader
        eyebrow="The record"
        title="Analytics"
        support="Five questions, in the order that decides what you do next. Where the record cannot answer one yet, this page says so and names what it would take — nothing here is padded to fill a section."
      />

      {/* §30: one reading, its evidence, and a button that performs the recommendation. */}
      <InsightLead insight={insights[0] ?? null} />

      {/* ---------------------------------------------------------------- 1. Showing up ----- */}
      <Section
        title="Am I showing up?"
        support="Cadence is the input that compounds. Both tracks count — a day spent only on the ML course is an active day."
      >
        {/* Three figures, because the section makes three claims: how often, how unbroken, and
            what the time bought. The solve count that used to sit here was the same series the
            chart directly below plots day by day — it now qualifies the figure it is actually the
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

        <Section level={3} title="Solved per day" action={
          <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as SolvedRange)}>
            <TabsList>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }>
          {/* The chart already has a visual boundary; wrapping it in a plate would add a second. */}
          <SolvedPerDayChart data={solvedPerDay} />
        </Section>
      </Section>

      {/* ------------------------------------------------------------------- 2. Faster ------ */}
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
      <Section
        title="What should I do next?"
        support="One weakness model, built from every signal the record holds: drill misses, failed recalls, your own ratings, unfinished attempts, time against estimate, hint use, and whether an idea carried into its next disguise. Recent evidence outweighs old, and nothing is scored on a single observation."
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

        {secondaryInsights.length > 0 && (
          <Section level={3} title="Other findings">
            <InsightList insights={secondaryInsights} />
          </Section>
        )}

        <Section
          level={3}
          title="Review load ahead"
          support="Reviewing early costs nothing on the ladder; arriving at a day you cannot finish does."
        >
          <ForecastChart data={forecast} />
        </Section>
      </Section>

      {/* ----------------------------------------------------------------- 6. ML track ------ */}
      <Section
        divider
        title="The ML track"
        support="Measured the same way as the roadmap: sessions completed is attendance, the review ladder is retention."
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/aiml">Open the course</Link>
          </Button>
        }
      >
        {/* The other track is a secondary reading on a page about the roadmap, and four
            serif figures gave it the same weight as the questions above. One line of related
            facts says the same things and reads as one object — the form the dashboard already
            uses for this course. */}
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
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {courseRetention.onLadder === 0
            ? 'No week has been cleared yet, so there is nothing on the review ladder to measure. Attendance is the only number here until then.'
            : courseRetention.neverReviewed > 0
              ? `${courseRetention.neverReviewed} cleared ${plural(courseRetention.neverReviewed, 'week has', 'weeks have')} never been reviewed. Sessions completed is attendance; only the ladder says the material is still there.`
              : 'Every cleared week has been through the ladder at least once, so the attendance figure above is backed by recall rather than standing on its own.'}
        </p>
      </Section>
    </Page>
  );
}
