import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Hourglass,
  RotateCcw,
  SkipForward,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow, Lead, Page } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { SmallStartFrame } from '@/components/questions/SmallStartFrame';
import { CourseNotesEditor } from '@/components/course/CourseNotesEditor';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { patternById } from '@/data/patterns';
import { courseWeekById, type CourseWeek } from '@/data/aimlCourse';
import { useToday } from '@/hooks/useToday';
import { useRouteTitle } from '@/hooks/useRouteTitle';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  completeCourseSession,
  reviseCourseWeek,
  reviseQuestion,
  setConfidence,
  skipQuestion,
  solveQuestion,
} from '@/store/actions';
import { focusQuestionSet } from '@/store/slices/uiSlice';
import {
  selectCourseNextSession,
  selectQuestionById,
  selectRankedWork,
} from '@/store/selectors';
import { buildSession, buildSmallStart, type ActionKind, type WorkItem } from '@/utils/engine/nextAction';
import { formatMinutes } from '@/utils/engine/planner';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { initialCourseProgress, type CourseDay } from '@/utils/engine/aimlCourse';
import type { Question } from '@/types';

// One studyable unit at a time — the whole point of focus mode. WHICH unit is not this page's
// decision: it is `selectRankedWork`, the product's one prioritizer, exactly as Today's hero and
// session plan use it. This page used to assemble its own queue (today's questions → revisions →
// course session → course review), which broke three separate contracts at once:
//
//   - it inverted the ranking principle (retention outranks acquisition), so Today's hero could
//     say "revise this" while the Focus button directly beneath it opened an unsolved question;
//   - it read `selectTodaysNewQuestions` raw, without the `perDay - solvedToday` cap, so
//     finishing the day advanced `currentDay` and Focus immediately served question 9, then 10,
//     forever — the treadmill with no completion moment that cap exists to close;
//   - it read `selectCourseNextSession` without the done-today gate, so "Session done" re-rendered
//     the NEXT session instantly and all 52 sessions could be cleared in one sitting for 2340 XP.
//
// Deriving from the ranker fixed all three by construction — but it stopped one step short of the
// contract it was written for. The ranker answers "in what order", and Today asks it a second
// question on top: "and how much of that fits the time I have", via `buildSession(capacityMin, …)`.
// Focus skipped that step, so under a 15-minute budget Today printed "nothing fits 15m" while the
// Focus button on that same page opened a 60-minute course session. Same list, same packer, same
// `settings.dailyCapacityMin` — a hero and a plan that disagree is precisely the failure this
// design exists to prevent, and the budget is part of the plan.
type FocusItem =
  | { kind: 'new-question'; question: Question }
  | { kind: 'question-revision'; question: Question }
  | { kind: 'course-session'; week: CourseWeek; day: CourseDay }
  | { kind: 'course-review'; week: CourseWeek };

// A drill is its own surface and a task is the learner's own note — neither is a studyable unit
// here, so they are stepped over rather than allowed to block the queue.
const STUDYABLE: ReadonlySet<ActionKind> = new Set<ActionKind>([
  'new-question',
  'revision',
  'course-session',
  'course-review',
]);

const isStudyable = (work: WorkItem): boolean => STUDYABLE.has(work.kind);

