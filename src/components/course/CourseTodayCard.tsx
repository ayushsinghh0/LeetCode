import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Section, Meta } from '@/components/layout/Page';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeCourseSession } from '@/store/actions';
import { selectCourseDueReviewIds, selectCourseNextSession } from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';

/**
 * "What is my AI/ML task today" — the other track, on the Today page.
 *
 * The next 2-day-sprint session plus a due-review count once cleared weeks start coming back
 * around. Hidden only when the core course is complete AND nothing is due — the /aiml page keeps
 * the full syllabus.
 *
 * Composition note: this was a solid plate sitting under the lead and reading as its equal. It is
 * a section now — the week is the heading, the sprint day and any due reviews are one `Meta` line
 * describing that same week, and the two controls sit on the ground beneath them. The due-review
 * count also came off the accent ink: a count is not an action, and the One Ink Rule keeps the
 * ink for the things you can press.
 */
export function CourseTodayCard() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const next = useAppSelector(selectCourseNextSession);
  const dueReviewIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));

  if (next === null && dueReviewIds.length === 0) return null;
  const week = next ? courseWeekById.get(next.weekId) : undefined;

  return (
    <Section
      aria-label="AI/ML course"
      eyebrow="AI/ML · two-day sprint"
      title={next && week ? `Week ${week.week} — ${week.title}` : 'Course complete'}
    >
      <Meta
        items={[
          <span key="day">
            {next
              ? next.day === 1
                ? 'Day 1 · Lecture'
                : 'Day 2 · Practice'
              : 'Reviews keep it fresh'}
          </span>,
          dueReviewIds.length > 0 ? (
            <span key="due" className="text-foreground">
              {dueReviewIds.length} week review{dueReviewIds.length === 1 ? '' : 's'} due
            </span>
          ) : null,
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        {next && (
          <Button size="sm" onClick={() => dispatch(completeCourseSession(next.weekId, next.day))}>
            Mark done
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/aiml">Open plan</Link>
        </Button>
      </div>
    </Section>
  );
}
