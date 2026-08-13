import { useEffect, useRef, useState } from 'react';
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
 * expensive time to lose it. So this panel runs one short sequence and stops: it names what was
 * actually practiced, asks how sure you are, asks one open question, and points at exactly one
 * next step with the reason attached. It does not congratulate at length, and it does not dump
 * the learner back into a list.
 *
 * The order is deliberate. Confidence is a reflex and costs one tap, so it comes first and is
 * captured even from someone who is already closing the dialog; the written reflection is the
 * expensive part and sits behind it; the recommendation comes last, because a suggestion offered
 * before the learner has finished thinking about what just happened is an interruption.
 */

/** The single recommended next move, with the reason it is being recommended. */
export interface NextStep {
  id: number;
  title: string;
  /** Why this one, in the learner's terms. Never a bare "related question". */
  reason: string;
}

export function PostSolvePanel({
  question,
  progress,
  family,
  next,
}: {
  question: Question;
  progress: QuestionProgress;
  family: ProblemFamily | undefined;
  next: NextStep | null;
}) {
  const dispatch = useAppDispatch();
  const [reflection, setReflection] = useState(progress.reflection ?? '');
  const [saved, setSaved] = useState(false);

  const pattern = patternById[question.pattern];
  const use = hintUse(progress.hintLevelUsed);

  // Autosave plumbing. The reflection has to survive Escape, a backdrop click, and navigating to
  // a sibling question — losing what someone just typed because they closed a dialog is the one
  // unforgivable bug for a field like this. `onBlur` covers the ordinary cases; the unmount
  // cleanup below covers the case where the dialog tears down without the textarea ever blurring.
  const latest = useRef(reflection);
  latest.current = reflection;
  const persisted = useRef(progress.reflection ?? '');

  function handleSave() {
    if (latest.current === persisted.current) {
      setSaved(true);
      return;
    }
    persisted.current = latest.current;
    dispatch(saveReflection(question.id, latest.current));
    setSaved(true);
  }

  useEffect(() => {
    const id = question.id;
    return () => {
      if (latest.current !== persisted.current) dispatch(saveReflection(id, latest.current));
    };
  }, [dispatch, question.id]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">
          What you practiced
        </p>
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
          {/* Hint use is reported beside the outcome, never folded into it and never priced.
              See the mastery/hints invariants — a support feature that scores you is one people
              stop using, and the signal disappears with it. */}
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-easy" aria-hidden="true" />
            <span>{HINT_USE_LABEL[use]}.</span>
          </li>
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium">How confident are you?</p>
        <p className="mb-0.5 text-xs text-muted-foreground">
          This is what tells the review schedule how hard to push.
        </p>
        <ConfidenceRating
          value={progress.confidence}
          onChange={(v) => dispatch(setConfidence(question.id, v))}
        />
      </div>

      <div>
        <label htmlFor={`reflection-${question.id}`} className="text-sm font-medium">
          What did you learn?
        </label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Optional. One line is enough — you will read it again when this comes back for review.
        </p>
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

      {/* One recommendation, with its reason stated. Not a menu — a menu at this moment is the
          learner's decision to make all over again, which is what they came here to avoid. */}
      <div className="rule flex flex-col gap-2 pt-4">
        <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">Next</p>
        {next ? (
          <>
            <p className="text-base font-medium leading-snug">{next.title}</p>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{next.reason}</p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => dispatch(activeQuestionSet(next.id))}
            >
              <ArrowRight /> Open {next.title}
            </Button>
          </>
        ) : family ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            No untouched siblings left in this family — you have covered the idea from every angle
            the roadmap offers.
          </p>
        ) : (
          // 101 of the 539 questions sit outside the family map. Claiming they have an
          // exhausted family would be a fabricated completion.
          <p className="max-w-prose text-sm text-muted-foreground">
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
  );
}
