import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
      <Icon className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-serif text-base font-medium text-foreground">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  );
}
