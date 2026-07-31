import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeCourseSession } from '@/store/actions';
import { selectCourseDueReviewIds, selectCourseNextSession } from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';

// Compact "what's my AI/ML task today" strip for the Today page: the next 2-day-sprint session
// plus a due-review count once cleared weeks start coming back around. Hidden only when the
// core course is complete AND nothing is due — the /aiml page keeps the full syllabus.
export function CourseTodayCard() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const next = useAppSelector(selectCourseNextSession);
  const dueReviewIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));

  if (next === null && dueReviewIds.length === 0) return null;
  const week = next ? courseWeekById.get(next.weekId) : undefined;

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI/ML · two-day sprint
        </p>
        {next && week ? (
          <>
            <p className="mt-0.5 truncate font-medium">
              Week {week.week} — {week.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {next.day === 1 ? 'Day 1 · Lecture' : 'Day 2 · Practice'}
            </p>
          </>
        ) : (
          <p className="mt-0.5 font-medium">Course complete — reviews keep it fresh</p>
        )}
        {dueReviewIds.length > 0 && (
          <p className="mt-0.5 text-xs font-medium text-primary">
            {dueReviewIds.length} week review{dueReviewIds.length === 1 ? '' : 's'} due
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/aiml">Open plan</Link>
        </Button>
        {next && (
          <Button size="sm" onClick={() => dispatch(completeCourseSession(next.weekId, next.day))}>
            Mark done
          </Button>
        )}
      </div>
    </div>
  );
}
