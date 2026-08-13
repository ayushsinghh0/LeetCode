import { ChevronDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/layout/Page';
import { useAppDispatch } from '@/store/hooks';
import { revealHint } from '@/store/actions';
import type { Hint } from '@/utils/engine/hints';
import { cn } from '@/utils/cn';

/**
 * The hint ladder — help that escalates only as far as it is asked to.
 *
 * One rung opens at a time and each opening is recorded, which is the entire mechanism: the
 * learner gets unblocked, and the system learns how much scaffolding this problem needed. There
 * is no penalty attached anywhere, deliberately. A hint that costs XP is a hint people push past
 * by guessing, and a guess teaches nothing.
 *
 * The content is the question's problem-family cues, technique, and trap — the same verified
 * text the family page and the recognition drills use, never a separately written set that could
 * quietly contradict them.
 */
export function HintLadder({
  questionId,
  hints,
  revealedLevel,
}: {
  questionId: number;
  hints: Hint[];
  revealedLevel: number;
}) {
  const dispatch = useAppDispatch();

  if (hints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hint ladder for this one — it sits outside the mapped problem families, and inventing
        guidance for it would be worse than saying so.
      </p>
    );
  }

  const nextLevel = revealedLevel + 1;
  const nextHint = hints.find((h) => h.level === nextLevel);

  return (
    <div className="flex flex-col gap-4">
      {hints
        .filter((h) => h.level <= revealedLevel)
        .map((hint) => (
          <div key={hint.level} className="border-l-2 border-primary/40 pl-3">
            <Eyebrow>
              Hint {hint.level} &middot; {hint.label}
            </Eyebrow>
            <ul className={cn('mt-1 space-y-1', hint.lines.length === 1 && 'list-none')}>
              {hint.lines.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                  {hint.lines.length > 1 && (
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {nextHint ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => dispatch(revealHint(questionId, nextHint.level))}
        >
          <ChevronDown />
          {revealedLevel === 0 ? 'Show a hint' : `Next hint · ${nextHint.label}`}
        </Button>
      ) : (
        <p className="max-w-prose text-sm text-muted-foreground">
          That is the whole ladder — it is derived from this problem&rsquo;s family, so there is no
          fourth rung to invent. If it still is not landing, mark the attempt however it went: the
          family&rsquo;s full write-up opens below once the attempt is resolved, and it walks the
          idea from its simplest member up.
        </p>
      )}
    </div>
  );
}
