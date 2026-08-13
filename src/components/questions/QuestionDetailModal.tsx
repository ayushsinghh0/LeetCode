import { useState } from 'react';
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
import { Meta, Rule } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { FamilyPanel } from '@/components/questions/FamilyPanel';
import { HintLadder } from '@/components/questions/HintLadder';
import { PostSolvePanel, type NextStep } from '@/components/questions/PostSolvePanel';
import { ResourcePanel, type ResourceGroup, type ResourceLink } from '@/components/questions/ResourcePanel';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_MEANING } from '@/data/questionTypes';
import { familyById, FAMILY_ROLE_LABEL, FAMILY_ROLE_ORDER, SUBPATTERNS } from '@/data/curriculum';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { reviseQuestion, skipQuestion, solveQuestion, toggleBookmark } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPaceSamples } from '@/store/selectors';
import { initialProgress, isMastered } from '@/utils/engine/spacedRepetition';
import { hintsFor } from '@/utils/engine/hints';
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
  const progress = useAppSelector((s) => (activeId !== null ? (s.progress.byId[activeId] ?? initialProgress()) : null));
  const byId = useAppSelector((s) => s.progress.byId);
  const samples = useAppSelector(selectPaceSamples);
  const [hintsOpen, setHintsOpen] = useState(false);

  const question = activeId !== null ? (questionById.get(activeId) ?? null) : null;

  function handleOpenChange(open: boolean) {
    if (!open) {
      dispatch(activeQuestionSet(null));
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
  const revisable = solved && !isMastered(progress);

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

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent key={question.id} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {/* --- The head of the document ------------------------------------------------------ */}
        {/* One labelled group, not four plates: identity, placement, cost and purpose describe a
            single object, and a screen-reader user navigating a dialog this heavy benefits from
            being able to treat the masthead as one landmark. */}
        <DialogHeader role="group" aria-label="Question summary" className="space-y-0 gap-3 text-left">
          <div className="flex flex-col gap-1.5">
            {/* Where this sits in the course: pattern, then the sub-pattern inside it. The
                pattern's ink rides the icon only — labels wear the text token. */}
            <p className="figures flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-8 text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
            </p>
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
            <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">
              What this tests
            </p>
            <DialogDescription className="max-w-prose text-sm leading-relaxed text-foreground">
              {question.tests}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* --- Where this stands ----------------------------------------------------------- */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{MASTERY_LABEL[state]}</span>
              {solved && <RevisionStagePips stage={progress.revisionStage} />}
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">{MASTERY_MEANING[state]}</p>
          </div>

          {/* --- Where to go ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-4">
            <Rule />
            <ResourcePanel question={question} groups={groups} />
          </div>

          {/* --- Help, on request only ------------------------------------------------------ */}
          {!solved && (
            <div className="flex flex-col gap-4">
              <Rule />
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
            </div>
          )}

          {/* --- The mutation. On an unsolved question this is the whole decision; on a solved
                  one it becomes the recall grade. ------------------------------------------- */}
          <div className="flex flex-col gap-4">
            <Rule />
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
            {solved && !revisable && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Mastered — off the review schedule.
              </p>
            )}
          </div>

          {/* --- Everything below appears only after the attempt is resolved. ---------------- */}
          {solved && (
            <>
              <div className="flex flex-col gap-4">
                <Rule />
                <PostSolvePanel question={question} progress={progress} family={family} next={next} />
              </div>

              {family && (
                <div className="flex flex-col gap-4">
                  <Rule />
                  <div className="flex flex-col gap-1">
                    <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Same idea, different disguise
                    </p>
                    <p className="max-w-prose text-sm text-muted-foreground">
                      These keep the technique and move the constraint or the objective. Recognizing
                      the idea through the disguise is the transferable half of the skill.
                    </p>
                  </div>
                  <FamilyPanel family={family} currentQuestionId={question.id} />
                </div>
              )}
            </>
          )}

          {/* --- The learner's own record --------------------------------------------------- */}
          <div className="flex flex-col gap-4">
            <Rule />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Notes</p>
              <NotesEditor questionId={question.id} initialNotes={progress.notes} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Rule />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Revision History</p>
              {progress.revisionHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revisions yet.</p>
              ) : (
                <ul className="space-y-1">
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
