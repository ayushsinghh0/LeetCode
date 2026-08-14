import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Shapes,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { iconByName } from '@/components/shared/iconMap';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eyebrow, Meta, Section } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { Textarea } from '@/components/ui/textarea';
import { FamilyPanel } from '@/components/questions/FamilyPanel';
import { HintLadder } from '@/components/questions/HintLadder';
import { SmallStartFrame } from '@/components/questions/SmallStartFrame';
import { PostSolvePanel, type NextStep } from '@/components/questions/PostSolvePanel';
import { ResourcePanel, type ResourceGroup, type ResourceLink } from '@/components/questions/ResourcePanel';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_MEANING } from '@/data/questionTypes';
import { familyById, FAMILY_ROLE_LABEL, FAMILY_ROLE_ORDER, SUBPATTERNS } from '@/data/curriculum';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { classifyMiss, reviseQuestion, saveMissNote, skipQuestion, solveQuestion, toggleBookmark } from '@/store/actions';
import { activeQuestionSet, smallStartQuestionSet } from '@/store/slices/uiSlice';
import { selectPaceSamples } from '@/store/selectors';
import { initialProgress, isMastered } from '@/utils/engine/spacedRepetition';
import { hintsFor } from '@/utils/engine/hints';
import { MISS_KINDS } from '@/utils/engine/miss';
import { followUpsFor } from '@/utils/engine/interview';
import { companiesNamingPatternTopics } from '@/utils/engine/companies';
import { MASTERY_LABEL, MASTERY_MEANING, masteryState } from '@/utils/engine/mastery';
import { BASIS_LABEL, estimateFor } from '@/utils/engine/timeEstimate';
import type { FamilyRole, ProblemFamily, Question, SubpatternGroup } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

/** Roles that restate the idea rather than bend it — the "same thing again" reading. */
const EXPLORE_ROLES: FamilyRole[] = ['canonical', 'warmup', 'standard'];

/** How many entries a resource group offers. A shortlist is a decision; a full list is a search. */
const GROUP_LIMIT = 3;

/**
 * The question, as a learning object rather than a link.
 *
 * The disclosure order is the pedagogy, and it is the reason this is not one long page:
 *
 *  - Before the attempt the learner sees where this problem sits (pattern → sub-pattern), what
 *    it tests, how long it should take, and where to solve it. Nothing here names the algorithm.
 *  - Help is available but must be asked for, one rung at a time, and each ask is recorded —
 *    recorded as a signal, never priced.
 *  - The intended complexity and the family's full write-up appear only AFTER the attempt is
 *    resolved. Showing a target bound up front converts a problem into a lookup.
 *  - The last two rungs are also post-attempt: the interview follow-up round (derived by
 *    engine/interview.ts, the same function /interview uses) names the axes the intended answer
 *    is weakest on, which is the shape of the answer if shown early; and one line of company
 *    context, which is a claim about the PATTERN and never about this problem — see the gate on
 *    `companiesNamingPatternTopics` and the comment beside the line itself.
 *
 * The head of the document is one conceptual group, not four plates: chapter line, title,
 * metadata on a single interpunct-separated row, then the one sentence saying what is being
 * learned. Those facts describe one object, so they read as one object.
 *
 * Mount once (e.g. in AppShell) — it is a singleton controlled entirely by ui.activeQuestionId.
 */