// Distraction-free session view — /focus is routed outside AppShell (see src/App.tsx), so this
// renders with no sidebar/nav chrome at all.
export default function FocusPage() {
  // /focus renders outside AppShell (no chrome), so it names its own tab.
  useRouteTitle('Focus');
  const today = useToday();

  const progressById = useAppSelector((s) => s.progress.byId);
  const courseByWeekId = useAppSelector((s) => s.course.byWeekId);
  const ranked = useAppSelector((s) => selectRankedWork(s, today));
  const courseNext = useAppSelector(selectCourseNextSession);
  // The one time budget — the same number the Today capacity chips, the Revision length chooser
  // and the Settings field all write.
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);

  // The exact call SessionPlan makes, on the exact list it makes it on. Focus opens the first
  // thing in Today's plan that it can render; it can therefore never offer work Today has already
  // said does not fit.
  const session = useMemo(() => buildSession(capacityMin, ranked), [capacityMin, ranked]);

  // ?entry=small — the five-minute re-entry from the return notice. Small mode swaps the packed
  // plan for exactly ONE item, chosen by `buildSmallStart` over the same ranked list the plan is
  // packed from — the one prioritizer, minus the budget. Minus it on purpose: the small start is
  // an entry, not a budget, so the capacity pack is not consulted and no counter of any kind
  // (pomodoro included) appears until the learner chooses to keep going.
  const [searchParams, setSearchParams] = useSearchParams();
  const smallEntry = searchParams.get('entry') === 'small';
  const smallItem = smallEntry ? buildSmallStart(ranked) : null;

  // The id the small visit opened on. The moment any action advances that item — solved, graded,
  // even skipped — the ranked list recomputes and this id no longer leads it, which is the
  // signal to stop rather than serve the next item: the visit promised one thing, and honoring
  // the stop is what makes the promise trustworthy. (Same render-time reset idiom as
  // NextActionCard's declined-offset.)
  const [smallStartedId, setSmallStartedId] = useState<string | null>(null);
  if (smallEntry && smallItem !== null && smallStartedId === null) {
    setSmallStartedId(smallItem.id);
  }
  const smallDone = smallEntry && smallStartedId !== null && smallItem?.id !== smallStartedId;

  const next = smallEntry ? (smallDone ? undefined : (smallItem ?? undefined)) : session.items.find(isStudyable);
  // What the budget pushed out, so an empty screen can say which of the two reasons it is
  // empty for. "All caught up" when six hours of work is queued behind a 15-minute window is a
  // surface that lies about the state of the plan. Small mode has no budget, so it can never be
  // empty for that reason.
  const overBudget = smallEntry ? [] : session.skipped.filter(isStudyable);
  const shortestOverBudgetMin =
    overBudget.length > 0 ? Math.min(...overBudget.map((work) => work.minutes)) : null;

  const item: FocusItem | null = useMemo(() => {
    if (!next) return null;
    if (next.kind === 'new-question' || next.kind === 'revision') {
      const question = next.questionId !== undefined ? selectQuestionById(next.questionId) : undefined;
      if (!question) return null;
      return next.kind === 'new-question'
        ? { kind: 'new-question', question }
        : { kind: 'question-revision', question };
    }
    const week = next.weekId !== undefined ? courseWeekById.get(next.weekId) : undefined;
    if (!week) return null;
    if (next.kind === 'course-review') return { kind: 'course-review', week };
    // The ranker decided a session is due today; `courseNext` supplies which day of the week it
    // is (the ranker carries the week, not the day). They agree by construction — the ranker's
    // own session entry is built from this same selector — but the guard keeps the page honest
    // if that ever changes.
    return courseNext && courseNext.weekId === week.id
      ? { kind: 'course-session', week, day: courseNext.day }
      : null;
  }, [next, courseNext]);

  // Keep ui.focusQuestionId pointing at the question on screen so a completing pomodoro phase
  // attributes its minutes to the right place — see logFocusSession in store/actions.ts.
  //
  // NEW questions only. `timeSpentMin` is the measurement `engine/timeEstimate.ts` reads as pace
  // against the authored FIRST-ATTEMPT estimate; crediting revision minutes to it inflated the
  // ratio without bound (a 15-minute question revised twice under the timer read 75 minutes) and
  // the app then quoted that number back as "your pace on this pattern". Total time is unaffected
  // — DayLog.focusMinutes still counts every minute, which is the ledger that owns them.
  const dispatch = useAppDispatch();
  const focusQuestionId = item && item.kind === 'new-question' ? item.question.id : null;
  useEffect(() => {
    dispatch(focusQuestionSet(focusQuestionId));
    return () => {
      dispatch(focusQuestionSet(null));
    };
  }, [dispatch, focusQuestionId]);

  return (
    // /focus has no AppShell, so it carries its own `main` landmark — otherwise the page has no
    // landmark at all — and its own gutter, which is the shell's exactly (px-4 / md:px-8) so the
    // column lines up with the other seventeen pages rather than starting at its own margin.
    // `Page` then supplies the measure and the one section rhythm; this page does not set either.
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <Page width="reading">
        <div className="flex justify-end">
          <Button asChild variant="ghost">
            <Link to="/today">
              <X /> Exit
            </Link>
          </Button>
        </div>

        {smallDone ? (
          <SmallStartInterstitial onKeepGoing={() => setSearchParams({}, { replace: true })} />
        ) : item === null ? (
          <FocusEmpty capacityMin={capacityMin} shortestOverBudgetMin={shortestOverBudgetMin} />
        ) : item.kind === 'new-question' || item.kind === 'question-revision' ? (
          <QuestionFocus
            question={item.question}
            isRevision={item.kind === 'question-revision'}
            notes={(progressById[item.question.id] ?? initialProgress()).notes}
            smallStart={smallEntry && item.kind === 'new-question'}
          />
        ) : (
          <CourseFocus
            week={item.week}
            day={item.kind === 'course-session' ? item.day : null}
            notes={(courseByWeekId[item.week.id] ?? initialCourseProgress()).notes}
          />
        )}

        {/* No timer in small mode: five minutes is an entry, not a budget, and a countdown would
            turn the visit into the race it exists not to be. "Keep going" restores it. */}
        {!smallEntry && (
          <div className="flex justify-center">
            <PomodoroWidget variant="inline" />
          </div>
        )}
      </Page>
    </main>
  );
}

