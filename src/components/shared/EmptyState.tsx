import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}

/**
 * The absence of content, stated. Never plated: bordering absence is how a page ends up with a
 * box for every state it can be in. A `plated` escape hatch used to exist here and no caller ever
 * passed it — it survived only as a re-entry point for the box problem, so it is gone. An empty
 * state that genuinely sits inside a surface gets that surface from its parent.
 */
export function EmptyState({ icon: Icon, title, hint, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 py-12 text-center text-muted-foreground', className)}>
      {/* The seal: the icon pressed into the paper rather than floating on it — a hairline ring,
          a ring of ground, then the faintest tonal well. Quiet on purpose; an empty state is the
          page at rest, not a call to action. */}
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/50 shadow-[inset_0_0_0_4px_hsl(var(--background))]"
      >
        <Icon className="h-5 w-5 text-muted-foreground/70" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-serif text-base font-medium text-foreground">{title}</p>
        {hint && <p className="max-w-prose text-sm">{hint}</p>}
      </div>
    </div>
  );
}
