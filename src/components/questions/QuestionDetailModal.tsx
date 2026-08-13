import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import questionsData from '@/data/questions.json';
import { patternById } from '@/data/patterns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { RevisionStagePips } from '@/components/questions/RevisionStagePips';
import { NotesEditor } from '@/components/questions/NotesEditor';
import { FamilyPanel } from '@/components/questions/FamilyPanel';
import { HintLadder } from '@/components/questions/HintLadder';
import { PostSolvePanel } from '@/components/questions/PostSolvePanel';
import { QUESTION_TYPE_LABEL } from '@/data/questionTypes';
import { familyById, FAMILY_ROLE_ORDER } from '@/data/curriculum';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { reviseQuestion, skipQuestion, solveQuestion, toggleBookmark } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPaceSamples } from '@/store/selectors';
import { initialProgress, isMastered } from '@/utils/engine/spacedRepetition';
import { hintsFor } from '@/utils/engine/hints';
import { MASTERY_LABEL, MASTERY_MEANING, masteryState } from '@/utils/engine/mastery';
import { BASIS_LABEL, estimateFor } from '@/utils/engine/timeEstimate';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

/**
 * The question, as a learning unit rather than a link.
 *
 * The disclosure order is the pedagogy, and it is the reason this is not one long page:
 *
 *  - Before the attempt the learner sees what the problem tests, how long it should take, and
 *    the problem itself. Nothing here names the algorithm.
 *  - Help is available but must be asked for, one rung at a time, and each ask is recorded.
 *  - The intended complexity and the family's full write-up appear only AFTER the attempt is
 *    resolved. Showing a target bound up front converts a problem into a lookup.
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

  const estimate = estimateFor(question, samples);
  const hints = hintsFor(family);
  const state = masteryState(progress);
  const solved = progress.status === 'solved';
  const revisable = solved && !isMastered(progress);

  // The transfer move: an untouched sibling of the same family, on-ramp order (canonical →
  // warm-up → standard → variant → stretch) rather than authoring order. Skipped questions are
  // excluded for the same reason the daily ranker excludes them — the learner already set them
  // aside, and re-offering one as "your next step" ignores that.
  const sibling = family
    ? ([...family.members]
        .sort((a, b) => FAMILY_ROLE_ORDER.indexOf(a.role) - FAMILY_ROLE_ORDER.indexOf(b.role))
        .filter((m) => m.questionId !== question.id)
        .find((m) => {
          const status = byId[m.questionId]?.status ?? 'unsolved';
          return status !== 'solved' && status !== 'skipped' && questionById.has(m.questionId);
        }) ?? null)
    : null;
  const siblingQuestion = sibling ? questionById.get(sibling.questionId) : undefined;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent key={question.id} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question.title}</DialogTitle>
          <DialogDescription>
            {QUESTION_TYPE_LABEL[question.type]} &middot; {pattern.name} &middot; {question.difficulty}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={question.difficulty} />
          <PatternChip pattern={pattern} />
          <span className="figures inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />~{estimate.typical} min
          </span>
          {/* A personal figure appears only once enough comparable solves exist to support it,
              and always says what it was measured over. */}
          {estimate.personal !== null && (
            <span className="figures text-sm text-muted-foreground">
              &middot; ~{estimate.personal} min at {BASIS_LABEL[estimate.basis!]}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground">{MASTERY_LABEL[state]}</span>
          <span>&middot; {MASTERY_MEANING[state]}</span>
        </div>

        {solved && <RevisionStagePips stage={progress.revisionStage} />}

        {/* What this tests — the one sentence that turns a title into a lesson. Deliberately
            above the fold and deliberately short of the solution. */}
        <div className="rule pt-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">What this tests</p>
          <p className="mt-1 max-w-prose text-sm">{question.tests}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {question.url ? (
            <Button asChild size="sm">
              <a href={question.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Solve on LeetCode
                {question.premium && <span className="ml-1 text-xs opacity-80">· Premium</span>}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Course-exclusive problem — practice it from your course material; no public LeetCode page exists.
            </p>
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

        {/* Help, on request only. Hidden behind a disclosure so the page does not read as though
            the learner is expected to need it. */}
        {!solved && (
          <div className="rule pt-3">
            {hintsOpen || (progress.hintLevelUsed ?? 0) > 0 ? (
              <HintLadder
                questionId={question.id}
                hints={hints}
                revealedLevel={progress.hintLevelUsed ?? 0}
              />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setHintsOpen(true)}>
                Stuck? Open the hint ladder
              </Button>
            )}
          </div>
        )}

        {/* The mutation. On an unsolved question this is the whole decision; on a solved one it
            becomes the recall grade. */}
        <div className="rule flex flex-wrap gap-2 pt-3">
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
          {solved && !revisable && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Mastered — off the review schedule.
            </p>
          )}
        </div>

        {/* Everything below appears only after the attempt is resolved. */}
        {solved && (
          <>
            <div className="rule pt-3">
              <PostSolvePanel
                question={question}
                progress={progress}
                family={family}
                siblingId={siblingQuestion?.id ?? null}
                siblingTitle={siblingQuestion?.title ?? null}
              />
            </div>

            {family && (
              <div className="rule pt-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Same idea, different disguise
                </p>
                <p className="mb-2 max-w-prose text-sm text-muted-foreground">
                  These change the constraint or the objective, not the technique. Recognizing the
                  idea through the disguise is the transferable half of the skill.
                </p>
                <FamilyPanel family={family} currentQuestionId={question.id} />
              </div>
            )}
          </>
        )}

        <div className="rule pt-3">
          <p className="mb-1 text-sm font-medium">Notes</p>
          <NotesEditor questionId={question.id} initialNotes={progress.notes} />
        </div>

        <div className="rule pt-3">
          <p className="mb-2 text-sm font-medium">Revision History</p>
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
      </DialogContent>
    </Dialog>
  );
}
