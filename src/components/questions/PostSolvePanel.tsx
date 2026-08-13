import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { patternById } from '@/data/patterns';
import { useAppDispatch } from '@/store/hooks';
import { saveReflection, setConfidence } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { HINT_USE_LABEL, hintUse } from '@/utils/engine/hints';
import { format, parseISO } from 'date-fns';
import type { ProblemFamily, Question, QuestionProgress } from '@/types';

/**
 * What happens after "Solved".
 *
 * The moment a problem clicks is the cheapest time to record why it clicked and the most
 * expensive time to lose it. So this panel does three things and stops: it names what was
 * actually practiced, it asks one open question, and it points at exactly one sensible next
 * step. It does not congratulate at length, and it does not dump the learner back into a list.
 *
 * The "next" suggestion is an unsolved sibling from the same family — the transfer move. Solving
 * one problem teaches the problem; solving its disguised twin teaches the idea.
 */
export function PostSolvePanel({
  question,
  progress,
  family,
  siblingId,
  siblingTitle,
}: {
  question: Question;
  progress: QuestionProgress;
  family: ProblemFamily | undefined;
  siblingId: number | null;
  siblingTitle: string | null;
}) {
  const dispatch = useAppDispatch();
  const [reflection, setReflection] = useState(progress.reflection ?? '');
  const [saved, setSaved] = useState(false);

  const pattern = patternById[question.pattern];
  const use = hintUse(progress.hintLevelUsed);

  function handleSave() {
    if (reflection === (progress.reflection ?? '')) {
      setSaved(true);
      return;
    }
    dispatch(saveReflection(question.id, reflection));
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">What you practiced</p>
        <ul className="mt-2 space-y-1.5">
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-easy" aria-hidden="true" />
            <span>Recognizing {pattern.name.toLowerCase()} from the problem statement.</span>
          </li>
          {family && (
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-easy" aria-hidden="true" />
              <span>Holding the invariant behind &ldquo;{family.name}&rdquo;.</span>
            </li>
          )}
          {question.complexity && (
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-easy" aria-hidden="true" />
              <span className="figures">
                {question.complexity.time} time, {question.complexity.space} space.
              </span>
            </li>
          )}
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-easy" aria-hidden="true" />
            <span>{HINT_USE_LABEL[use]}.</span>
          </li>
        </ul>
      </div>

      <div>
        <label htmlFor={`reflection-${question.id}`} className="text-sm font-medium">
          What did you learn?
        </label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          One line is enough. You will read it again when this comes back for review.
        </p>
        {/* Autosaves on blur, matching the notes editor on this same dialog. Save-on-click-only
            meant Escape, a backdrop click, or the sibling button silently discarded whatever had
            just been typed — two text fields on one dialog with two different save models, one
            of which loses data. */}
        <Textarea
          id={`reflection-${question.id}`}
          value={reflection}
          onChange={(e) => {
            setReflection(e.target.value);
            setSaved(false);
          }}
          onBlur={handleSave}
          rows={2}
          placeholder="The bit that made it click…"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saved}>
            {saved ? 'Saved' : 'Save'}
          </Button>
          {progress.completedAt && (
            <span className="figures text-xs text-muted-foreground">
              Solved {format(parseISO(progress.completedAt), 'MMM d')}
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">How confident are you?</p>
        <ConfidenceRating
          value={progress.confidence}
          onChange={(v) => dispatch(setConfidence(question.id, v))}
        />
      </div>

      <div className="rule pt-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Next</p>
        <div className="mt-2 flex flex-col gap-2">
          {siblingId !== null && siblingTitle !== null ? (
            <Button variant="outline" size="sm" className="self-start" onClick={() => dispatch(activeQuestionSet(siblingId))}>
              <ArrowRight /> Same idea, different disguise: {siblingTitle}
            </Button>
          ) : family ? (
            <p className="text-sm text-muted-foreground">
              No untouched siblings left in this family — you have covered the idea from every angle
              the roadmap offers.
            </p>
          ) : (
            // 101 of the 539 questions sit outside the family map. Claiming they have an
            // exhausted family would be a fabricated completion.
            <p className="text-sm text-muted-foreground">
              This one is not mapped to a problem family, so there is no sibling to transfer the
              idea to yet.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {progress.nextRevision
              ? `This comes back on ${format(parseISO(progress.nextRevision), 'MMM d')}. Nothing to schedule — it is already on the ladder.`
              : 'This one is off the review ladder for good.'}
          </p>
        </div>
      </div>
    </div>
  );
}
