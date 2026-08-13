import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Check, GraduationCap, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { cn } from '@/utils/cn';
import { patternById } from '@/data/patterns';
import { CORE_WEEKS } from '@/data/aimlCourse';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  clearRevisionSession,
  completeSessionActivity,
  finishRevisionSession,
  reviseCourseWeek,
  reviseQuestion,
  setDailyCapacity,
  startRevisionSession,
  uncompleteSessionActivity,
} from '@/store/actions';
import { selectForecast, selectQuestionById, selectRevisionSession } from '@/store/selectors';
import { initialCourseProgress, isWeekRetained } from '@/utils/engine/aimlCourse';
import { isMastered } from '@/utils/engine/spacedRepetition';
import { formatMinutes } from '@/utils/engine/planner';
import {
  DEPTH_LABEL,
  SESSION_BUDGETS,
  sessionProgress,
  shapeFor,
  type SessionActivity,
} from '@/utils/engine/session';
import type { Question } from '@/types';

/**
 * Revision — "give me thirty minutes and I'll tell you what is worth revising".
 *
 * The page this replaces answered a different question: "what is due?" It showed the queue, and
 * on a bad week the queue was thirty-seven items and the honest response to it was to close the
 * tab. A list of everything owed is a debt notice, and debt notices are not a study plan.
 *
 * So the learner states the one thing only they know — how much time they have — and the session
 * engine composes the best use of it. Everything else on this page is subordinate to that: the
 * overdue count is never the headline, and work that does not fit is described as waiting rather
 * than as owed. See engine/session.ts for how depth, load and the session arc are chosen.
 */
