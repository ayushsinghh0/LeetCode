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
    <div
      className={cn(
        'glass flex flex-col gap-3 p-4',
        accent && 'border-primary/60 shadow-[0_0_24px_hsl(var(--primary)/0.35)]',
      )}
    >
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg',
          accent ? 'bg-accent-gradient text-white' : 'bg-primary/15 text-primary',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground/80">{sub}</p>}
      </div>
    </div>
  );
}
