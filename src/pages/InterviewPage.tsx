import { useEffect, useMemo, useState } from 'react';
import { ChipRadioRow } from '@/components/shared/ChipRadioRow';
import { format, parseISO } from 'date-fns';
import {
  ArrowRight,
  ExternalLink,
  Lightbulb,
  ListChecks,
  Lock,
  RotateCcw,
  Shuffle,
  Speech,
} from 'lucide-react';
import questionsData from '@/data/questions.json';
import { familyById } from '@/data/curriculum';
import { patternById } from '@/data/patterns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Screen,
  ScreenHeader,
  PagePair,
  Section,
  Disclosure,
  Lead,
  Rule,
  RuledList,
  RuledItem,
  Ledger,
  Meta,
  Eyebrow,
} from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  answerInterviewFollowUp,
  finishInterview,
  rateInterview,
  reflectOnInterview,
  revealHint,
} from '@/store/actions';
import {
  selectInterviewDraws,
  selectPreviousInterviewSitting,
  selectTargetCompany,
} from '@/store/selectors';
import {
  interviewAdvanced,
  interviewCleared,
  interviewHintTaken,
  interviewPaused,
  interviewResumed,
  interviewStarted,
  selectInterviewPhase,
  selectRatedStages,
  stageOutcomeSet,
} from '@/store/slices/interviewSlice';
import { useToday } from '@/hooks/useToday';
import { hintsFor } from '@/utils/engine/hints';
import {
  DRAW_BASIS_NOTE,
  FOLLOW_UP_OUTCOMES,
  FOLLOW_UP_OUTCOME_LABEL,
  REVEALS,
  SELF_ASSESSMENT,
  SELF_ASSESSMENT_SCALE,
  STAGES,
  STAGE_OUTCOMES,
  STAGE_OUTCOME_LABEL,
  followUpsFor,
  formatElapsed,
  isRevealed,
  isSelfAssessmentValue,
  nextStage,
  paceNote,
  paceReading,
  revealById,
  stageById,
  stageIndex,
  type InterviewDraw,
  type RevealId,
  type SelfAssessmentValue,
} from '@/utils/engine/interview';
import type { Question } from '@/types';

const questions = questionsData as Question[];

/** Stable empty reference — a fresh `[]` from a selector re-renders on every store change. */
const NO_DRAWS: InterviewDraw[] = [];
const questionById = new Map(questions.map((q) => [q.id, q]));

const DIFFICULTY_WORD = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

/**
 * Interview mode — one problem, worked the way an interview actually runs.
 *
 * The page is three shapes and no more: choose a problem, work the stages, debrief. What makes it
 * interview mode rather than a checklist is that the support this app normally shows up front —
 * the pattern chip, the hint ladder, the family, the capability sentence, the bounds — is
 * withheld and released stage by stage. The gating rules live in `engine/interview.ts`, not in
 * this file's JSX, so "did anything leak early?" is a question a test can answer.
 *
 * Composition: one `Lead` per shape (the problem on offer, the current stage, the
 * self-assessment); everything else is an open `Section`, and the unlock list is a `RuledList`
 * rather than a stack of plates.
 */
