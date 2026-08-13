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
 * It is a marginal note, not a plate: a quiet hairline rail in the margin, the way a course
 * reader annotates rather than interrupts. Boxing a welcome would give it the same weight as the
 * day's recommendation, which is precisely the emphasis a returning learner does not need.
 *
 * There is nothing to dismiss and nothing to buy: it disappears on its own the moment any work
 * is logged today.
 */
export function ReturnNotice({ daysAway, plannedMinutes }: { daysAway: number; plannedMinutes: number }) {
  return (
    <section className="flex flex-col gap-2 border-l-2 border-border pl-4" aria-label="Welcome back">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Welcome back</p>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        It has been {daysAway} days. Your reviews waited rather than expired — nothing was lost, and
        the ladder picks up exactly where it stopped. Today&apos;s queue comes to{' '}
        <span className="figures">~{formatMinutes(plannedMinutes)}</span>; you do not have to clear
        it. Start with the one item below, or set a smaller window on the plan and let the rest come
        back gradually.
      </p>
    </section>
  );
}
