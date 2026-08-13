import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { RecallPrompt } from '@/data/courseRecall';

// Retrieval practice for one course week: every prompt starts unanswered, and the answer stays
// hidden until the learner has tried to recall it — the attempt is the exercise, not the read.
export function CourseRecallList({ prompts }: { prompts: RecallPrompt[] }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        Answer each one in your head (or out loud) before revealing — the recall attempt is what
        strengthens the memory.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {prompts.map((p) => {
          const open = revealed[p.id] === true;
          return (
            <li key={p.id} className="rounded-md bg-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{p.prompt}</p>
                <span
                  className={cn(
                    'shrink-0 text-xs uppercase tracking-wide',
                    p.depth === 'stretch' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {p.depth}
                </span>
              </div>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground"
                aria-expanded={open}
                onClick={() => setRevealed((r) => ({ ...r, [p.id]: !open }))}
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform duration-150 ease-swift', open && 'rotate-180')}
                  aria-hidden="true"
                />
                {open ? 'Hide answer' : 'Reveal answer'}
              </button>
              {open && <p className="mt-2 text-sm text-muted-foreground">{p.answer}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
