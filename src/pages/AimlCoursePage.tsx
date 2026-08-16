import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO } from 'date-fns';
import { ChevronRight, ExternalLink, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure, Figures, Lead, Meta, Panel, RuledList, Screen, ScreenHeader, Section } from '@/components/layout/Page';
import { CourseResourceChips } from '@/components/course/CourseResourceChips';
import { CourseNotesEditor } from '@/components/course/CourseNotesEditor';
import { CourseRecallList } from '@/components/course/CourseRecallList';
import { recallByWeekId } from '@/data/courseRecall';
import { CourseReviewList } from '@/components/course/CourseReviewList';
import { CourseWeekRow } from '@/components/course/CourseWeekRow';
import { MlProjectRow } from '@/components/course/MlProjectRow';
import { MlTrackRow } from '@/components/course/MlTrackRow';
import { ML_PROJECTS_IN_ORDER, totalProjectHours } from '@/data/mlProjects';
import { ML_TRACKS, totalFailureModes, totalTrackMinutes } from '@/data/mlTracks';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeCourseSession, logCourseRecall } from '@/store/actions';
import {
  selectCourseDueReviewIds,
  selectCourseNextSession,
  selectCourseProjectedFinish,
  selectCourseSchedule,
  selectCourseStats,
  selectMlDueTrackIds,
  selectMlStanding,
} from '@/store/selectors';
import { MlRebuildList } from '@/components/course/MlRebuildList';
import { AIML_COURSE_URL, CORE_WEEKS, EXTRA_WEEKS, courseWeekById, lectureUrl, type CourseWeek } from '@/data/aimlCourse';
import { initialCourseProgress, isWeekDone } from '@/utils/engine/aimlCourse';
import { formatMinutes } from '@/utils/engine/planner';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

/**
 * The AI/ML track: the 100xDevs syllabus, plus the two things a lecture course cannot give you —
 * implementing the algorithms yourself, and shipping projects against a stated baseline.
 *
 * Composition note: this page used to open with a plated header, four StatCards restating the two
 * numbers printed one line above them, and a `p-6` plate wrapped around two lines of text. It is
 * now `PageHeader` + open `Section`s, with exactly one plate — the `Lead` on "Up next", the one
 * thing the page wants you to do — and the `Lead` comes first: a course reader opens on the
 * current lesson, not on statistics about it, so the progress figures ride one `Figures` line
 * below the due work instead of a four-column ledger ahead of everything. The syllabus, extras
 * and the two ML lists are `RuledList`s: their rows rule themselves off with hairlines, so boxing
 * the stack in a plate added nothing but the border.
 */
