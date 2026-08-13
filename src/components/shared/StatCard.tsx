import type { LucideIcon } from 'lucide-react';
import { Plate } from '@/components/layout/Page';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  accent?: boolean;
}

/**
 * A single figure that genuinely stands alone.
 *
 * Under the composition contract this is the narrow case, not the default: several counted facts
 * belong in `Ledger`, which rules them into one open line instead of giving each its own bordered
 * rectangle. Reach for this only when one number is the whole point of the block — and never four
 * of them in a grid, which is the arrangement `Ledger` exists to replace.
 *
 * It is built on `Plate` so its padding tracks the one plate scale rather than drifting to its
 * own value.
 */
export function StatCard({ label, value, icon: Icon, sub, accent }: StatCardProps) {
  return (
    <Plate className={cn('relative flex flex-col gap-3', accent && 'border-primary/50')}>
      <p className="border-b border-border/70 pb-2 pr-7 text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
      <Icon
        className={cn(
          'absolute right-5 top-5 h-4 w-4 shrink-0',
          accent ? 'text-primary' : 'text-muted-foreground/50',
        )}
        aria-hidden="true"
      />
      <div>
        <p className="font-serif text-[1.75rem] font-semibold leading-none tracking-tight">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground/80">{sub}</p>}
      </div>
    </Plate>
  );
}