/**
 * Two ways for this screen to be empty, and they are not the same news.
 *
 * No plate on either: "nothing to do" is not a liftable surface, and boxing it drew a near
 * full-viewport outline around one icon and one sentence (DESIGN.md § Composition).
 */
function FocusEmpty({
  capacityMin,
  shortestOverBudgetMin,
}: {
  capacityMin: number;
  shortestOverBudgetMin: number | null;
}) {
  if (shortestOverBudgetMin !== null) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Hourglass className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
        <p className="font-serif text-base text-foreground">
          Nothing here fits {formatMinutes(capacityMin)}.
        </p>
        <p className="max-w-prose text-sm">
          The shortest thing queued for focus is ~{formatMinutes(shortestOverBudgetMin)}. Set a
          longer window on Today, or come back when you have one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
      <CheckCircle2 className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-serif text-base text-foreground">All caught up — nothing queued for focus right now.</p>
    </div>
  );
}

/**
 * Shown once the small visit's one item is done — in place of the next item, never before it.
 *
 * The next item is deliberately withheld: the five-minute re-entry promised exactly one thing,
 * and serving a second the moment the first lands would make the promise a bait. Both exits are
 * stated as equals and neither is decorated — no tally of what was done, no preview of what is
 * left, no plate (the same quiet register as the empty states). "Keep going" simply drops the
 * small framing and lets the normal focus flow take over.
 */
function SmallStartInterstitial({ onKeepGoing }: { onKeepGoing: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
      <p className="font-serif text-base text-foreground">That was the return.</p>
      <p className="max-w-prose text-sm">
        Continue if you want to — stopping here is also a finished visit.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onKeepGoing}>
          Keep going
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/today">Done for today</Link>
        </Button>
      </div>
    </div>
  );
}