export default function AimlCoursePage() {
  const today = useToday();
  const dispatch = useAppDispatch();

  const stats = useAppSelector(selectCourseStats);
  const next = useAppSelector(selectCourseNextSession);
  const schedule = useAppSelector((s) => selectCourseSchedule(s, today));
  const finish = useAppSelector((s) => selectCourseProjectedFinish(s, today));
  const dueReviewIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const dueRebuildIds = useAppSelector((s) => selectMlDueTrackIds(s, today));
  const mlTracksById = useAppSelector((s) => s.ml.tracksById);
  const mlStanding = useAppSelector(selectMlStanding);
  // Single subscription to the whole byWeekId map — rows read their own entry out of it,
  // mirroring TodayPage's progressById pattern.
  const byWeekId = useAppSelector((s) => s.course.byWeekId);

  const [notesWeek, setNotesWeek] = useState<CourseWeek | null>(null);
  const [recallWeek, setRecallWeek] = useState<CourseWeek | null>(null);
  // The syllabus fold — same idiom as Today's plan. The sprint is two days wide, so the nearest
  // few modules are the working set; the rest of a 26-module catalogue is one tap away rather
  // than 2,000px down.
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const nextWeek = next ? courseWeekById.get(next.weekId) : undefined;

  // Cleared vs. still-ahead, computed once, on the same `isWeekDone` the row uses for its own
  // done-styling — so the split cannot disagree with how a row presents itself.
  //
  // What the latch DOES cost, stated rather than glossed: a cleared row still carries its
  // "Check yourself" recall button and its notes button, and `clearedLabel` is the only place a
  // week's upcoming `review <date>` appears (the "Review due" section above surfaces only the ones
  // already due). So folding cleared weeks puts the recall entry point — for exactly the weeks
  // recall is for — one click away. That is judged the right trade against 26 rows of archive on a
  // page whose job is to open on the current lesson, but it is a trade, not a free win.
  const clearedWeeks = CORE_WEEKS.filter((w) => isWeekDone(w, byWeekId[w.id] ?? initialCourseProgress()));
  const openWeeks = CORE_WEEKS.filter((w) => !isWeekDone(w, byWeekId[w.id] ?? initialCourseProgress()));
  const notesProgress = notesWeek ? (byWeekId[notesWeek.id] ?? initialCourseProgress()) : null;
  const recallPrompts = recallWeek ? (recallByWeekId[recallWeek.id] ?? []) : [];

  // Both due lists are defined once and arranged twice-over below: beside each other in a
  // `PagePair` when both ladders have work due, full-width alone otherwise. Writing the
  // `Section`s out per arrangement is how the two copies drift apart.
  const reviewsDue = dueReviewIds.length > 0 && (
    <Section
      title="Review due"
      support="Re-derive each week from its slides and your notes, then grade yourself — a fail restarts its ladder."
      action={<Badge variant="secondary">{dueReviewIds.length}</Badge>}
    >
      <CourseReviewList weekIds={dueReviewIds} byWeekId={byWeekId} />
    </Section>
  );

  const rebuildsDue = dueRebuildIds.length > 0 && (
    <Section
      title="Rebuilds due"
      support="Open a blank file and write the core loop again, then say whether it came out. Not &ldquo;do you remember this&rdquo; — anyone can answer yes to that."
      action={<Badge variant="secondary">{dueRebuildIds.length}</Badge>}
    >
      <MlRebuildList trackIds={dueRebuildIds} tracksById={mlTracksById} />
    </Section>
  );

  // The screen's one plate, and the first thing in it: a course reader opens on the current
  // lesson, not on statistics about it. The landmark label rides on the `Lead` itself — it renders
  // the <section> and owns the `gap-4` stack — so the wrapper that existed only to carry the
  // aria-label is gone, along with the flex column it re-declared over the plate's own.
  //
  // Bound to a name rather than written inline because the screen body places it between the
  // header and the tab strip, and a 50-line plate inlined there buries the composition it sits in.
  const upNext = (
      <Lead aria-label="Up next" className="gap-3 p-5 md:p-6">
        {next && nextWeek ? (
          <>
            <div>
              <p className="font-serif text-2xl font-semibold tracking-tight">
                Week {nextWeek.week} — {nextWeek.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {next.day === 1 ? 'Day 1 · Lecture' : 'Day 2 · Practice'}
                </Badge>
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
      </Lead>
  );

  return (
    <Screen>
      {/* No support line — "one module every two days" is what the hero's own Day 1/Day 2 badge
          and finish date already say, and on a ~590px viewport the sentence costs a syllabus row. */}
      <ScreenHeader
        eyebrow="100xDevs cohort · two-day sprints"
        title="AI & ML"
        action={
          <Button asChild variant="outline">
            <a href={AIML_COURSE_URL} target="_blank" rel="noreferrer">
              100xDevs <ExternalLink />
            </a>
          </Button>
        }
      />


      {/* THE THREE ZONES — Today's page-local grid, for the same 1280×~590 machine: the sprint
          plate, the material (tabs), and the standing rail side by side at `xl`; the familiar
          two-column band at `lg`; one priority-ordered column below. DOM order never changes. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* The work column: the current sprint, then the material behind a tab strip.

            This screen was 4,300px — three complete catalogues (26 syllabus weeks, 11 tracks, 14
            projects) rendered head to toe, so "open the course" meant scrolling a document to find
            the lesson. The catalogues are not smaller now and nothing was removed from them; they
            are simply not all on screen at once. A tab is the brief's answer for exactly this
            shape: sibling bodies of material, one of which you are in. The selected list flows at
            its natural height; `main` carries the scroll. */}
        <div className="contents">
          {upNext}

          {/* At `xl` the syllabus takes the WIDE right track and spans both rows, with the
              standing rail tucked under the hero on the left — a catalogue of two-line rows
              needs its width more than a third column needs to exist (three tracks squeezed
              every title into per-word wraps). At `lg` the tabs stay under the hero. */}
          <Tabs defaultValue="syllabus" className="flex min-w-0 flex-col gap-3 lg:col-start-1 xl:col-start-2 xl:row-start-1 xl:row-span-2">
            <TabsList>
              <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
              <TabsTrigger value="implement">Implement</TabsTrigger>
              <TabsTrigger value="ship">Ship</TabsTrigger>
              <TabsTrigger value="extras">Extras</TabsTrigger>
            </TabsList>

            <TabsContent value="syllabus">
              <Panel>
                <h2 className="sr-only">Syllabus</h2>
                {/* Cleared weeks stay behind their own latch inside the tab. A week you finished in
                    March is archive even within the syllabus, and this way the list shrinks as the
                    learner progresses instead of growing. */}
                {clearedWeeks.length > 0 && (
                  <Disclosure summary="Cleared weeks" meta={`${clearedWeeks.length} of ${CORE_WEEKS.length}`}>
                    <RuledList>
                      {clearedWeeks.map((week) => (
                        <CourseWeekRow
                          key={week.id}
                          week={week}
                          progress={byWeekId[week.id] ?? initialCourseProgress()}
                          planned={schedule[week.id]}
                          onOpenNotes={setNotesWeek}
                          onOpenRecall={setRecallWeek}
                        />
                      ))}
                    </RuledList>
                  </Disclosure>
                )}
                <RuledList>
                  {(showAllWeeks || openWeeks.length <= 4 ? openWeeks : openWeeks.slice(0, 3)).map((week) => (
                    <CourseWeekRow
                      key={week.id}
                      week={week}
                      progress={byWeekId[week.id] ?? initialCourseProgress()}
                      planned={schedule[week.id]}
                      isCurrent={next?.weekId === week.id}
                      onOpenNotes={setNotesWeek}
                      onOpenRecall={setRecallWeek}
                    />
                  ))}
                  {!showAllWeeks && openWeeks.length > 4 && (
                    <li>
                      {/* One-way, like the plan's fold: nobody re-hides a syllabus mid-read. */}
                      <button
                        type="button"
                        aria-expanded={false}
                        onClick={() => setShowAllWeeks(true)}
                        className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-primary lg:min-h-9"
                      >
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          Show {openWeeks.length - 3} more modules
                        </span>
                      </button>
                    </li>
                  )}
                </RuledList>
              </Panel>
            </TabsContent>

            <TabsContent value="implement">
              <Panel>
                <h2 className="sr-only">Implement it from scratch</h2>
                <Meta
                  className="text-xs"
                  items={[
                    <span className="figures">{formatMinutes(totalTrackMinutes())}</span>,
                    <span className="figures">{totalFailureModes()} failure modes</span>,
                    mlStanding.rungsDone > 0 && (
                      <span className="figures text-foreground">
                        {mlStanding.rungsDone} of {mlStanding.rungsTotal} rungs done
                      </span>
                    ),
                  ]}
                />
                <RuledList>
                  {ML_TRACKS.map((track) => (
                    <MlTrackRow key={track.id} track={track} />
                  ))}
                </RuledList>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  Five rungs each: derive it, write it in numpy, meet the library, run the two
                  against each other, learn how it breaks. Every experiment figure was measured on a
                  real run (numpy 2.5.2, scikit-learn 1.9.0, PyTorch 2.13), so a disagreement with
                  your number means one of you has a bug. The failure rung never collapses — it is
                  the part you need at 1am, which is not a moment for a second click.
                </p>
              </Panel>
            </TabsContent>

            <TabsContent value="ship">
              <Panel>
                <h2 className="sr-only">Ship something measurable</h2>
                <Meta
                  className="text-xs"
                  items={[
                    <span className="figures">{ML_PROJECTS_IN_ORDER.length} projects</span>,
                    <span className="figures">~{totalProjectHours()}h</span>,
                  ]}
                />
                <RuledList>
                  {ML_PROJECTS_IN_ORDER.map((project) => (
                    <MlProjectRow key={project.id} project={project} />
                  ))}
                </RuledList>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  Seven tiers, cumulative on purpose, each leading with the dumb model you have to
                  beat. A project without a stated baseline cannot tell you whether anything you
                  built helped. Two baselines are deliberately blank: where the number is a property
                  of your own system, the row names who has to measure it instead of inventing one.
                </p>
              </Panel>
            </TabsContent>

            <TabsContent value="extras">
              <Panel>
                <h2 className="sr-only">Extra sessions</h2>
                <RuledList>
                  {EXTRA_WEEKS.map((week) => (
                    <CourseWeekRow
                      key={week.id}
                      week={week}
                      progress={byWeekId[week.id] ?? initialCourseProgress()}
                      onOpenNotes={setNotesWeek}
                      onOpenRecall={setRecallWeek}
                    />
                  ))}
                </RuledList>
                <p className="max-w-prose text-sm text-muted-foreground">
                  Optional single sessions, outside the two-day plan.
                </p>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>

        {/* The rail: where the course stands, and what it is asking of you today. Both due lists
            live here rather than between the lesson and the material — they are work the ladders
            have scheduled, which is context for the sprint, not a third catalogue. */}
        <aside
          aria-label="Course standing"
          className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 xl:col-start-1 xl:row-start-2 xl:row-span-1"
        >
          <Section aria-label="Course progress">
            <Progress value={stats.pct} aria-label="Course completion" />
            <Figures
              items={[
                { value: `${stats.sessionsDone} / ${stats.sessionsTotal}`, label: 'sessions' },
                { value: `${stats.weeksDone} / ${stats.weeksTotal}`, label: 'weeks cleared' },
                finish
                  ? { value: monthDay(finish), label: 'projected finish' }
                  : { value: 'Done', label: 'all sessions logged' },
                { value: `${stats.extrasDone} / ${stats.extrasTotal}`, label: 'optional extras' },
              ]}
            />
          </Section>

          {reviewsDue}
          {rebuildsDue}
        </aside>
      </div>

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

      <Dialog open={recallWeek !== null} onOpenChange={(open) => !open && setRecallWeek(null)}>
        {recallWeek && recallPrompts.length > 0 && (
          <DialogContent className="glass max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Check yourself — {recallWeek.optional ? recallWeek.title : `Week ${recallWeek.week}: ${recallWeek.title}`}
              </DialogTitle>
              <DialogDescription>
                {recallPrompts.length} recall questions on this module's ideas.
              </DialogDescription>
            </DialogHeader>
            <CourseRecallList
              key={recallWeek.id}
              prompts={recallPrompts}
              recordedToday={(byWeekId[recallWeek.id]?.recallChecks ?? {})[today] !== undefined}
              onRecord={(correct, total) => dispatch(logCourseRecall(recallWeek.id, correct, total))}
            />
          </DialogContent>
        )}
      </Dialog>
    </Screen>
  );
}
