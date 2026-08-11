import { Link } from 'react-router-dom';
import { CheckCircle2, GraduationCap, RotateCcw, SkipForward, X, XCircle } from 'lucide-react';
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
import {
  selectCourseDueReviewIds,
  selectCourseNextSession,
  selectQuestionById,
  selectRevisionQueueIds,
  selectTodaysNewQuestions,
} from '@/store/selectors';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { initialCourseProgress, type CourseDay } from '@/utils/engine/aimlCourse';
import type { Question } from '@/types';

// One studyable unit at a time — the whole point of focus mode. Sources drain in the same order
// each track presents its own work (new before revision, session before review), DSA first:
//   1. today's next unsolved (and unskipped) question
//   2. the first due question revision
//   3. the next AI/ML course session
//   4. the first due course week review
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

  const todaysQuestions = useAppSelector(selectTodaysNewQuestions);
  const progressById = useAppSelector((s) => s.progress.byId);
  const courseByWeekId = useAppSelector((s) => s.course.byWeekId);
  const revisionIds = useAppSelector((s) => selectRevisionQueueIds(s, today));
  const courseNext = useAppSelector(selectCourseNextSession);
  const courseDueReviewIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));

  // 'skipped' is excluded (unlike the Today grid, which shows every card): Skip here must
  // visibly advance to the next item, not re-present the same question forever.
  const currentNew = todaysQuestions.find((q) => {
    const status = progressById[q.id]?.status ?? 'unsolved';
    return status !== 'solved' && status !== 'skipped';
  });
  const dueRevision = revisionIds.length > 0 ? selectQuestionById(revisionIds[0]) : undefined;
  const nextSessionWeek = courseNext ? courseWeekById.get(courseNext.weekId) : undefined;
  const dueReviewWeek = courseDueReviewIds.length > 0 ? courseWeekById.get(courseDueReviewIds[0]) : undefined;

  const item: FocusItem | null = currentNew
    ? { kind: 'new-question', question: currentNew }
    : dueRevision
      ? { kind: 'question-revision', question: dueRevision }
      : courseNext && nextSessionWeek
        ? { kind: 'course-session', week: nextSessionWeek, day: courseNext.day }
        : dueReviewWeek
          ? { kind: 'course-review', week: dueReviewWeek }
          : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex justify-end">
        <Button asChild variant="ghost">
          <Link to="/today">
            <X /> Exit
          </Link>
        </Button>
      </div>

      {item === null ? (
        <div className="glass flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
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
    </div>
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
    <div className="glass flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center md:p-12">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        {pattern && <PatternChip pattern={pattern} />}
      </div>

      <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        {question.title}
      </h1>

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
    <div className="glass flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center md:p-12">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        <span>
          {isReview
            ? `AI/ML · Week ${week.week} review`
            : `AI/ML · Week ${week.week} · ${day === 1 ? 'Day 1 — Lecture' : 'Day 2 — Practice'}`}
        </span>
      </div>

      <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
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