export default function RevisionPage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const planned = useAppSelector((state) => selectRevisionSession(state, today));
  const { frozen, doneIds, grades, startedOn, completedOn } = useAppSelector((state) => state.session);
  const budgetMin = useAppSelector((state) => state.settings.dailyCapacityMin);
  const revisionEnabled = useAppSelector((state) => state.settings.revisionEnabled);
  const progressById = useAppSelector((state) => state.progress.byId);
  const courseByWeekId = useAppSelector((state) => state.course.byWeekId);
  const forecast = useAppSelector((state) => selectForecast(state, today));

  const [showMastered, setShowMastered] = useState(false);

  const running = startedOn !== null && completedOn === null;
  const finished = completedOn !== null;

  // While a session is live the page reads the frozen plan WHOLESALE — activities, shape label,
  // focus, rationale, deferred list. Overlaying only the activities onto the live selector let
  // everything else recompute underneath the sitting: changing the shared capacity on Today
  // mid-session relabelled a running "Deep review" as "Quick recall". A session is a commitment;
  // every property of it holds still until it ends. (See SessionState.frozen.)
  const session = startedOn !== null && frozen !== null ? frozen : planned;
  const progress = sessionProgress(session, doneIds);

  const masteredQuestions = useMemo(
    () =>
      Object.entries(progressById)
        .filter(([, p]) => isMastered(p))
        .map(([id]) => selectQuestionById(Number(id)))
        .filter((q): q is Question => q !== undefined)
        .sort((a, b) => a.id - b.id),
    [progressById],
  );

  const retainedWeeks = useMemo(
    () => CORE_WEEKS.filter((week) => isWeekRetained(courseByWeekId[week.id] ?? initialCourseProgress())),
    [courseByWeekId],
  );

  const upcoming = useMemo(() => forecast.filter((d) => d.count > 0).slice(0, 7), [forecast]);
  // The whole truth, not just what fit — and every term of it read off the SAME session, which is
  // the part that matters. The total used to add due course reviews from a live selector while the
  // shortfall named only deferred questions, so on any budget that could not place a course recall
  // (fifteen and thirty cannot place one at all) the page counted work in its total and then left
  // it out of "N of them are not in this session" — claiming a smaller shortfall than the truth
  // and implying course reviews were on screen when they were not.
  //
  // Sourcing both from the session also makes the footer hold still mid-sitting, like the rest of
  // a frozen plan: grading a course recall no longer shrinks a total the frozen rationale still
  // counts.
  const shortfall = session.deferred.length + session.deferredCourseReviews.length;
  const dueCount =
    session.rationale.due + session.rationale.overdue + session.rationale.retention + shortfall;

  function openActivity(activity: SessionActivity) {
    if (activity.questionId !== undefined) dispatch(activeQuestionSet(activity.questionId));
  }

  /**
   * Has the ladder already taken a grade for this item today?
   *
   * Both `reviseQuestion` and `reviseCourseWeek` refuse a second grade on the same calendar day —
   * one grade per day is the ladder's idempotency rule. A session can still contain such an item:
   * once due work runs out the session engine pulls upcoming reviews forward, and a review graded
   * from Today's hero this morning is exactly that. Offering "Recalled it" there produced no XP,
   * no ladder movement and no day-log entry while the row went on to report "Recalled" — the app
   * telling the learner work happened that did not. So the row states the fact instead, the same
   * treatment `QuestionCard` gives a question already reviewed today.
   */
  function reviewedToday(activity: SessionActivity): { nextRevision: string | null } | null {
    if (activity.questionId !== undefined) {
      const p = progressById[activity.questionId];
      return p !== undefined && p.lastReviewed === today ? { nextRevision: p.nextRevision } : null;
    }
    if (activity.weekId !== undefined) {
      const c = courseByWeekId[activity.weekId];
      return c !== undefined && c.lastReviewed === today ? { nextRevision: c.nextRevision } : null;
    }
    return null;
  }

  // Grading and ticking are one gesture: a graded review is by definition done, and asking the
  // learner to both answer "did you recall it" and then tick a box is bookkeeping, not learning.
  function gradeActivity(activity: SessionActivity, passed: boolean) {
    // Never record a completion the ladder is going to refuse (see reviewedToday).
    if (reviewedToday(activity)) return;
    if (activity.questionId !== undefined) dispatch(reviseQuestion(activity.questionId, passed));
    else if (activity.weekId !== undefined) dispatch(reviseCourseWeek(activity.weekId, passed));
    // The grade rides along so the row can show the recorded outcome — final for the sitting.
    dispatch(completeSessionActivity(activity.id, passed));
  }

  return (
    <Page>
      <PageHeader
        eyebrow={format(parseISO(today), 'EEEE, MMMM d')}
        title="Revision"
        support="Tell it how long you have. It works out what is worth doing in that time — and what can wait."
      />

      {session.activities.length === 0 ? (
        <EmptyState
          icon={Check}
          title={shortfall > 0 ? "This budget can't hold what's due" : 'Nothing to revise right now'}
          hint={
            !revisionEnabled
              ? 'Spaced revision is switched off in Settings, so the ladder is not scheduling reviews.'
              : shortfall > 0
                ? // Work IS due — it just does not fit the chosen length. Saying "nothing to
                  // revise" here would be the page contradicting its own footer one line below.
                  'Give it more time above and the session will fill. Nothing is lost in the meantime — a late review costs nothing on the ladder.'
                : 'Future you says thanks. Solve something new and it will come back around the ladder.'
          }
        />
      ) : finished ? (
        <SessionComplete
          session={session}
          doneIds={doneIds}
          grades={grades}
          onRestart={() => dispatch(clearRevisionSession())}
        />
      ) : running ? (
        <SessionRun
          session={session}
          doneIds={doneIds}
          grades={grades}
          progress={progress}
          reviewedToday={reviewedToday}
          onToggle={(id, done) =>
            dispatch(done ? uncompleteSessionActivity(id) : completeSessionActivity(id))
          }
          onGrade={gradeActivity}
          onOpen={openActivity}
          onFinish={() => dispatch(finishRevisionSession())}
          onAbandon={() => dispatch(clearRevisionSession())}
        />
      ) : (
        <SessionPreview
          session={session}
          budgetMin={budgetMin}
          onBudget={(min) => dispatch(setDailyCapacity(min))}
          onStart={() => dispatch(startRevisionSession())}
        />
      )}

      {/* Everything below is reference, deliberately quieter than the session above it. */}
      {upcoming.length > 0 && (
        <Section
          title="Coming up"
          support="What the ladder has scheduled next. Nothing here needs doing today."
          divider
        >
          <RuledList>
            {upcoming.map((day) => (
              <RuledItem key={day.date} className="flex items-baseline justify-between gap-4">
                <span className="text-sm">{format(parseISO(day.date), 'EEEE, MMM d')}</span>
                <span className="figures text-sm text-muted-foreground">
                  {day.count} {day.count === 1 ? 'review' : 'reviews'}
                </span>
              </RuledItem>
            ))}
          </RuledList>
        </Section>
      )}

      {(masteredQuestions.length > 0 || retainedWeeks.length > 0) && (
        <Section
          title="Mastered"
          support="Cleared the full 1/3/7/15/30 ladder. These no longer come back."
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowMastered((v) => !v)} aria-expanded={showMastered}>
              {showMastered ? 'Hide' : 'Show'} list
            </Button>
          }
        >
          <p className="figures text-sm text-muted-foreground">
            {masteredQuestions.length} {masteredQuestions.length === 1 ? 'question' : 'questions'}
            {retainedWeeks.length > 0 && ` · ${retainedWeeks.length} course ${retainedWeeks.length === 1 ? 'week' : 'weeks'}`}
          </p>
          {showMastered && (
            <RuledList>
              {masteredQuestions.map((question) => (
                <RuledItem key={question.id} padded={false}>
                  <button
                    type="button"
                    className="w-full px-1 py-3 text-left text-sm transition-colors duration-150 ease-swift hover:bg-muted"
                    onClick={() => dispatch(activeQuestionSet(question.id))}
                  >
                    {question.title}
                  </button>
                </RuledItem>
              ))}
              {retainedWeeks.map((week) => (
                <RuledItem key={week.id} padded={false}>
                  <Link
                    to="/aiml"
                    className="flex w-full items-center gap-2 px-1 py-3 text-sm transition-colors duration-150 ease-swift hover:bg-muted"
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    Week {week.week} — {week.title}
                  </Link>
                </RuledItem>
              ))}
            </RuledList>
          )}
        </Section>
      )}

      {/* Said wherever the learner is in the flow: with the setting off, the ladder schedules
          nothing, so an absence of due reviews here is a choice they made rather than a claim
          that their recall is safe. Today applies the same gate — the two must never disagree. */}
      {!revisionEnabled && (
        <p className="text-sm text-muted-foreground">
          Spaced revision is switched off in Settings, so the ladder is not scheduling reviews.
          Anything here is recognition and transfer practice, not recall that came due.
        </p>
      )}

      {revisionEnabled && dueCount > 0 && !finished && (
        <p className="text-sm text-muted-foreground">
          {dueCount} {dueCount === 1 ? 'item is' : 'items are'} due in total
          {shortfall > 0 &&
            ` — ${shortfall} of them ${shortfall === 1 ? 'is' : 'are'} not in this session`}
          . The ladder does not penalise a late review — anything the session leaves is simply
          waiting, not lost.
        </p>
      )}
    </Page>
  );
}

