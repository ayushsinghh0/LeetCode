import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { courseWeekById } from '@/data/aimlCourse';
import { cn } from '@/utils/cn';

// Shared idioms for the two ML lists on /aiml. Both are rows inside one plate that open into a
// document, so both need the same header button, the same labelled field, and the same honest
// sentence about a missing course week.

export const EYEBROW = 'figures text-xs uppercase tracking-[0.14em] text-muted-foreground';

/**
 * The row header. The whole line is the control — a chevron alone is a 16px target on a row the
 * user already reads as clickable.
 */
export function RowToggle({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="-mx-2 flex w-full items-start gap-3 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronDown
        className={cn(
          'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-swift',
          open && 'rotate-180',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/** A labelled block inside an opened row: quiet eyebrow, content underneath. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className={EYEBROW}>{label}</p>
      {children}
    </div>
  );
}

/** A prose list where the order is the instruction — the checklist, the experiments. */
export function StepList({ items, ordered = true }: { items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed">
          <span className={cn('shrink-0', ordered ? 'figures text-muted-foreground/70' : 'text-border')}>
            {ordered ? String(i + 1).padStart(2, '0') : '—'}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </List>
  );
}

/** Monospace fragments that are code, not prose: array shapes, library symbols. */
export function CodeChips({ items, label }: { items: string[]; label: string }) {
  return (
    <Field label={label}>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="figures rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </Field>
  );
}

/**
 * Which course week this belongs to — or the fact that it belongs to none.
 *
 * Roughly a third of the tracks and half the projects have `weekId: null`, because the 26-week
 * course runs neural networks → transformers → PyTorch → agents → RAG → fine-tuning → RL → evals
 * and never covers classical ML, recommenders or sklearn-era serving. Saying so is the point;
 * silently omitting the line would read as an oversight, and inventing a week would be a false
 * claim about the curriculum.
 */
export function weekLabel(weekId: string | null): string {
  if (weekId === null) return 'Outside the 26 weeks';
  const week = courseWeekById.get(weekId);
  if (!week) return 'Outside the 26 weeks';
  return week.week === null ? week.title : `Week ${week.week} · ${week.title}`;
}