export default function InterviewPage() {
  const dispatch = useAppDispatch();
  const today = useToday();

  const phase = useAppSelector(selectInterviewPhase);
  const interview = useAppSelector((state) => state.interview);
  const ratedStages = useAppSelector(selectRatedStages);
  const progressById = useAppSelector((state) => state.progress.byId);
  const previous = useAppSelector(selectPreviousInterviewSitting);

  const [rerolls, setRerolls] = useState(0);
  const [checkOpen, setCheckOpen] = useState(false);
  // Held here rather than in the slice because it is answered BEFORE a sitting exists. Optional
  // throughout: skipping it must cost nothing, or the page acquires a gate where it had none.
  const [expectation, setExpectation] = useState<SelfAssessmentValue | null>(null);
  const [companyScope, setCompanyScope] = useState(false);
  const targetCompany = useAppSelector(selectTargetCompany);
  // Set when "Need a hint" is pressed with nothing left to give. See takeHint.
  const [hintNote, setHintNote] = useState(false);

  // --- The clock -----------------------------------------------------------------------------
  // The elapsed reading lives in the slice as `elapsedSec` (settled segments) plus `startedAtMs`
  // (the running one), so it survives this lazy route unmounting — navigating to /drills and back
  // used to resume from the last stage transition and silently discard everything since. This
  // component only ticks a display value off that pair; no per-second dispatch happens.
  const question = interview.questionId !== null ? questionById.get(interview.questionId) : undefined;
  // The landing screen is also the recovery: a stored id with no question behind it (a dataset
  // regeneration mid-sitting) has nothing to interview on, so it falls back rather than blanks.
  const showLanding = question === undefined;
  const ticking = phase === 'running' && !showLanding;

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    // Mount (or return from a background tab) opens a segment; leaving closes it. Time the
    // learner was not here is not time they spent — ContestPage settles for the same reason, and
    // here an unsettled hour would put the pace note and the debrief's "what it cost" both wrong.
    dispatch(interviewResumed({ nowMs: Date.now() }));
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    function onVisibility() {
      const now = Date.now();
      setNowMs(now);
      dispatch(
        document.visibilityState === 'hidden'
          ? interviewPaused({ nowMs: now })
          : interviewResumed({ nowMs: now }),
      );
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      dispatch(interviewPaused({ nowMs: Date.now() }));
    };
  }, [ticking, dispatch]);

  const elapsedSec =
    interview.elapsedSec +
    (interview.startedAtMs !== null
      ? Math.max(0, Math.floor((nowMs - interview.startedAtMs) / 1000))
      : 0);

  // --- The problem on offer ------------------------------------------------------------------
  // Unsolved first: an interview on a problem you have already solved is a rehearsal of your own
  // memory, not of your recognition. The ORDER within that pool is evidence-led (see
  // `interviewDraws`) — a problem that stalled under a contest clock, then the areas the one
  // weakness model marks as not holding — while every problem stays reachable by rerolling, so
  // the learner is never cornered by their own record. Date-seeded, so a reload proposes the same
  // problem rather than reshuffling. The reason is NOT shown here: it would name what is coming.
  // Gated on `showLanding`, not merely memoized: the proposal is off screen once a sitting starts,
  // and revealing a hint writes to `progress.byId` — which would otherwise re-rank the whole
  // catalog (and recompute the weakness model behind it) on every rung taken mid-sitting.
  const draws = useAppSelector((state) =>
    showLanding ? selectInterviewDraws(state, today) : NO_DRAWS,
  );

  // Optional company scope. Narrows the pool to the patterns the target company's OWN page names
  // — which is the only thing a company target can ever do here, because no per-problem company
  // data exists and none ever will. Falls back to the full pool rather than emptying the page if
  // the scope leaves nothing: an interview on something is better than an empty landing.
  const scoped = useMemo(() => {
    if (!companyScope || !targetCompany) return draws;
    const patterns = new Set(targetCompany.patterns);
    const inScope = draws.filter((draw) => patterns.has(draw.question.pattern));
    return inScope.length > 0 ? inScope : draws;
  }, [companyScope, targetCompany, draws]);

  const proposedDraw = useMemo(
    () => (scoped.length === 0 ? undefined : scoped[rerolls % scoped.length]),
    [scoped, rerolls],
  );

  const proposed = proposedDraw?.question;

  const basisNote = interview.drawBasis ? DRAW_BASIS_NOTE[interview.drawBasis] : null;

  const family = question?.familyId !== undefined ? familyById[question.familyId] : undefined;
  const hints = hintsFor(family);
  const followUps = question ? followUpsFor(question, family) : [];

  const stage = stageById[interview.stage];
  const finished = phase === 'finished';
  const revealed = (id: RevealId) => isRevealed(id, interview.stage, finished);

  const pace = paceReading(elapsedSec, question?.estimatedTime ?? 0);
  const note = question ? paceNote(pace) : null;

  const upcoming = nextStage(interview.stage);
  const hintsUnlocked = revealed('hints');
  // What THIS sitting has opened — not `progress.byId[id].hintLevelUsed`, which is the all-time
  // deepest rung and would hand a returning learner the whole ladder the moment the gate opened.
  const hintsTaken = interview.hintsTaken;
  const ladderSpent = hintsTaken >= hints.length; // also true when there is no ladder at all

  function begin(id: number) {
    setCheckOpen(false);
    setHintNote(false);
    dispatch(
      interviewStarted({
        questionId: id,
        date: today,
        nowMs: Date.now(),
        hintsAtStart: progressById[id]?.hintLevelUsed ?? 0,
        expectation,
        drawBasis: proposedDraw?.question.id === id ? proposedDraw.basis : null,
      }),
    );
    setExpectation(null);
  }

  function finish() {
    // Through the thunk, not the slice action: finishing is the moment the sitting stops being a
    // performance and becomes a record, and that record is a cross-slice write.
    dispatch(finishInterview());
  }

  function advance() {
    if (upcoming === null) {
      finish();
      return;
    }
    setCheckOpen(false);
    setHintNote(false);
    dispatch(interviewAdvanced({ stage: upcoming }));
  }

  function takeHint() {
    // Enabled whenever the gate is open, on purpose. Disabling it because the ladder is empty
    // encoded "this question has no mapped family" in the button's state — a fact the `family`
    // gate does not open for another three stages, disclosed by a control nobody pressed. The
    // honest version says it out loud, and only once asked.
    if (!question || !hintsUnlocked) return;
    if (ladderSpent) {
      setHintNote(true);
      return;
    }
    dispatch(interviewHintTaken({ max: hints.length }));
    // The persistent record is monotonic: this raises it only where the sitting goes deeper than
    // the question has ever been taken, which is exactly what "how much scaffolding did this
    // problem need" means.
    dispatch(revealHint(question.id, hintsTaken + 1));
  }

  /**
   * The rungs this sitting has opened, in the ladder's rail idiom (DESIGN.md § Hint ladder).
   *
   * Rendered here rather than through `HintLadder` because interview mode has exactly one hint
   * control — the gated "Need a hint" button above — and the shared component carries its own.
   * Two controls where one dispatches through the sitting's counter and the other does not is how
   * a rung silently fails to open. The CONTENT is still the one derived ladder (`hintsFor`); only
   * the presentation is local.
   */
  function hintRungs() {
    if (hints.length === 0) {
      return (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          No hint ladder for this one — it sits outside the mapped problem families, so there is
          nothing verified to give you, and inventing guidance would be worse than saying so.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {hints
          .filter((hint) => hint.level <= hintsTaken)
          .map((hint) => (
            <div key={hint.level} className="border-l-2 border-primary/40 pl-3">
              <Eyebrow>
                Hint {hint.level} &middot; {hint.label}
              </Eyebrow>
              <ul className="mt-1 flex flex-col gap-1">
                {hint.lines.map((line) => (
                  <li key={line} className="max-w-prose text-sm text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {hintsTaken === 0 ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            The ladder is closed. Open a rung from &ldquo;Need a hint&rdquo; when you want one — it
            costs nothing, and taking one is a signal, never a penalty.
          </p>
        ) : hintsTaken >= hints.length ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            That is the whole ladder — it is derived from this problem&rsquo;s family, so there is
            no fourth rung to invent.
          </p>
        ) : null}
      </div>
    );
  }

  /** The content behind one gate. Only ever called once `revealed(id)` is true. */
  function revealContent(id: RevealId) {
    if (!question) return null;
    switch (id) {
      case 'hints':
        return hintRungs();
      case 'pattern':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <PatternChip pattern={patternById[question.pattern]} />
            <span className="text-sm text-muted-foreground">
              {question.subpattern ? `Sub-pattern: ${question.subpattern}` : 'No sub-pattern recorded.'}
            </span>
          </div>
        );
      case 'family':
        return family ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{family.name}</p>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{family.idea}</p>
            <ul className="flex flex-col gap-1.5 border-l-2 border-border pl-3.5">
              {family.signals.map((signal) => (
                <li key={signal} className="max-w-prose text-sm text-muted-foreground">
                  {signal}
                </li>
              ))}
            </ul>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Watch out:</span> {family.trap}
            </p>
          </div>
        ) : (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            This one sits outside the mapped problem families, so there is no verified idea, cue
            list or trap to show — and inventing them would be worse than saying so.
          </p>
        );
      case 'tests':
        return <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{question.tests}</p>;
      case 'complexity':
        return question.complexity ? (
          <p className="figures text-sm text-muted-foreground">
            Time {question.complexity.time} &middot; Space {question.complexity.space}
          </p>
        ) : (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            The intended bounds are not confidently known for this one, so nothing is claimed.
            Defend your own.
          </p>
        );
      case 'follow-ups':
        return followUps.length === 0 ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Nothing in this question&apos;s record — no family, no recorded bounds, no pattern that
            invites one — supports a follow-up worth asking, so none is invented.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {!family && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                A shorter round than usual: this problem sits outside the mapped families, so only
                the follow-ups its own pattern, type and bounds support are listed.
              </p>
            )}
            {followUps.map((followUp) => (
              <div key={followUp.axis} className="flex flex-col gap-1.5">
                <Eyebrow>{followUp.label}</Eyebrow>
                <p className="max-w-prose text-sm leading-relaxed">{followUp.question}</p>
                <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                  {followUp.because}
                </p>
                {/* Answered out loud, then called by the learner — three ways, because "most of
                    the way there" is the commonest honest answer and a yes/no forces it into a
                    lie. Only offered once the attempt is over, which is when a real interviewer
                    asks these; during the sitting it would be a form to fill in. */}
                {finished && (
                  <ChipRadioRow
                    label={`${followUp.label} follow-up`}
                    options={FOLLOW_UP_OUTCOMES}
                    format={(outcome) => FOLLOW_UP_OUTCOME_LABEL[outcome]}
                    value={interview.followUpOutcomes[followUp.axis]}
                    onSelect={(outcome) => dispatch(answerInterviewFollowUp(followUp.axis, outcome))}
                    className="pt-1"
                  />
                )}
              </div>
            ))}
          </div>
        );
    }
  }

  /** The unlock ledger. Shown in every running/finished shape — the gates must always be legible. */
  function unlockList() {
    return (
      <RuledList>
        {REVEALS.map((reveal) => (
          <RuledItem key={reveal.id}>
            <div className="flex flex-col gap-2">
              <Eyebrow>{reveal.label}</Eyebrow>
              {revealed(reveal.id) ? (
                revealContent(reveal.id)
              ) : (
                <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {reveal.locked}
                </p>
              )}
            </div>
          </RuledItem>
        ))}
      </RuledList>
    );
  }

  // --- Idle: choose a problem ----------------------------------------------------------------

  if (showLanding) {
    return (
      <Screen>
        <ScreenHeader
          eyebrow={format(parseISO(today), 'EEEE, MMMM d')}
          title="Interview mode"
          support="One problem, worked the way an interview runs: out loud, in ten stages, with the pattern, the hints and the bounds held back until you have earned them."
        />

        {!proposed ? (
          <EmptyState
            icon={Speech}
            title="No problem to interview on"
            hint="Interview mode draws from the question catalog; it appears to be empty."
          />
        ) : (
          // The offer and the explainer side by side from `lg`: "How it runs" is context for a
          // decision the plate on the left is asking for, and stacked it pushed the Begin button's
          // page past a 590px viewport. DOM order keeps the offer first everywhere.
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8">
            <Lead aria-label="The problem on offer">
              <div className="flex flex-col gap-3">
                <Eyebrow>Your problem</Eyebrow>
                <h2 className="text-xl font-semibold md:text-2xl">{proposed.title}</h2>
                <Meta
                  items={[
                    <DifficultyBadge difficulty={proposed.difficulty} />,
                    <span className="figures">~{proposed.estimatedTime} min recommended</span>,
                    proposed.url && (
                      <a
                        href={proposed.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 underline-offset-2 transition-colors duration-150 ease-swift hover:text-foreground hover:underline"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Read the statement
                      </a>
                    ),
                  ]}
                />
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  That is deliberately everything you get. No pattern, no hints, no capability
                  sentence, no bounds &mdash; each one unlocks at the stage that earns it.
                </p>
              </div>

              <Rule />

              {/* Asked before the attempt and never shown back during it: a prediction the
                  learner can see while working is a target they answer to, and this exists to
                  measure calibration rather than to set one. Optional, and skipping it costs
                  nothing — an expectation nobody offered is recorded as absent, not as a 3. */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">How do you expect this to go?</p>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Optional, and only ever compared with your own read afterwards. Knowing how
                    well you can call it is worth as much as the sitting.
                  </p>
                </div>
                <ChipRadioRow
                  label="Expectation before starting"
                  options={SELF_ASSESSMENT_SCALE}
                  value={expectation ?? undefined}
                  onSelect={(value) =>
                    setExpectation(isSelfAssessmentValue(value) ? value : null)
                  }
                  chipClassName="figures min-w-[44px]"
                  className="items-center"
                  before={<span className="text-xs text-muted-foreground">Rough</span>}
                  after={<span className="text-xs text-muted-foreground">Comfortable</span>}
                />
              </div>

              {/* The company scope. Names the company, never a pattern: a target maps to seven
                  to twelve of them, so this narrows the draw without saying what is coming. */}
              {targetCompany && (
                <label className="flex max-w-prose items-start gap-2.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={companyScope}
                    onChange={(event) => setCompanyScope(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    Draw from the topics {targetCompany.name}&apos;s own prep page names. That is
                    the whole of what targeting them can do — nobody publishes the problems they
                    ask.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => begin(proposed.id)}>
                  Begin interview <ArrowRight />
                </Button>
                <Button variant="outline" onClick={() => setRerolls((r) => r + 1)}>
                  <Shuffle /> Different problem
                </Button>
              </div>
            </Lead>

            <Section
              title="How it runs"
              support="Ten stages, in the order an interview actually takes them. Each one names what it unlocks."
            >
              {/* The full ten-stage explainer is ~850px of static text, identical on every visit:
                  worth reading once, and standing between the learner and the Begin button every
                  time after. The heading and its promise stay pinned — the shape of the thing is
                  part of the offer — while the list itself waits behind the latch for the visit
                  that actually wants to reread it. */}
              <Disclosure summary="The ten stages" meta={String(STAGES.length)}>
                <RuledList as="ol">
                  {STAGES.map((s, i) => (
                    <RuledItem key={s.id}>
                      <div className="flex gap-4">
                        <span className="figures w-5 shrink-0 pt-0.5 text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                            {s.prompt}
                          </p>
                          {s.reveals.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Unlocks: {s.reveals.map((r) => revealById[r].label).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </RuledItem>
                  ))}
                </RuledList>
              </Disclosure>
            </Section>
          </div>
        )}
      </Screen>
    );
  }

  const index = stageIndex(interview.stage);
  const statementLink = question.url ? (
    <Button variant="outline" size="sm" asChild>
      <a href={question.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink /> Statement
      </a>
    </Button>
  ) : undefined;

  // --- Finished: self-assessment, then the debrief --------------------------------------------

  if (finished) {
    return (
      <Screen>
        <ScreenHeader
          eyebrow="Interview complete"
          title={question.title}
          support={`${DIFFICULTY_WORD[question.difficulty]} · you reached the ${stage.label.toLowerCase()} stage.`}
          action={statementLink}
        />

        <Lead aria-label="Your self-assessment">
          <div className="flex flex-col gap-3">
            <Eyebrow>Self-assessment</Eyebrow>
            <h2 className="text-xl font-semibold md:text-2xl">How do you think that went?</h2>
            {/* The honesty clause. Nothing in this app saw the attempt: there is no judge, no
                score and no verdict, and the copy has to say so plainly or the numbers will be
                read as one. */}
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              This is your own read and nothing else. Nothing here saw your code or heard your
              explanation, so there is no score, no grade and no verdict &mdash; the five numbers
              exist so you can compare this sitting with your next one.
            </p>
            {/* The line above promised a comparison the app could not make until the sittings
                persisted. It can now, and it is stated as marginalia rather than as a finding:
                two sittings on two different problems are two data points, and a trend across
                five of them belongs on Analytics, not in the middle of a debrief. */}
            {previous && (
              <Meta
                items={[
                  <span>
                    Last sitting ·{' '}
                    {questionById.get(previous.questionId)?.title ?? 'another problem'}
                  </span>,
                  <span>{format(parseISO(previous.date), 'd MMM')}</span>,
                  <span>
                    reached{' '}
                    {(STAGES[previous.stageReached - 1] ?? STAGES[0]!).label.toLowerCase()}
                  </span>,
                  previous.hintsAvailable > 0 && (
                    <span className="figures">
                      {previous.hintsTaken} of {previous.hintsAvailable} hints
                    </span>
                  ),
                ]}
              />
            )}
          </div>
        </Lead>

        {/* The five prompts left the plate. Inside it they made a 1,000px `Lead` on desktop and
            ~1,400px on a phone — the debrief's framing statement and five identical rated rows
            carried at one weight, so the plate meant nothing. Five rows of the same shape are a
            list, and the plate now holds only the one thing it is for: the claim that nothing here
            judged the attempt. `RuledList` supplies the hairlines the per-item `<Rule />` was
            drawing by hand, which is also how the row step stops being re-declared five times. */}
        <Section
          title="Rate the five"
          support="Your own read, on the same five axes each sitting, so the next one has something to sit beside."
        >
          <RuledList>
            {SELF_ASSESSMENT.map((prompt) => (
              <RuledItem key={prompt.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-medium">{prompt.label}</p>
                    {previous?.assessment[prompt.id] !== undefined && (
                      <Eyebrow>
                        <span className="figures">Last time: {previous.assessment[prompt.id]}</span>
                      </Eyebrow>
                    )}
                  </div>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {prompt.question}
                  </p>
                </div>
                <ChipRadioRow
                  label={`${prompt.label} self-rating`}
                  options={SELF_ASSESSMENT_SCALE}
                  value={interview.selfAssessment[prompt.id]}
                  onSelect={(value) => dispatch(rateInterview(prompt.id, value))}
                  chipClassName="figures min-w-[44px]"
                  className="items-center"
                  before={<span className="text-xs text-muted-foreground">{prompt.low}</span>}
                  after={<span className="text-xs text-muted-foreground">{prompt.high}</span>}
                />
              </RuledItem>
            ))}
          </RuledList>
        </Section>

        {/* Two readings of the same sitting — what it cost in figures, and what the learner
            called each stage at the time. They describe the same minutes, so at md+ they sit
            beside each other instead of costing two screens; below md they stack in the order
            they always did. When no stage was rated the pair simply has one member, and the
            ledger holding half the measure is still wider than any of its three figures needs. */}
        <PagePair>
          <Section title="The sitting" support="What it cost, and how far it got.">
            {/* `columns={2}`, not 3. This page is `width="reading"` (46rem), so the page cap binds
                before the viewport at every size, and `PagePair` halves it — ~348px per column at
                md, lg, xl and 1440 alike. Three tracks in 348px is ~103px, less 20px of `sm:pl-5`
                on the ruled columns, holding a `text-[1.75rem]` figure: `formatElapsed` returns
                `1:02:15` for any sitting past an hour, which does not fit, and every `sub` wraps to
                three lines. `PagePair`'s own docstring says it pairs "two columns of small facts";
                a 3-up display-figure ledger is not that. */}
            <Ledger
              columns={2}
              items={[
                {
                  label: 'Time taken',
                  value: formatElapsed(interview.elapsedSec),
                  sub: `~${question.estimatedTime} min recommended`,
                },
                {
                  label: 'Stages reached',
                  value: `${index + 1} of ${STAGES.length}`,
                  sub: stage.label,
                },
                {
                  label: 'Hints taken',
                  // THIS sitting's rungs. Billing the all-time record to one attempt reported
                  // "3 of 3" for a sitting in which the learner took none, purely because they had
                  // opened the ladder on this problem some other day.
                  value: `${hintsTaken} of ${hints.length}`,
                  // Reported, never scored. Taking the ladder costs nothing here either.
                  sub:
                    hints.length === 0
                      ? 'No ladder for this one'
                      : hintsTaken > 0
                        ? `Through rung ${hintsTaken}`
                        : interview.hintsAtStart > 0
                          ? 'Untouched this sitting'
                          : 'Ladder untouched',
                },
              ]}
            />
          </Section>

          {ratedStages.length > 0 && (
            <Section title="How the stages went" support="Your own call at the time, recorded as you went.">
              <RuledList>
                {ratedStages.map(([stageId, outcome]) => (
                  <RuledItem key={stageId}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-sm font-medium">{stageById[stageId].label}</p>
                      <Eyebrow>{STAGE_OUTCOME_LABEL[outcome]}</Eyebrow>
                    </div>
                  </RuledItem>
                ))}
              </RuledList>
            </Section>
          )}
        </PagePair>

        <Section
          title="The debrief"
          support="Everything the stages were holding back. The attempt is over, so none of it is worth hiding now."
        >
          {unlockList()}
        </Section>

        <Section title="Close it out" support="Optional, and nothing reads it but you.">
          <div className="flex flex-col gap-4">
            {/* Why this problem came up. Stated here and nowhere earlier: on the landing it would
                have named what was coming, and turned opening the page into a verdict. */}
            {basisNote && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {basisNote}
              </p>
            )}
            <Textarea
              aria-label="One line about this sitting"
              placeholder="One line about this sitting — what you would do differently at the start."
              value={interview.reflection}
              onChange={(event) => dispatch(reflectOnInterview(event.target.value))}
              rows={2}
            />
            {/* The way out lives at the end of the closing section rather than in a region of its
                own: a lone button is not a section, and naming it one made the outline claim a
                fourth act the debrief does not have. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => dispatch(interviewCleared())}>
                <RotateCcw /> Interview another problem
              </Button>
            </div>
          </div>
        </Section>
      </Screen>
    );
  }

  // --- Running: one stage at a time ------------------------------------------------------------

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Interview in progress"
        title={question.title}
        support={`${DIFFICULTY_WORD[question.difficulty]} · recommended ~${question.estimatedTime} min`}
        action={statementLink}
      />

        <Lead aria-label="Current stage">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <Eyebrow>
              Stage {index + 1} / {STAGES.length} &middot; {stage.label}
            </Eyebrow>
            {/* Counts up, never down, and never changes colour. See engine/interview.ts § Timer. */}
            <Eyebrow>
              <span className="sr-only">Elapsed </span>
              {formatElapsed(elapsedSec)}
            </Eyebrow>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold md:text-2xl">{stage.prompt}</h2>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{stage.reports}</p>
          </div>

          {note && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>
          )}

          {checkOpen && (
            <ul className="flex flex-col gap-1.5 border-l-2 border-primary/40 pl-3.5">
              {stage.check.map((line) => (
                <li key={line} className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">How did that go?</p>
            <ChipRadioRow
              label="Your own read on this stage"
              options={STAGE_OUTCOMES}
              value={interview.stageOutcomes[interview.stage]}
              onSelect={(outcome) => dispatch(stageOutcomeSet({ stage: interview.stage, outcome }))}
              format={(outcome) => STAGE_OUTCOME_LABEL[outcome]}
            />
          </div>

          <Rule />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={advance}>
              {stage.advance} <ArrowRight />
            </Button>
            {/* Disabled by the GATE and nothing else. Whether a ladder exists behind it is the
                answer to a different question, which the `family` gate does not open for another
                three stages — see takeHint. */}
            <Button variant="outline" onClick={takeHint} disabled={!hintsUnlocked}>
              <Lightbulb /> Need a hint
            </Button>
            <Button variant="ghost" onClick={() => setCheckOpen((open) => !open)} aria-expanded={checkOpen}>
              <ListChecks /> Check my reasoning
            </Button>
            {upcoming !== null && (
              <Button variant="ghost" onClick={finish}>
                I&apos;m done
              </Button>
            )}
          </div>

          {!hintsUnlocked ? (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {revealById.hints.locked}
            </p>
          ) : hintNote ? (
            // Said only when asked, and said once: the reveal below carries the full explanation,
            // so this line answers the press rather than repeating the paragraph.
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {hints.length === 0
                ? 'Nothing to give — this problem has no mapped family, so the ladder below is empty.'
                : 'Every rung is already open below.'}
            </p>
          ) : null}
        </Lead>

      <Section
        title="What you have unlocked"
        support="Interview mode holds this back on purpose. Each line names what would open it."
      >
        {unlockList()}
      </Section>
    </Screen>
  );
}

/* `ChipRadioRow` now lives in components/shared — Today's capacity chips need the same control,
   and the copy that stayed here was the only correct one of the three. */