/* ------------------------------------------------------------------------------------------- */

function SessionPreview({
  session,
  budgetMin,
  onBudget,
  onStart,
}: {
  session: ReturnType<typeof selectRevisionSession>;
  budgetMin: number;
  onBudget: (min: number) => void;
  onStart: () => void;
}) {
  const focusNames = session.focus.map((id) => patternById[id]?.name ?? id);
  const { due, overdue, weakness, retention, transfer } = session.rationale;
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // "2 due + 1 weak pattern + 2 retention checks" — the composition, in the learner's terms.
  const because = [
    overdue > 0 && `${overdue} overdue`,
    due > 0 && `${due} due today`,
    weakness > 0 && `${weakness} from a weak pattern`,
    retention > 0 && `${retention} course ${retention === 1 ? 'recall' : 'recalls'}`,
    transfer > 0 && `${transfer} unfamiliar ${transfer === 1 ? 'problem' : 'problems'}`,
  ].filter((x): x is string => Boolean(x));

  // The chip the keyboard enters the group on. A capacity set from the Settings field need not be
  // one of the six presets, so with nothing matching, the first chip stays tabbable — a
  // radiogroup every one of whose radios is tabIndex -1 cannot be reached at all.
  const selectedIndex = SESSION_BUDGETS.findIndex((min) => min === budgetMin);
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function moveTo(index: number) {
    const min = SESSION_BUDGETS[index];
    if (min === undefined) return;
    onBudget(min);
    chipRefs.current[index]?.focus();
  }

  // Arrow keys move selection inside a radiogroup — that is the contract the role promises, and a
  // group that only responds to Tab and click is announcing one thing and behaving as another.
  function onChipKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = SESSION_BUDGETS.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = selectedIndex === -1 ? 0 : (selectedIndex + 1) % SESSION_BUDGETS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = selectedIndex === -1 ? last : (selectedIndex + last) % SESSION_BUDGETS.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    moveTo(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground">
          How long have you got?
        </legend>
        {/* A radiogroup, not six independent toggles — the same correction Today's capacity chips
            already carry (components/today/SessionPlan.tsx). `aria-pressed` announced six
            switches, five of them "not pressed", for a control where exactly one option is ever
            true. Same idiom, same ink fill, same written capacity: one time budget, not two. */}
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="How long have you got?"
          onKeyDown={onChipKeyDown}
        >
          {SESSION_BUDGETS.map((min, i) => {
            const active = min === budgetMin;
            return (
              <button
                key={min}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={i === focusIndex ? 0 : -1}
                ref={(node) => {
                  chipRefs.current[i] = node;
                }}
                onClick={() => onBudget(min)}
                className={cn(
                  'figures inline-flex min-h-[44px] items-center justify-center rounded-sm border px-3 text-xs transition-colors duration-150 ease-swift',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {formatMinutes(min)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Lead className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Eyebrow>{formatMinutes(session.budgetMin)} session</Eyebrow>
          <h2 className="text-2xl font-semibold">{session.shape.label}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{session.shape.blurb}</p>
        </div>

        <Rule />

        <Ledger
          columns={3}
          items={[
            { label: 'Activities', value: session.activities.length },
            { label: 'Planned', value: formatMinutes(session.totalMinutes) },
            {
              label: 'Focus',
              value: focusNames.length > 0 ? focusNames.length : '—',
              sub: focusNames.length > 0 ? focusNames.join(' · ') : 'mixed',
            },
          ]}
        />

        {because.length > 0 && (
          <p className="max-w-prose text-sm text-muted-foreground">
            <span className="text-foreground">Why these:</span> {because.join(' · ')}.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onStart}>Start session</Button>
          <span className="figures text-xs text-muted-foreground">
            ~{formatMinutes(session.totalMinutes)}
          </span>
        </div>
      </Lead>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- */

/**
 * Which activities move the ladder. A transfer problem is a new solve, not a review; a drill and
 * the closing reflection are not graded at all — so only these three depths take a verdict.
 */
const GRADABLE_KINDS = new Set(['recall', 'review', 'deep', 'course-review']);

function isGradable(activity: SessionActivity): boolean {
  return (
    GRADABLE_KINDS.has(activity.kind) &&
    (activity.questionId !== undefined || activity.weekId !== undefined)
  );
}

function SessionRun({
  session,
  doneIds,
  grades,
  progress,
  reviewedToday,
  onToggle,
  onGrade,
  onOpen,
  onFinish,
  onAbandon,
}: {
  session: ReturnType<typeof selectRevisionSession>;
  doneIds: string[];
  grades: Record<string, boolean>;
  progress: ReturnType<typeof sessionProgress>;
  reviewedToday: (activity: SessionActivity) => { nextRevision: string | null } | null;
  onToggle: (id: string, done: boolean) => void;
  onGrade: (activity: SessionActivity, passed: boolean) => void;
  onOpen: (activity: SessionActivity) => void;
  onFinish: () => void;
  onAbandon: () => void;
}) {
  const done = new Set(doneIds);
  const pct = progress.totalMinutes === 0 ? 0 : Math.round((progress.doneMinutes / progress.totalMinutes) * 100);

  return (
    // Not a plate. DESIGN.md § The plate rule: a progress bar already draws its own boundary, and
    // wrapping one bar plus two lines of text in `p-6 md:p-8` produced a very wide, very short box
    // that added an outline and no hierarchy. The running session IS the activity list; the shape
    // name and the two figures are its heading, which is what a `Section` is for.
    <Section
      title={session.shape.label}
      action={
        // Minutes AND activities: "3 of 10" says nothing about whether the evening is nearly
        // over, which is the thing someone mid-session actually wants to know.
        <p className="figures text-sm text-muted-foreground">
          {formatMinutes(progress.doneMinutes)} of {formatMinutes(progress.totalMinutes)} &middot;{' '}
          {progress.doneCount} of {progress.totalCount} activities
        </p>
      }
    >
      <Progress value={pct} aria-label="Session progress" />

      <RuledList aria-label="Session activities">
        {session.activities.map((activity) => {
          const isDone = done.has(activity.id);
          const alreadyReviewed = reviewedToday(activity);
          return (
            <RuledItem key={activity.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Meta
                    items={[
                      <span key="kind" className="text-xs uppercase tracking-[0.12em]">
                        {activity.kind === 'drill'
                          ? 'Drill'
                          : activity.kind === 'course-review'
                            ? 'Course recall'
                            : activity.kind === 'reflect'
                              ? 'Close'
                              : DEPTH_LABEL[activity.kind]}
                      </span>,
                      <span key="min" className="figures text-xs">
                        ~{formatMinutes(activity.minutes)}
                      </span>,
                      activity.pattern ? patternById[activity.pattern]?.name : null,
                    ]}
                  />
                  <p className={'font-medium ' + (isDone ? 'text-muted-foreground line-through' : '')}>
                    {activity.title}
                  </p>
                  <p className="max-w-prose text-sm text-muted-foreground">{activity.prompt}</p>
                  <p className="max-w-prose text-xs text-muted-foreground/80">{activity.why}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {/* A revision activity is graded here, not merely ticked. Ticking records that
                      the learner did the thing; only a grade moves the ladder — and the completion
                      summary's "held / needs another pass" reads the graded result, so without
                      this the session could never report how recall actually went.

                      A recorded grade is FINAL for the sitting: the ladder has already moved and
                      the XP is already paid, so the row states the outcome rather than offering
                      an "Undo" that could only un-tick the row while silently leaving both — and
                      whose re-grade would move the ladder twice. (Ungraded ticks below keep
                      their Undo; retracting "I did this" is honest, retracting a grade is not.) */}
                  {isGradable(activity) ? (
                    isDone ? (
                      <p className="text-sm text-muted-foreground">
                        {grades[activity.id] === undefined
                          ? 'Recorded'
                          : grades[activity.id]
                            ? 'Recalled'
                            : 'Needs another pass'}
                      </p>
                    ) : alreadyReviewed ? (
                      // Graded earlier today — from Today's hero, or a previous sitting. The
                      // ladder takes one grade per day, so there is no control to offer here;
                      // saying when it next comes round is the useful, true thing to say.
                      <p className="text-right text-sm text-muted-foreground">
                        Reviewed today
                        {alreadyReviewed.nextRevision !== null
                          ? ` · next review ${format(parseISO(alreadyReviewed.nextRevision), 'MMM d')}`
                          : ' · no further reviews'}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onGrade(activity, true)}>
                          Recalled it
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onGrade(activity, false)}>
                          Not yet
                        </Button>
                      </div>
                    )
                  ) : (
                    <Button
                      variant={isDone ? 'ghost' : 'outline'}
                      size="sm"
                      onClick={() => onToggle(activity.id, isDone)}
                      aria-pressed={isDone}
                    >
                      {isDone ? 'Undo' : 'Done'}
                    </Button>
                  )}
                  {activity.questionId !== undefined && (
                    <Button variant="ghost" size="sm" onClick={() => onOpen(activity)}>
                      Open
                    </Button>
                  )}
                  {activity.questionId === undefined && activity.href !== '/revision' && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={activity.href}>Open</Link>
                    </Button>
                  )}
                </div>
              </div>
            </RuledItem>
          );
        })}
      </RuledList>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onFinish}>Finish session</Button>
        <Button variant="ghost" onClick={onAbandon}>
          Stop here
        </Button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------------------------- */

function SessionComplete({
  session,
  doneIds,
  grades,
  onRestart,
}: {
  session: ReturnType<typeof selectRevisionSession>;
  doneIds: string[];
  grades: Record<string, boolean>;
  onRestart: () => void;
}) {
  const progress = sessionProgress(session, doneIds);
  // Held / needs another pass come from THIS SITTING's graded activities, not from which rows were
  // ticked and not from the day's ledger. Ticking a row says "I did this"; only a grade says how
  // it went. And the ledger is the wrong scope: it holds every review graded anywhere today, so
  // three reviews graded from Today at breakfast were reported as the output of a two-item session
  // in the evening, under a heading that counts two activities. `grades` is exactly the sitting —
  // and it covers course recalls too, which the DSA-only day log never recorded.
  const held = session.activities.filter((a) => grades[a.id] === true);
  const shaky = session.activities.filter((a) => grades[a.id] === false);
  const nextUp = session.activities.find((a) => !doneIds.includes(a.id)) ?? session.deferred[0]?.question;

  return (
    <Lead className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Eyebrow>Session complete</Eyebrow>
        <h2 className="text-2xl font-semibold">
          {formatMinutes(progress.doneMinutes)} of revision
        </h2>
        <p className="figures text-sm text-muted-foreground">
          {progress.doneCount} of {progress.totalCount} activities &middot; {session.shape.label}
        </p>
      </div>

      <Rule />

      {held.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Held</p>
          <p className="text-sm">{held.map((a) => a.title).join(', ')}</p>
        </div>
      )}

      {shaky.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Needs another pass</p>
          <p className="text-sm">{shaky.map((a) => a.title).join(', ')}</p>
          <p className="text-xs text-muted-foreground">
            Back on the ladder tomorrow — a missed review resets the interval, which is the point of it.
          </p>
        </div>
      )}

      {held.length === 0 && shaky.length === 0 && (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing was graded this sitting, so there is no recall verdict to report — only what you
          worked through.
        </p>
      )}

      {nextUp && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Next</p>
          <p className="text-sm">{'title' in nextUp ? nextUp.title : ''}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onRestart}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Plan another session
        </Button>
        <Button asChild variant="ghost">
          <Link to="/today">Back to today</Link>
        </Button>
      </div>
    </Lead>
  );
}

// Re-exported for the tests that assert the session length labels stay in step with the engine.
export { shapeFor };
