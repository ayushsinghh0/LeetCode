import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, GraduationCap, RotateCcw, SkipForward, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { NotesEditor } from '@/components/questions/NotesEditor';
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
// Deriving from the ranker fixes all three by construction and keeps them fixed.
type FocusItem =
  | { kind: 'new-question'; question: Question }
  | { kind: 'question-revision'; question: Question }
  | { kind: 'course-session'; week: CourseWeek; day: CourseDay }
  | { kind: 'course-review'; week: CourseWeek };

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

  // The ranker's order, filtered to what this page can actually render. A drill is its own
  // surface and a task is the learner's own note — neither is a studyable unit here, so they are
  // stepped over rather than allowed to block the queue.
  const next = ranked.find(
    (work) =>
      work.kind === 'new-question' ||
      work.kind === 'revision' ||
      work.kind === 'course-session' ||
      work.kind === 'course-review',
  );

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
    // landmark at all. p-4 on phones, not p-6: with the card's own p-6 that is 40px of chrome per
    // side rather than 56px, which is 295px of title measure at 375px instead of 263px.
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex justify-end">
        <Button asChild variant="ghost">
          <Link to="/today">
            <X /> Exit
          </Link>
        </Button>
      </div>

      {item === null ? (
        // No plate: "nothing to do" is not a liftable surface, and boxing it drew a near
        // full-viewport outline around one icon and one sentence (DESIGN.md § Composition).
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-serif text-base text-foreground">All caught up — nothing queued for focus right now.</p>
        </div>
      ) : item.kind === 'new-question' || item.kind === 'question-revision' ? (
        <QuestionFocus
          question={item.question}
          isRevision={item.kind === 'question-revision'}
          notes={(progressById[item.question.id] ?? initialProgress()).notes}
        />
      ) : (
        <CourseFocus
          week={item.week}
          day={item.kind === 'course-session' ? item.day : null}
          notes={(courseByWeekId[item.week.id] ?? initialCourseProgress()).notes}
        />
      )}

      <div className="flex justify-center py-4">
        <PomodoroWidget variant="inline" />
      </div>
    </main>
  );
}

function QuestionFocus({
  question,
  isRevision,
  notes,
}: {
  question: Question;
  isRevision: boolean;
  notes: string;
}) {
  const dispatch = useAppDispatch();
  const pattern = patternById[question.pattern];

  return (
    // This is the page's `Lead` — p-6 md:p-8, the one plate padding reserved for it.
    <div className="glass flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center md:p-8">
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

      <div className="w-full text-left">
        <p className="mb-1 text-sm font-medium">Notes</p>
        {/* key: switching questions must reset the editor's form baseline */}
        <NotesEditor key={question.id} questionId={question.id} initialNotes={notes} />
      </div>
    </div>
  );
}

// A course session (day 1 lecture / day 2 practice) or a due week review, rendered with the
// same shape as the question card so focus mode feels like one continuous session.
function CourseFocus({ week, day, notes }: { week: CourseWeek; day: CourseDay | null; notes: string }) {
  const dispatch = useAppDispatch();
  const isReview = day === null;

  return (
    <div className="glass flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center md:p-8">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        <span>
          {isReview
            ? `AI/ML · Week ${week.week} review`
            : `AI/ML · Week ${week.week} · ${day === 1 ? 'Day 1 — Lecture' : 'Day 2 — Practice'}`}
        </span>
      </div>

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

      <div className="w-full text-left">
        <p className="mb-1 text-sm font-medium">Notes</p>
        {/* key: switching weeks must reset the editor's form baseline */}
        <CourseNotesEditor key={week.id} weekId={week.id} initialNotes={notes} />
      </div>
    </div>
  );
}
