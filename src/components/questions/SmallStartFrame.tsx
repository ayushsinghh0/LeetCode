import { Eyebrow } from '@/components/layout/Page';
import { cn } from '@/utils/cn';

// One copy string, one source. The sentence is a product decision (docs/superpowers/specs/
// 2026-08-14-practice-engine-design.md § 4, rule 3 — binding, test-asserted): the small start is
// complete in itself, never a foot in the door for more. Both surfaces that frame a small start —
// the question sheet and Focus's small mode — render this constant, so the promise cannot drift
// between them.
export const SMALL_START_COPY =
  'Read the statement. Name the pattern to yourself before anything else — the first hint will check you. Two minutes is a complete start; stop there if that is all you have today.';

/**
 * The two-minute entry frame — a marginal note, not a plate.
 *
 * Same `border-l-2` rail idiom as the hint ladder and the return notice: it annotates the attempt
 * without interrupting it, and boxing it would give a framing device the weight of the work
 * itself. Deliberately inert — no timer, no countdown, no tracking, no XP. A small start that is
 * measured has been turned back into a commitment, which is exactly what it exists not to be.
 */
export function SmallStartFrame({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 border-l-2 border-primary/40 pl-3 text-left', className)}>
      <Eyebrow>Two-minute start</Eyebrow>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{SMALL_START_COPY}</p>
    </div>
  );
}
