import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /**
   * Draw a plate around it. Off by default: an empty state is the absence of content, and
   * bordering absence is how a page ends up with a box for every state it can be in. Pass this
   * only when the empty state sits inside a surface that already needs an edge.
   */
  plated?: boolean;
  className?: string;
}

export function EmptyState({ icon: Icon, title, hint, plated = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 text-center text-muted-foreground',
        plated ? 'glass p-6 md:p-8' : 'py-10',
        className,
      )}
    >
      <Icon className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-serif text-base font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-prose text-sm">{hint}</p>}
    </div>
  );
}
