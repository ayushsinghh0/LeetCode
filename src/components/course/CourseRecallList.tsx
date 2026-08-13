import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Eyebrow, RuledItem, RuledList } from '@/components/layout/Page';
import { cn } from '@/utils/cn';
import type { RecallPrompt } from '@/data/courseRecall';

// Retrieval practice for one course week: every prompt starts unanswered, and the answer stays
// hidden until the learner has tried to recall it — the attempt is the exercise, not the read.
//
// Composition: hairline-ruled rows, not one tonal rectangle per prompt. This list renders inside
// a DialogContent, which is already a plate, and a `bg-muted` fill per prompt is still a box —
// five of them nested inside another one. The revealed answer rides the `border-l-2 border-border`
// evidence rail (the InsightPanel idiom), which distinguishes it from the prompt by structure
// rather than by giving each prompt a container.
export function CourseRecallList({ prompts }: { prompts: RecallPrompt[] }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Answer each one in your head (or out loud) before revealing — the recall attempt is what
        strengthens the memory.
      </p>
      <RuledList aria-label="Recall prompts">
        {prompts.map((p) => {
          const open = revealed[p.id] === true;
          return (
            <RuledItem key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{p.prompt}</p>
                <Eyebrow className={cn('shrink-0', p.depth === 'stretch' && 'text-primary')}>
                  {p.depth}
                </Eyebrow>
              </div>
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
              {open && (
                <p className="max-w-prose border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                  {p.answer}
                </p>
              )}
            </RuledItem>
          );
        })}
      </RuledList>
    </div>
  );
}
