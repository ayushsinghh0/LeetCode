import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { BookOpenCheck, CalendarClock, ExternalLink, GraduationCap, ListChecks, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from '@/components/shared/StatCard';
import { CourseResourceChips } from '@/components/course/CourseResourceChips';
import { CourseNotesEditor } from '@/components/course/CourseNotesEditor';
import { CourseWeekRow } from '@/components/course/CourseWeekRow';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeCourseSession } from '@/store/actions';
import {
  selectCourseNextSession,
  selectCourseProjectedFinish,
  selectCourseSchedule,
  selectCourseStats,
} from '@/store/selectors';
import { AIML_COURSE_URL, CORE_WEEKS, EXTRA_WEEKS, courseWeekById, lectureUrl, type CourseWeek } from '@/data/aimlCourse';
import { initialCourseProgress } from '@/utils/engine/aimlCourse';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

export default function AimlCoursePage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const stats = useAppSelector(selectCourseStats);
  const next = useAppSelector(selectCourseNextSession);
  const schedule = useAppSelector((s) => selectCourseSchedule(s, today));
  const finish = useAppSelector((s) => selectCourseProjectedFinish(s, today));
  // Single subscription to the whole byWeekId map — rows read their own entry out of it,
  // mirroring TodayPage's progressById pattern.
  const byWeekId = useAppSelector((s) => s.course.byWeekId);

  const [notesWeek, setNotesWeek] = useState<CourseWeek | null>(null);

  const nextWeek = next ? courseWeekById.get(next.weekId) : undefined;
  const notesProgress = notesWeek ? (byWeekId[notesWeek.id] ?? initialCourseProgress()) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              100xDevs cohort · two-day sprints
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gradient">AI &amp; ML</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One week-module every two days — lecture first, practice the day after.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={AIML_COURSE_URL} target="_blank" rel="noreferrer">
              100xDevs <ExternalLink />
            </a>
          </Button>
        </div>
        <Progress value={stats.pct} aria-label="Course completion" />
        <p className="figures text-xs text-muted-foreground">
          {stats.sessionsDone} of {stats.sessionsTotal} sessions · {stats.weeksDone} of {stats.weeksTotal} weeks
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sessions" value={`${stats.sessionsDone} / ${stats.sessionsTotal}`} icon={ListChecks} />
        <StatCard label="Weeks cleared" value={`${stats.weeksDone} / ${stats.weeksTotal}`} icon={BookOpenCheck} />
        <StatCard
          label="Projected finish"
          value={finish ? monthDay(finish) : 'Done'}
          icon={CalendarClock}
          accent={finish !== null}
        />
        <StatCard label="Extras" value={`${stats.extrasDone} / ${stats.extrasTotal}`} icon={Sparkles} />
      </div>

      <section className="glass flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Up next</h2>
        {next && nextWeek ? (
          <>
            <div>
              <p className="font-serif text-2xl font-semibold tracking-tight">
                Week {nextWeek.week} — {nextWeek.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{next.day === 1 ? 'Day 1 · Lecture' : 'Day 2 · Practice'}</Badge>
                {finish && (
                  <span className="figures text-xs text-muted-foreground">
                    planned today · finish {monthDay(finish)}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {next.day === 1
                  ? 'Watch the lecture end to end, then skim the slides once.'
                  : 'Work the notebook and resources, then write down what stuck.'}
              </p>
            </div>
            <CourseResourceChips resources={nextWeek.resources} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => dispatch(completeCourseSession(next.weekId, next.day))}>
                Mark session done
              </Button>
              <Button asChild variant="outline">
                <a href={lectureUrl(nextWeek)} target="_blank" rel="noreferrer">
                  Open lecture <ExternalLink />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              Course complete — all {stats.sessionsTotal} sessions logged.
            </p>
            {stats.extrasDone < stats.extrasTotal && (
              <p className="text-sm text-muted-foreground">
                The optional extras below are still open whenever you want them.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Syllabus</h2>
        <div className="glass">
          {CORE_WEEKS.map((week) => (
            <CourseWeekRow
              key={week.id}
              week={week}
              progress={byWeekId[week.id] ?? initialCourseProgress()}
              planned={schedule[week.id]}
              isCurrent={next?.weekId === week.id}
              onOpenNotes={setNotesWeek}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Extra sessions</h2>
          <Badge variant="secondary">optional</Badge>
        </div>
        <div className="glass">
          {EXTRA_WEEKS.map((week) => (
            <CourseWeekRow
              key={week.id}
              week={week}
              progress={byWeekId[week.id] ?? initialCourseProgress()}
              onOpenNotes={setNotesWeek}
            />
          ))}
        </div>
      </section>

      <Dialog open={notesWeek !== null} onOpenChange={(open) => !open && setNotesWeek(null)}>
        {notesWeek && notesProgress && (
          <DialogContent className="glass sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Notes — {notesWeek.optional ? notesWeek.title : `Week ${notesWeek.week}: ${notesWeek.title}`}
              </DialogTitle>
              <DialogDescription>Markdown notes for this module, saved with your progress.</DialogDescription>
            </DialogHeader>
            <CourseNotesEditor key={notesWeek.id} weekId={notesWeek.id} initialNotes={notesProgress.notes} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
