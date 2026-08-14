import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow, RuledItem, RuledList } from '@/components/layout/Page';
import { cn } from '@/utils/cn';
import type { RecallPrompt } from '@/data/courseRecall';

type Verdict = 'got' | 'notyet';

// Retrieval practice for one course week: every prompt starts unanswered, and the answer stays
// hidden until the learner has tried to recall it — the attempt is the exercise, not the read.
// Wave F adds the self-grade: each prompt takes a Got it / Not yet verdict, and once every prompt
// has one the learner can record the check. First-attempt-per-date is the signal (the store
// enforces it), so a same-day rerun is practice and the recorded result holds.
//
// The count shown back is direct feedback on a self-test (retrieval with feedback), not a score on
// the reflective surface — so a number is appropriate here. The copy stays feedback, never a
// verdict on the learner (design record copy rule 4).
//
// Composition: hairline-ruled rows, not one tonal rectangle per prompt. This list renders inside
// a DialogContent, which is already a plate, and a `bg-muted` fill per prompt is still a box —
// five of them nested inside another one. The revealed answer rides the `border-l-2 border-border`
// evidence rail (the InsightPanel idiom), which distinguishes it from the prompt by structure
// rather than by giving each prompt a container.
export function CourseRecallList({
  prompts,
  recordedToday = false,
  onRecord,
}: {
  prompts: RecallPrompt[];
  /** True when a check for this week has already been recorded today (first-attempt-wins). */
  recordedToday?: boolean;
  /** Records the check's aggregate — provided by the dialog, absent in a read-only context. */
  onRecord?: (correct: number, total: number) => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [saved, setSaved] = useState(false);

  const graded = prompts.filter((p) => verdicts[p.id] !== undefined).length;
  const correct = prompts.filter((p) => verdicts[p.id] === 'got').length;
  const allGraded = graded === prompts.length && prompts.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Answer each one in your head (or out loud) before revealing — the recall attempt is what
        strengthens the memory.
      </p>
      <RuledList aria-label="Recall prompts">
        {prompts.map((p) => {
          const open = revealed[p.id] === true;
          const verdict = verdicts[p.id];
          return (
            <RuledItem key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{p.prompt}</p>
                <Eyebrow className={cn('shrink-0', p.depth === 'stretch' && 'text-primary')}>
                  {p.depth}
                </Eyebrow>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground"
                  aria-expanded={open}
                  onClick={() => setRevealed((r) => ({ ...r, [p.id]: !open }))}
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform duration-150 ease-swift', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                  {open ? 'Hide answer' : 'Reveal answer'}
                </button>

                {/* Self-grade — how the recall actually went, not whether the answer was read.
                    Available whether or not the answer is revealed; honesty is the learner's. */}
                {!recordedToday && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={verdict === 'got' ? 'secondary' : 'ghost'}
                      aria-pressed={verdict === 'got'}
                      onClick={() => setVerdicts((v) => ({ ...v, [p.id]: 'got' }))}
                    >
                      Got it
                    </Button>
                    <Button
                      size="sm"
                      variant={verdict === 'notyet' ? 'secondary' : 'ghost'}
                      aria-pressed={verdict === 'notyet'}
                      onClick={() => setVerdicts((v) => ({ ...v, [p.id]: 'notyet' }))}
                    >
                      Not yet
                    </Button>
                  </div>
                )}
              </div>
              {open && (
                <p className="max-w-prose border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                  {p.answer}
                </p>
              )}
            </RuledItem>
          );
        })}
      </RuledList>

      {/* The record footer — feedback, never a verdict. Only ever states what was recalled. */}
      {recordedToday ? (
        <p className="text-sm text-muted-foreground">
          You already recorded a check for this week today. Run through them again any time — reruns
          are practice.
        </p>
      ) : saved ? (
        <p className="text-sm text-muted-foreground">
          Recorded — you recalled <span className="figures">{correct}</span> of{' '}
          <span className="figures">{prompts.length}</span> this time.
        </p>
      ) : onRecord && allGraded ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              onRecord(correct, prompts.length);
              setSaved(true);
            }}
          >
            Record result
          </Button>
          <span className="text-xs text-muted-foreground">
            Nothing is scored against you — this just feeds what to review next.
          </span>
        </div>
      ) : onRecord ? (
        <p className="text-xs text-muted-foreground">
          Grade each prompt to record your result (<span className="figures">{graded}</span> of{' '}
          <span className="figures">{prompts.length}</span>).
        </p>
      ) : null}
    </div>
  );
}
