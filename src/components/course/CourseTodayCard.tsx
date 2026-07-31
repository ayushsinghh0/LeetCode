import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeCourseSession } from '@/store/actions';
import { selectCourseNextSession } from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';

// Compact "what's my AI/ML task today" strip for the Today page. Disappears once every core
// session is logged — the /aiml page keeps the completed syllabus and the optional extras.
export function CourseTodayCard() {
  const dispatch = useAppDispatch();
  const next = useAppSelector(selectCourseNextSession);

  if (next === null) return null;
  const week = courseWeekById.get(next.weekId);
  if (!week) return null;

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI/ML · two-day sprint
        </p>
        <p className="mt-0.5 truncate font-medium">
          Week {week.week} — {week.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {next.day === 1 ? 'Day 1 · Lecture' : 'Day 2 · Practice'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/aiml">Open plan</Link>
        </Button>
        <Button size="sm" onClick={() => dispatch(completeCourseSession(next.weekId, next.day))}>
          Mark done
        </Button>
      </div>
    </div>
  );
}
