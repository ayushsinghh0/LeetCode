import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure, Figures, Lead, Meta, Page, PageHeader, PagePair, RuledList, Section } from '@/components/layout/Page';
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

  return (
    <Page>
      {/* The masthead is the masthead everywhere: eyebrow, title, purpose, one action, hairline.
          This page used to wrap the header, the bar and the ledger in its own `gap-6` column with
          `rule={false}`, which made /aiml the only page of eighteen that opened without the rule
          and the only one setting its own vertical step. `Page` owns the section rhythm. */}
      <PageHeader
        eyebrow="100xDevs cohort · two-day sprints"
        title="AI & ML"
        support="One week-module every two days — lecture first, practice the day after."
        action={
          <Button asChild variant="outline">
            <a href={AIML_COURSE_URL} target="_blank" rel="noreferrer">
              100xDevs <ExternalLink />
            </a>
          </Button>
        }
      />

      {/* The page's `Lead` opens the page: a course reader starts at the current lesson, not at
          statistics about it. The landmark label rides on the `Lead` itself — it renders the
          <section> and owns the `gap-4` stack — so the wrapper that existed only to carry the
          aria-label is gone, along with the flex column it re-declared over the plate's own. */}
      <Lead aria-label="Up next">
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

      {/* The two due lists ask the same shape of work of two ladders — a week to re-derive, a
          loop to rebuild — so when both are due they share a `PagePair` at md+ instead of costing
          two full sections of scroll between the lesson and the syllabus. A lone list stays
          full-width on purpose: one child in a two-column grid reads as half a page with nothing
          beside it. */}
      {reviewsDue && rebuildsDue ? (
        <PagePair>
          {reviewsDue}
          {rebuildsDue}
        </PagePair>
      ) : (
        <>
          {reviewsDue}
          {rebuildsDue}
        </>
      )}

      {/* The bar and the figures behind it are one fact, so they stay one group — but the group
          now sits below the lesson and the due work: "how far along am I" is orientation, not the
          point of a course reader, and the old four-figure serif ledger was 94px of it ahead of
          the content. `Figures` states the same counts in the quiet inline voice orientation
          deserves. The ledger's sub-lines are retired, not moved — each restated copy the page
          already prints (the masthead carries the lecture-then-practice cadence and the
          projection's one-week-every-two-days pace; the extras section wears its own "optional"
          badge). */}
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

      {/* The syllabus is the spine of a course reader, so it stays open — but only the part that is
          still ahead of you. 26 rows at 102px is 2,680px, and on a page whose job is "enter the
          material", a week you cleared in March is archive, not material. Cleared weeks move behind
          the same latch the extras use, with their count on the summary; the current week and
          everything after it stay in the open list. Nothing is removed, and the section *shrinks as
          the learner progresses* rather than growing — which is the right direction for a reader
          and the wrong one for the stack this page used to be. */}
      <Section title="Syllabus">
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
          {openWeeks.map((week) => (
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
        </RuledList>
      </Section>

      <Section title="Extra sessions" action={<Badge variant="secondary">optional</Badge>}>
        {/* Five rows nobody visits daily sat open between the syllabus and the ML work, and every
            scroll to the tracks paid for them. The heading and its "optional" badge stay on the
            page; the rows themselves wait behind the latch, with the count on the summary so
            nothing about the section's size is a surprise. */}
        <Disclosure summary="Show the extras" meta={`${EXTRA_WEEKS.length} sessions`}>
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
        </Disclosure>
      </Section>

      <Section
        title="Implement it from scratch"
        support="Each track runs the same five rungs — derive it, write it in numpy, meet the library that already does it, run the two against each other, then learn the ways it breaks."
        action={
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
        }
      >
        <RuledList>
          {ML_TRACKS.map((track) => (
            <MlTrackRow key={track.id} track={track} />
          ))}
        </RuledList>
        {/* One sentence, not an essay: the examples this paragraph used to enumerate live inside
            the tracks themselves, already open on the failure rung. The claim is the keeper.
            The provenance sentence moved down here out of `support`, which is the "why this section
            matters" register — one line the eye can skip. A five-line paragraph in that slot cannot
            be skipped, so it stopped being support and became the first body text of the section. */}
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Every figure in an experiment was measured on a real run (numpy 2.5.2, scikit-learn 1.9.0,
          PyTorch 2.13), so a disagreement with your number means one of you has a bug. The failure
          rung never collapses — it is the part you need at 1am, which is not a moment for a second
          click.
        </p>
      </Section>

      <Section
        title="Ship something measurable"
        support="A project ladder, not a tutorial list: seven tiers, cumulative on purpose, each leading with the dumb model you have to beat."
        action={
          <Meta
            className="text-xs"
            items={[
              <span className="figures">{ML_PROJECTS_IN_ORDER.length} projects</span>,
              <span className="figures">~{totalProjectHours()}h</span>,
            ]}
          />
        }
      >
        {/* The project ladder is the tail of the reader, not its body: fourteen rows at 93px is
            1,503px — a quarter of the page — of a catalogue that is browsed when choosing what to
            build next, not on the way to today's lecture. It goes behind the extras' latch, with
            the tier count and total hours already stated on the section's own `Meta` line above, so
            nothing about its size is a surprise. The syllabus and the tracks stay open: those are
            what the directive means by "current lesson … and implementation". */}
        <Disclosure summary="Show the projects" meta={`${ML_PROJECTS_IN_ORDER.length} projects`}>
          <RuledList>
            {ML_PROJECTS_IN_ORDER.map((project) => (
              <MlProjectRow key={project.id} project={project} />
            ))}
          </RuledList>
        </Disclosure>
        {/* Same trim as the tracks note above: the two blank rows explain themselves in place
            ("No published number exists — you have to establish this one first"), so the footnote
            keeps only the claim that the blanks are deliberate. */}
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          A project without a stated baseline cannot tell you whether anything you built helped. Two
          baselines are deliberately blank: where the number is a property of your own system, the
          row names who has to measure it instead of inventing one.
        </p>
      </Section>

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
    </Page>
  );
}
