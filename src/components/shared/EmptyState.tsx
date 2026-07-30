import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8" aria-hidden="true" />
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  );
}
