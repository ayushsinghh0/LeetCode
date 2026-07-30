import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, icon: Icon, sub, accent }: StatCardProps) {
  return (
    <div className={cn('glass relative flex flex-col gap-3 p-4', accent && 'border-primary/50')}>
      <p className="border-b border-border/70 pb-2 pr-7 text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
      <Icon
        className={cn(
          'absolute right-4 top-4 h-4 w-4 shrink-0',
          accent ? 'text-primary' : 'text-muted-foreground/50',
        )}
        aria-hidden="true"
      />
      <div>
        <p className="font-serif text-[1.75rem] font-semibold leading-none tracking-tight">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground/80">{sub}</p>}
      </div>
    </div>
  );
}
