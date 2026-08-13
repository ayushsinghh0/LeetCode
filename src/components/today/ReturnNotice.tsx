import { CalendarCheck } from 'lucide-react';
import { formatMinutes } from '@/utils/engine/planner';

/**
 * The return experience, after two or more days away.
 *
 * Deliberately not a debt notice. The evidence on fresh-start framing is that relegating a gap
 * to a closed period increases the odds of restarting, while a wall of red overdue items is the
 * documented way to make a return feel like a punishment queue and turn a two-day gap into a
 * two-week one. So this states the gap once, without adjective, and immediately reframes the day
 * as a small one — the plan below has already been cut to the learner's stated capacity, which
 * is the actual rebalancing.
 *
 * There is nothing to dismiss and nothing to buy: it disappears on its own the moment any work
 * is logged today.
 */
export function ReturnNotice({ daysAway, plannedMinutes }: { daysAway: number; plannedMinutes: number }) {
  return (
    <section className="glass flex flex-col gap-2 p-5" aria-label="Welcome back">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-base font-medium">Welcome back</h2>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        It has been {daysAway} days. Your reviews waited rather than expired — nothing was lost, and
        the ladder picks up exactly where it stopped. Today&apos;s queue comes to{' '}
        <span className="figures">~{formatMinutes(plannedMinutes)}</span>; you do not have to clear
        it. Start with the one item below, or set a smaller window above the plan and let the rest
        come back gradually.
      </p>
    </section>
  );
}