export function QuestionDetailModal() {
  const dispatch = useAppDispatch();
  const activeId = useAppSelector((s) => s.ui.activeQuestionId);
  const smallStartQuestionId = useAppSelector((s) => s.ui.smallStartQuestionId);
  const progress = useAppSelector((s) => (activeId !== null ? (s.progress.byId[activeId] ?? initialProgress()) : null));
  const byId = useAppSelector((s) => s.progress.byId);
  const samples = useAppSelector(selectPaceSamples);
  const today = useToday();

  // WHICH question the ladder was opened for, not merely whether it is open. The modal does not
  // remount between questions (only DialogContent is keyed), so a plain boolean survived the
  // switch: opening the ladder on one question and then jumping to a sibling via the Explore
  // links landed on the next question with its hints already expanded, skipping the deliberate
  // friction that makes taking a hint a choice.
  const [hintsOpenForId, setHintsOpenForId] = useState<number | null>(null);
  const hintsOpen = hintsOpenForId !== null && hintsOpenForId === activeId;
  const setHintsOpen = (open: boolean) => setHintsOpenForId(open ? activeId : null);

  const question = activeId !== null ? (questionById.get(activeId) ?? null) : null;

  function handleOpenChange(open: boolean) {
    if (!open) {
      dispatch(activeQuestionSet(null));
      // The small-start framing belongs to one visit. Clearing it here — rather than after the
      // solve — means a learner who genuinely stops at two minutes reopens the question later
      // as a normal attempt, with nothing nagging about the last visit.
      dispatch(smallStartQuestionSet(null));
      setHintsOpen(false);
    }
  }

  const pattern = question ? patternById[question.pattern] : null;
  const family = question?.familyId ? familyById[question.familyId] : undefined;

  if (!question || !progress || !pattern) {
    return <Dialog open={false} onOpenChange={handleOpenChange} />;
  }

  const PatternIcon = iconByName(pattern.icon, Shapes);
  const subpattern = subpatternFor(question);
  const estimate = estimateFor(question, samples);
  const hints = hintsFor(family);
  const state = masteryState(progress);
  const solved = progress.status === 'solved';
  // A question graded today is NOT revisable again today: `reviseQuestion` is idempotent per
  // calendar day (a pass schedules days out, a fail reschedules to tomorrow — a second same-day
  // grade is never legitimate), and offering buttons the thunk will refuse is a control that
  // silently does nothing.
  const gradedToday = progress.lastReviewed === today;
  const revisable = solved && !isMastered(progress) && !gradedToday;
  // Was today's grade a fail? The last ladder event is today's when gradedToday, so its verdict
  // is the one just recorded — this drives the post-grade "What tripped it?" capture.
  const lastEvent = progress.revisionHistory[progress.revisionHistory.length - 1];
  const failedToday = gradedToday && lastEvent !== undefined && !lastEvent.passed;

  const untouched = (id: number) => {
    const status = byId[id]?.status ?? 'unsolved';
    // Skipped questions are excluded for the same reason the daily ranker excludes them — the
    // learner already set them aside, and re-offering one ignores that.
    return status !== 'solved' && status !== 'skipped' && questionById.has(id);
  };

  // The family's untouched members in on-ramp order (canonical → warm-up → standard → variant →
  // stretch) rather than authoring order.
  const openSiblings = family
    ? [...family.members]
        .sort((a, b) => FAMILY_ROLE_ORDER.indexOf(a.role) - FAMILY_ROLE_ORDER.indexOf(b.role))
        .filter((m) => m.questionId !== question.id && untouched(m.questionId))
    : [];

  const groups = resourceGroups({ question, family, subpattern, openSiblings, solved, untouched });
  const next = nextStep({ family, subpattern, openSiblings, untouched, currentId: question.id });

  // Both are post-attempt rungs: a follow-up round names the axes the intended solution is weak
  // on, and naming them before the attempt hands over the shape of the answer. Computed only when
  // they will render, so the disclosure rule is enforced here rather than trusted to the JSX.
  const followUps = solved ? followUpsFor(question, family) : [];
  const namingCompanies = solved ? companiesNamingPatternTopics(question.pattern) : [];

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent key={question.id} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {/* --- The two-minute entry frame, when this visit is a small start ------------------- */}
        {/* Above the masthead on purpose: the frame reframes the VISIT (read, name the pattern,
            stopping is complete), so it has to be read before the question is. A marginal-note
            rail, never a plate, and only while the small-start flag points at this exact,
            still-unsolved question — a solved question has nothing to enter small. */}
        {smallStartQuestionId === question.id && !solved && <SmallStartFrame />}

        {/* --- The head of the document ------------------------------------------------------ */}
        {/* One labelled group, not four plates: identity, placement, cost and purpose describe a
            single object, and a screen-reader user navigating a dialog this heavy benefits from
            being able to treat the masthead as one landmark. */}
        <DialogHeader role="group" aria-label="Question summary" className="space-y-0 gap-3 text-left">
          <div className="flex flex-col gap-1.5">
            {/* Where this sits in the course: pattern, then the sub-pattern inside it. The
                pattern's ink rides the icon only — labels wear the text token. */}
            <Eyebrow className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-8">
              <PatternIcon className="h-3.5 w-3.5 shrink-0" style={{ color: pattern.color }} aria-hidden="true" />
              <span>{pattern.name}</span>
              {subpattern && (
                <>
                  <span aria-hidden="true" className="text-border">
                    /
                  </span>
                  <span>{subpattern.name}</span>
                </>
              )}
            </Eyebrow>
            <DialogTitle className="pr-8 font-serif text-2xl font-semibold leading-tight tracking-tight">
              {question.title}
            </DialogTitle>
          </div>

          <Meta
            items={[
              <DifficultyBadge key="difficulty" difficulty={question.difficulty} />,
              // The label alone is not decodable — "Variant" means nothing until you know the
              // taxonomy — so the meaning rides along on hover and for assistive tech.
              <span key="type" title={QUESTION_TYPE_MEANING[question.type]}>
                {QUESTION_TYPE_LABEL[question.type]}
              </span>,
              <span key="estimate" className="figures inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{estimate.typical} min typical
              </span>,
            ]}
          />

          {/* A personal figure appears ONLY once enough comparable measurements exist to support
              it, and always says what it was measured over. An unmeasured estimate is never
              dressed up as a personal one. */}
          {estimate.personal !== null && estimate.basis !== null && (
            <p className="text-sm text-muted-foreground">
              <span className="figures text-foreground">~{estimate.personal} min</span> for you —{' '}
              {BASIS_LABEL[estimate.basis]}, measured over{' '}
              <span className="figures">{estimate.sampleSize}</span> timed solves.
            </p>
          )}

          {/* What this tests — the one sentence that turns a title into a lesson. Deliberately
              above the fold and deliberately short of the solution. It doubles as the dialog's
              accessible description. */}
          <div className="flex flex-col gap-1 pt-1">
            <Eyebrow>What this tests</Eyebrow>
            <DialogDescription className="max-w-prose text-sm leading-relaxed text-foreground">
              {question.tests}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* The blocks below are the document's sections, and they are separated by space and a
            heading register rather than by hairlines. Seven rules used to divide eight
            same-weight bands, which gave the reader no map of a very long scroll; three remain,
            each marking a genuine document break (the decision, the post-attempt half, and the
            learner's own record). `gap-10` is the section step from DESIGN.md § The rhythm — flat
            rather than `md:gap-12`, because this column is capped at 42rem and never widens into
            the desktop measure that bump exists for. */}
        <div className="flex flex-col gap-10">
          {/* --- Where this stands ----------------------------------------------------------- */}
          <Section level={3} title="Where this stands">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{MASTERY_LABEL[state]}</span>
                {solved && <RevisionStagePips stage={progress.revisionStage} />}
              </div>
              <p className="max-w-prose text-sm text-muted-foreground">{MASTERY_MEANING[state]}</p>
            </div>
          </Section>

          {/* --- Where to go ---------------------------------------------------------------- */}
          <Section level={3} title="Where to go">
            <ResourcePanel question={question} groups={groups} />
          </Section>

          {/* --- Help, on request only ------------------------------------------------------ */}
          {!solved && (
            <Section level={3} title="Hints">
              {hintsOpen || (progress.hintLevelUsed ?? 0) > 0 ? (
                <HintLadder
                  questionId={question.id}
                  hints={hints}
                  revealedLevel={progress.hintLevelUsed ?? 0}
                />
              ) : (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setHintsOpen(true)}>
                  Stuck? Open the hint ladder
                </Button>
              )}
            </Section>
          )}

          {/* --- The mutation. On an unsolved question this is the whole decision; on a solved
                  one it becomes the recall grade. Untitled on purpose: a row of labelled buttons
                  names itself, and the hairline above is one of the three real breaks. ------- */}
          <Section divider>
            <div className="flex flex-wrap gap-2">
              {!solved && (
                <>
                  <Button size="sm" onClick={() => dispatch(solveQuestion(question.id))}>
                    <CheckCircle2 /> I solved it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dispatch(skipQuestion(question.id))}>
                    <SkipForward /> Not now
                  </Button>
                </>
              )}
              {revisable && (
                <>
                  <Button size="sm" onClick={() => dispatch(reviseQuestion(question.id, true))}>
                    <CheckCircle2 /> Recalled it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dispatch(reviseQuestion(question.id, false))}>
                    <XCircle /> Needed to look
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant={progress.bookmarked ? 'secondary' : 'outline'}
                onClick={() => dispatch(toggleBookmark(question.id))}
              >
                {progress.bookmarked ? <BookmarkCheck /> : <Bookmark />}
                {progress.bookmarked ? 'Bookmarked' : 'Bookmark'}
              </Button>
            </div>
            {solved && gradedToday && !isMastered(progress) && (
              <div className="flex flex-col gap-3">
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reviewed today
                  {progress.nextRevision
                    ? ` — next review ${format(parseISO(progress.nextRevision), 'MMM d')}.`
                    : '.'}
                </p>
                {/* The reflection read-back and the miss-note capture — POST-GRADE only, so the
                    recall itself stays clean (design record feature D). The debrief lower down
                    remains the capture/edit surface for the reflection; this only reveals it. */}
                <RecallReveal
                  questionId={question.id}
                  reflection={progress.reflection ?? ''}
                  lastMissNote={progress.lastMissNote ?? ''}
                  failedToday={failedToday}
                  missKind={lastEvent?.missKind ?? null}
                />
              </div>
            )}
            {solved && isMastered(progress) && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Mastered — off the review schedule.
              </p>
            )}
          </Section>

          {/* --- Everything below appears only after the attempt is resolved. ---------------- */}
          {solved && (
            <>
              <Section level={3} title="The debrief" divider>
                <PostSolvePanel question={question} progress={progress} family={family} next={next} />
              </Section>

              {family && (
                <Section
                  level={3}
                  title="Same idea, different disguise"
                  support="These keep the technique and move the constraint or the objective. Recognizing the idea through the disguise is the transferable half of the skill."
                >
                  <FamilyPanel family={family} currentQuestionId={question.id} />
                </Section>
              )}

              {/* --- The follow-up round -------------------------------------------------- */}
              {/* Derived by engine/interview.ts from this question's own family, bounds, pattern
                  and type — the same function /interview uses, so the two surfaces cannot drift
                  into asking different things about the same problem. A question with no mapped
                  family genuinely gets a shorter round, and that is said rather than padded. */}
              <Section
                level={3}
                title="If this came up in an interview"
                support="A working solution is where the round starts, not where it ends. These are the moves an interviewer makes next."
                aria-label="Interview follow-ups"
              >
                {followUps.length === 0 ? (
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Nothing in this question&rsquo;s record — no family, no recorded bounds, no
                    pattern that invites one — supports a follow-up worth asking, so none is
                    invented.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {!family && (
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                        A shorter round than usual: this problem sits outside the mapped families,
                        so only the follow-ups its own pattern, type and bounds support are listed.
                      </p>
                    )}
                    {followUps.map((followUp) => (
                      <div key={followUp.axis} className="flex flex-col gap-2">
                        <Eyebrow>{followUp.label}</Eyebrow>
                        <p className="max-w-prose text-sm leading-relaxed">{followUp.question}</p>
                        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                          {followUp.because}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* --- Company context ------------------------------------------------------ */}
              {/* PATTERN RELEVANCE, NEVER PROBLEM ATTRIBUTION. The subject of the sentence is the
                  pattern, and the second clause says outright what is not being claimed. No
                  company publishes the problems it asks (CLAUDE.md; scripts/data/companies.json
                  `_readme`), so this line may never acquire a verb that attaches a company to
                  this question. It is one Meta line for the same reason — a heading and a list
                  would give a footnote the weight of a finding. */}
              {namingCompanies.length > 0 && (
                <Meta
                  items={[
                    <span key="claim">
                      Companies whose own interview pages name topics this pattern covers:{' '}
                      <span className="text-foreground">
                        {namingCompanies.map((c) => c.name).join(', ')}
                      </span>
                    </span>,
                    <span key="scope">a statement about the topic, not about this problem</span>,
                  ]}
                />
              )}
            </>
          )}

          {/* --- The learner's own record --------------------------------------------------- */}
          <Section level={3} title="Notes" divider>
            <NotesEditor questionId={question.id} initialNotes={progress.notes} />
          </Section>

          <Section level={3} title="Revision History">
            {progress.revisionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {progress.revisionHistory.map((ev, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {ev.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-hard" aria-hidden="true" />
                    )}
                    <span className="figures">{format(parseISO(ev.date), 'MMM d, yyyy')}</span>
                    <span>{ev.passed ? 'Passed' : 'Failed'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The post-grade reveal: what the learner wrote when they solved this, and the failure-note
 * channel. Rendered only after a recall is graded (never during it — retrieval stays clean).
 *
 * On a fail it offers the "What tripped it?" one-liner, which converts a miss into information
 * rather than a verdict (design record copy rule 4) — never counted, never priced. On a pass it
 * reads back the note left the last time this tripped the learner, the "shown at next post-grade"
 * half of the loop. The whole subtree remounts with the keyed DialogContent, so its draft state
 * resets per question without manual keying (same reason the reflection editor needs none).
 */
function RecallReveal({
  questionId,
  reflection,
  lastMissNote,
  failedToday,
  missKind,
}: {
  questionId: number;
  reflection: string;
  lastMissNote: string;
  failedToday: boolean;
  /** Today's fail event's one-tap kind, or null — live from the store so the tap reflects. */
  missKind: string | null;
}) {
  const dispatch = useAppDispatch();
  const [note, setNote] = useState(lastMissNote);

  // Autosave on blur, and on unmount if the draft never blurred — the same discipline the
  // reflection editor uses so a note is never lost to closing the dialog.
  const latest = useRef(note);
  latest.current = note;
  const persisted = useRef(lastMissNote);

  function save() {
    if (latest.current.trim() === persisted.current.trim()) return;
    persisted.current = latest.current;
    dispatch(saveMissNote(questionId, latest.current));
  }
  useEffect(() => {
    const id = questionId;
    return () => {
      if (latest.current.trim() !== persisted.current.trim()) dispatch(saveMissNote(id, latest.current));
    };
  }, [dispatch, questionId]);

  return (
    <div className="flex flex-col gap-3">
      {reflection.trim() !== '' && (
        <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
          <Eyebrow>When you solved this, you wrote</Eyebrow>
          <p className="max-w-prose text-sm text-muted-foreground">{reflection}</p>
        </div>
      )}

      {failedToday ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`miss-note-${questionId}`} className="text-sm font-medium">
            What tripped it?
          </label>
          <p className="text-xs text-muted-foreground">
            Optional, and never counted against you — a note to yourself that turns the miss into
            something to watch for next time.
          </p>
          {/* V7: the one-tap kind. Same optionality as the note — tap what you are sure of,
              tap again to retract, or leave it untagged. Attaches to today's fail event only. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {MISS_KINDS.map(({ kind, label }) => (
              <Button
                key={kind}
                size="sm"
                variant={missKind === kind ? 'secondary' : 'ghost'}
                aria-pressed={missKind === kind}
                onClick={() => dispatch(classifyMiss(questionId, missKind === kind ? null : kind))}
              >
                {label}
              </Button>
            ))}
          </div>
          <Textarea
            id={`miss-note-${questionId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={save}
            rows={2}
            placeholder="The exact assumption that broke…"
          />
        </div>
      ) : (
        lastMissNote.trim() !== '' && (
          <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
            <Eyebrow>What tripped you last time</Eyebrow>
            <p className="max-w-prose text-sm text-muted-foreground">{lastMissNote}</p>
          </div>
        )
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Derivations                                                                                    */
/* --------------------------------------------------------------------------------------------- */

/** The sub-pattern group this question belongs to, or undefined. Sub-patterns are pattern-pure. */
function subpatternFor(question: Question): SubpatternGroup | undefined {
  if (!question.subpattern) return undefined;
  return (SUBPATTERNS[question.pattern] ?? []).find((g) => g.id === question.subpattern);
}

function toLink(id: number): ResourceLink | null {
  const q = questionById.get(id);
  return q ? { id: q.id, title: q.title, difficulty: q.difficulty } : null;
}

function isLink(v: ResourceLink | null): v is ResourceLink {
  return v !== null;
}

/**
 * The Explore / Practice groups beneath "Solve".
 *
 * Two rules encoded here. First, the family-derived groups are withheld once the attempt is
 * resolved: the family mini-course further down then becomes the authoritative map of exactly
 * those problems, and two lists of the same titles on one screen is the pile-of-components
 * failure this surface exists to undo. Second, a question with no mapped family falls back to
 * its sub-pattern for Practice rather than showing nothing — the sub-pattern is a weaker claim
 * ("same machinery") than the family ("same idea"), and the reason line says so.
 */
function resourceGroups({
  question,
  family,
  subpattern,
  openSiblings,
  solved,
  untouched,
}: {
  question: Question;
  family: ProblemFamily | undefined;
  subpattern: SubpatternGroup | undefined;
  openSiblings: { questionId: number; role: FamilyRole }[];
  solved: boolean;
  untouched: (id: number) => boolean;
}): ResourceGroup[] {
  const groups: ResourceGroup[] = [];

  if (family && !solved) {
    const explore = openSiblings
      .filter((m) => EXPLORE_ROLES.includes(m.role))
      .slice(0, GROUP_LIMIT)
      .map((m) => toLink(m.questionId))
      .filter(isLink);
    if (explore.length > 0) {
      groups.push({
        label: 'Explore',
        reason:
          'The same underlying technique, stated differently. Meeting an idea twice is what turns it from a solution you remember into one you can reach for.',
        items: explore,
      });
    }

    const practice = openSiblings
      .filter((m) => !EXPLORE_ROLES.includes(m.role))
      .slice(0, GROUP_LIMIT)
      .map((m) => toLink(m.questionId))
      .filter(isLink);
    if (practice.length > 0) {
      groups.push({
        label: 'Practice',
        reason:
          'Variants of this idea: one constraint or objective moved, which is usually enough to break the standard answer.',
        items: practice,
      });
    }
  }

  if (!family && subpattern) {
    const practice = subpattern.questionIds
      .filter((id) => id !== question.id && untouched(id))
      .slice(0, GROUP_LIMIT)
      .map(toLink)
      .filter(isLink);
    if (practice.length > 0) {
      groups.push({
        label: 'Practice',
        reason: `This one is not mapped to a problem family, so these are its sub-pattern neighbours — “${subpattern.name}” runs on the same machinery, which is a weaker claim than sharing an idea.`,
        items: practice,
      });
    }
  }

  return groups;
}

/**
 * The single post-solve recommendation.
 *
 * Deliberately narrow: this answers "what should I do about THIS idea next", not "what should I
 * do today" — the day's ranking has exactly one owner (engine/nextAction.ts) and this is not a
 * second one. The family sibling is preferred because transfer is the point; the sub-pattern
 * neighbour is the honest fallback, and its reason says which claim is being made.
 */
function nextStep({
  family,
  subpattern,
  openSiblings,
  untouched,
  currentId,
}: {
  family: ProblemFamily | undefined;
  subpattern: SubpatternGroup | undefined;
  openSiblings: { questionId: number; role: FamilyRole }[];
  untouched: (id: number) => boolean;
  currentId: number;
}): NextStep | null {
  const sibling = openSiblings[0];
  if (family && sibling) {
    const q = questionById.get(sibling.questionId);
    if (q) {
      return {
        id: q.id,
        title: q.title,
        reason: `The ${(FAMILY_ROLE_LABEL[sibling.role] ?? sibling.role).toLowerCase()} of “${family.name}” — same technique, moved constraint. Solving the idea a second time in a new disguise is what makes it transfer.`,
      };
    }
  }

  if (!family && subpattern) {
    const id = subpattern.questionIds.find((qid) => qid !== currentId && untouched(qid));
    const q = id !== undefined ? questionById.get(id) : undefined;
    if (q) {
      return {
        id: q.id,
        title: q.title,
        reason: `Another “${subpattern.name}” problem — the same machinery on a new statement, while the move you just made is still fresh.`,
      };
    }
  }

  return null;
}
