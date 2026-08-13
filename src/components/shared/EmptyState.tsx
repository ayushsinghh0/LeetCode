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
    <div className={cn('flex flex-col items-center gap-3 py-10 text-center text-muted-foreground', className)}>
      <Icon className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-serif text-base font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-prose text-sm">{hint}</p>}
    </div>
  );
}
