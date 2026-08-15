import { format, parseISO } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch } from '@/store/hooks';
import { reviseCourseWeek } from '@/store/actions';
import { courseWeekById } from '@/data/aimlCourse';
import { initialCourseProgress } from '@/utils/engine/aimlCourse';
import type { CourseWeekProgress } from '@/types';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

interface CourseReviewListProps {
  weekIds: string[];
  byWeekId: Record<string, CourseWeekProgress>;
}

// Due course-week reviews with Pass/Fail grading — the one rendering of this list, shared by
// /aiml ("Review due") and /revision ("Due Today") so the two surfaces can never drift.
export function CourseReviewList({ weekIds, byWeekId }: CourseReviewListProps) {
  const dispatch = useAppDispatch();

  return (
    <ul className="list-none">
      {weekIds.map((weekId) => {
        const week = courseWeekById.get(weekId);
        if (!week) return null;
        const progress = byWeekId[weekId] ?? initialCourseProgress();
        return (
          <li
            key={weekId}
            className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">
                Week {week.week} — {week.title}
              </p>
              <p className="figures text-xs text-muted-foreground">
                stage {progress.revisionStage} of 5
                {progress.nextRevision && ` · due ${monthDay(progress.nextRevision)}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                aria-label={`Pass Week ${week.week} review`}
                onClick={() => dispatch(reviseCourseWeek(weekId, true))}
              >
                <CheckCircle2 /> Pass
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Fail Week ${week.week} review`}
                onClick={() => dispatch(reviseCourseWeek(weekId, false))}
              >
                <XCircle /> Fail
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
