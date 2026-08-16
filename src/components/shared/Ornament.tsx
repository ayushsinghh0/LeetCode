import { cn } from '@/utils/cn';

/**
 * Marginalia — the course reader's engraved ornaments.
 *
 * Three tiny line engravings in the tradition of mid-century textbook dingbats: a sprig, a
 * printer's fleuron, a laurel. They exist to mark the handful of *human* moments in the product —
 * the day's reflection, a finished day, a closed sitting, the earned shelf — the way a well-set
 * book rules off a chapter with a small device rather than a heavier line.
 *
 * The discipline that keeps them from becoming clip-art:
 * - **Hairline ink only.** `currentColor` stroke, no fill — the same material as the `.rule`
 *   hairline and the chart axes. They inherit whatever quiet text token the site already wears
 *   (typically `text-muted-foreground/60`); they never introduce a hue.
 * - **Always decorative.** `aria-hidden` unconditionally; an ornament never carries meaning a
 *   screen reader would need.
 * - **Sparing.** One per surface at most, and only on reflective moments — never beside data,
 *   controls, or anything the learner is being asked to do. A motif on every plate is wallpaper.
 */
export type OrnamentKind = 'sprig' | 'fleuron' | 'star';

const PATHS: Record<OrnamentKind, React.ReactNode> = {
  // A stem with two leaves and a bud — growth, for finished work.
  sprig: (
    <>
      <path d="M12 21c0-5 .8-9.5 3.2-15.2" />
      <path d="M12.7 14.6C10.2 14.9 8.1 13.7 7.2 11.4c2.7-.4 4.7.7 5.5 3.2Z" />
      <path d="M13.9 9.9c2.4-.2 4.1-1.5 5-3.9-2.7 0-4.4 1.3-5 3.9Z" />
      <circle cx="15.6" cy="4.1" r="0.9" />
    </>
  ),
  // The printer's leaf — a heart-leaf with a curled tail, for the reflective line.
  fleuron: (
    <>
      <path d="M12 4.2C9.2 6.4 8.6 9.4 12 12.4c3.4-3 2.8-6 0-8.2Z" />
      <path d="M12 12.4c.1 3-1 5.2-3.4 6.4" />
      <path d="M12 6.8v3.4" />
    </>
  ),
  // The printer's star — six hairline rays around a hollow centre, for the earned shelf.
  star: (
    <>
      <path d="M12 3v5.5M12 15.5V21" />
      <path d="M19.8 7.5 15 10.25M9 13.75l-4.8 2.75" />
      <path d="M4.2 7.5 9 10.25M15 13.75l4.8 2.75" />
      <circle cx="12" cy="12" r="1.1" />
    </>
  ),
};

export function Ornament({ kind, className }: { kind: OrnamentKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      {PATHS[kind]}
    </svg>
  );
}