function QuestionFocus({
  question,
  isRevision,
  notes,
  smallStart = false,
}: {
  question: Question;
  isRevision: boolean;
  notes: string;
  /** Small-mode framing for a first attempt: the two-minute entry frame above the actions. */
  smallStart?: boolean;
}) {
  const dispatch = useAppDispatch();
  const pattern = patternById[question.pattern];

  return (
    // The page's one plate. `Lead` owns the p-6 md:p-8 reserved for it — spelling those out here
    // meant a change to the lead register silently skipped focus mode, which is the only surface
    // in the product where the lead is the entire screen.
    //
    // Height is the content's, not the viewport's: the old `flex-1` inside a `min-h-screen`
    // column stretched this into a ~750px bordered box holding a title, three buttons and a
    // textarea — the largest empty rectangle in the app.
    <Lead className="flex flex-col items-center gap-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        {pattern && <PatternChip pattern={pattern} />}
      </div>

      {/* The page-title register (DESIGN.md § Composition), not the 2.25/3rem display size: at
          375px the measure here is 295px, and the longest title in the dataset is 57 characters. */}
      <h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        {question.title}
      </h1>

      {/* Focus mode is where the solving happens — the verified problem link sits right under
          the title, before the grading actions. */}
      {question.url && (
        <Button asChild variant="outline" size="sm">
          <a href={question.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Open on LeetCode
            {question.premium && <span className="ml-1 text-xs opacity-80">· Premium</span>}
          </a>
        </Button>
      )}

      {/* The same frame the question sheet shows for a two-minute start — one copy source
          (SmallStartFrame), so the two surfaces cannot drift. Above the actions: it reframes the
          visit, so it must be read before the attempt is graded. */}
      {smallStart && !isRevision && <SmallStartFrame className="w-full" />}

      <div className="flex flex-wrap justify-center gap-2">
        {isRevision ? (
          <>
            <Button onClick={() => dispatch(reviseQuestion(question.id, true))}>
              <CheckCircle2 /> Pass
            </Button>
            <Button variant="outline" onClick={() => dispatch(reviseQuestion(question.id, false))}>
              <XCircle /> Fail
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => dispatch(solveQuestion(question.id))}>
              <CheckCircle2 /> Solved
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                dispatch(solveQuestion(question.id));
                dispatch(setConfidence(question.id, 2));
              }}
            >
              <RotateCcw /> Need Revision
            </Button>
            <Button variant="ghost" onClick={() => dispatch(skipQuestion(question.id))}>
              <SkipForward /> Skip
            </Button>
          </>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 text-left">
        <p className="text-sm font-medium">Notes</p>
        {/* key: switching questions must reset the editor's form baseline */}
        <NotesEditor key={question.id} questionId={question.id} initialNotes={notes} />
      </div>
    </Lead>
  );
}

// A course session (day 1 lecture / day 2 practice) or a due week review, rendered with the
// same shape as the question card so focus mode feels like one continuous session.
function CourseFocus({ week, day, notes }: { week: CourseWeek; day: CourseDay | null; notes: string }) {
  const dispatch = useAppDispatch();
  const isReview = day === null;

  return (
    <Lead className="flex flex-col items-center gap-4 text-center">
      {/* The shared eyebrow register — this line used to run `tracking-wide` with no `.figures`,
          so the identical context line rendered differently here than on every other surface. */}
      <Eyebrow className="flex flex-wrap items-center justify-center gap-2">
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        <span>
          {isReview
            ? `AI/ML · Week ${week.week} review`
            : `AI/ML · Week ${week.week} · ${day === 1 ? 'Day 1 — Lecture' : 'Day 2 — Practice'}`}
        </span>
      </Eyebrow>

      <h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        {week.title}
      </h1>

      <div className="flex flex-wrap justify-center gap-2">
        {isReview ? (
          <>
            <Button onClick={() => dispatch(reviseCourseWeek(week.id, true))}>
              <CheckCircle2 /> Pass
            </Button>
            <Button variant="outline" onClick={() => dispatch(reviseCourseWeek(week.id, false))}>
              <XCircle /> Fail
            </Button>
          </>
        ) : (
          day !== null && (
            <Button onClick={() => dispatch(completeCourseSession(week.id, day))}>
              <CheckCircle2 /> Session done
            </Button>
          )
        )}
      </div>

      <div className="flex w-full flex-col gap-2 text-left">
        <p className="text-sm font-medium">Notes</p>
        {/* key: switching weeks must reset the editor's form baseline */}
        <CourseNotesEditor key={week.id} weekId={week.id} initialNotes={notes} />
      </div>
    </Lead>
  );
}
