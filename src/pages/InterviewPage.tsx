import { useEffect, useMemo, useState } from 'react';
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
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Page,
  PageHeader,
  Section,
  Lead,
  Rule,
  RuledList,
  RuledItem,
  Ledger,
  Meta,
  Eyebrow,
} from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { revealHint } from '@/store/actions';
import {
  interviewAdvanced,
  interviewCleared,
  interviewFinished,
  interviewHintTaken,
  interviewPaused,
  interviewResumed,
  interviewStarted,
  selectInterviewPhase,
  selectRatedStages,
  selfAssessmentSet,
  stageOutcomeSet,
} from '@/store/slices/interviewSlice';
import { useToday } from '@/hooks/useToday';
import { hintsFor } from '@/utils/engine/hints';
import {
  REVEALS,
  SELF_ASSESSMENT,
  SELF_ASSESSMENT_SCALE,
  STAGES,
  STAGE_OUTCOMES,
  STAGE_OUTCOME_LABEL,
  followUpsFor,
  formatElapsed,
  isRevealed,
  nextStage,
  paceNote,
  paceReading,
  revealById,
  stageById,
  stageIndex,
  type RevealId,
} from '@/utils/engine/interview';
import { hashSeed, mulberry32, seededShuffle } from '@/utils/engine/prng';
import { cn } from '@/utils/cn';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// The capacity-chip idiom (DESIGN.md § Capacity chips): small bordered toggles, ink fill for the
// one that is active. Reused here for the stage self-report and the self-assessment scale, both
// of which are "exactly one of these is true" rows.
const CHIP_CLASS =
  'inline-flex min-h-[44px] items-center justify-center rounded-sm border px-3 text-xs transition-colors duration-150 ease-swift';
const CHIP_ON = 'border-primary bg-primary text-primary-foreground';
const CHIP_OFF = 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground';

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

  const [rerolls, setRerolls] = useState(0);
  const [checkOpen, setCheckOpen] = useState(false);
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
  // memory, not of your recognition. Date-seeded so the proposal is stable across a reload, with
  // a reroll for the days when it is not the one you want. Both memos short-circuit once an
  // interview is running — the proposal is not on screen then, and revealing a hint writes to
  // `progress.byId`, which would otherwise re-scan and re-shuffle 539 questions mid-sitting.
  const pool = useMemo(() => {
    if (!showLanding) return questions;
    const unsolved = questions.filter((q) => progressById[q.id]?.status !== 'solved');
    return unsolved.length > 0 ? unsolved : questions;
  }, [showLanding, progressById]);

  const proposed = useMemo(() => {
    if (!showLanding) return undefined;
    const order = seededShuffle(pool, mulberry32(hashSeed(`interview:${today}`)));
    return order[rerolls % order.length];
  }, [showLanding, pool, today, rerolls]);

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
      }),
    );
  }

  function finish() {
    dispatch(interviewFinished({ date: today, nowMs: Date.now() }));
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
      <Page width="reading">
        <PageHeader
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
          <>
            <Section aria-label="The problem on offer">
              <Lead className="flex flex-col gap-6">
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

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => begin(proposed.id)}>
                    Begin interview <ArrowRight />
                  </Button>
                  <Button variant="outline" onClick={() => setRerolls((r) => r + 1)}>
                    <Shuffle /> Different problem
                  </Button>
                </div>
              </Lead>
            </Section>

            <Section
              title="How it runs"
              support="Ten stages, in the order an interview actually takes them. Each one names what it unlocks."
            >
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
                          <p className="text-xs text-muted-foreground/80">
                            Unlocks: {s.reveals.map((r) => revealById[r].label).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </RuledItem>
                ))}
              </RuledList>
            </Section>
          </>
        )}
      </Page>
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
      <Page width="reading">
        <PageHeader
          eyebrow="Interview complete"
          title={question.title}
          support={`${DIFFICULTY_WORD[question.difficulty]} · you reached the ${stage.label.toLowerCase()} stage.`}
          action={statementLink}
        />

        <Section aria-label="Your self-assessment">
          <Lead className="flex flex-col gap-6">
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
            </div>

            {SELF_ASSESSMENT.map((prompt) => (
              <div key={prompt.id} className="flex flex-col gap-3">
                <Rule />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{prompt.label}</p>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {prompt.question}
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={`${prompt.label} self-rating`}
                >
                  <span className="text-xs text-muted-foreground">{prompt.low}</span>
                  {SELF_ASSESSMENT_SCALE.map((value) => {
                    const active = interview.selfAssessment[prompt.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => dispatch(selfAssessmentSet({ id: prompt.id, value }))}
                        className={cn('figures min-w-[44px]', CHIP_CLASS, active ? CHIP_ON : CHIP_OFF)}
                      >
                        {value}
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted-foreground">{prompt.high}</span>
                </div>
              </div>
            ))}
          </Lead>
        </Section>

        <Section title="The sitting" support="What it cost, and how far it got.">
          <Ledger
            columns={3}
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

        <Section
          title="The debrief"
          support="Everything the stages were holding back. The attempt is over, so none of it is worth hiding now."
        >
          {unlockList()}
        </Section>

        <Section aria-label="Next">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => dispatch(interviewCleared())}>
              <RotateCcw /> Interview another problem
            </Button>
          </div>
        </Section>
      </Page>
    );
  }

  // --- Running: one stage at a time ------------------------------------------------------------

  return (
    <Page width="reading">
      <PageHeader
        eyebrow="Interview in progress"
        title={question.title}
        support={`${DIFFICULTY_WORD[question.difficulty]} · recommended ~${question.estimatedTime} min`}
        action={statementLink}
      />

      <Section aria-label="Current stage">
        <Lead className="flex flex-col gap-6">
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Your own read on this stage">
              {STAGE_OUTCOMES.map((outcome) => {
                const active = interview.stageOutcomes[interview.stage] === outcome;
                return (
                  <button
                    key={outcome}
                    type="button"
                    aria-pressed={active}
                    onClick={() => dispatch(stageOutcomeSet({ stage: interview.stage, outcome }))}
                    className={cn(CHIP_CLASS, active ? CHIP_ON : CHIP_OFF)}
                  >
                    {STAGE_OUTCOME_LABEL[outcome]}
                  </button>
                );
              })}
            </div>
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
      </Section>

      <Section
        title="What you have unlocked"
        support="Interview mode holds this back on purpose. Each line names what would open it."
      >
        {unlockList()}
      </Section>
    </Page>
  );
}
