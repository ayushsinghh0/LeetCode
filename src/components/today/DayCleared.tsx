import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMinutes } from '@/utils/engine/planner';

/**
 * The end of the day's list.
 *
 * A finished day should read as finished. The alternative — immediately offering more work —
 * teaches that the plan is never really complete, which quietly removes the reason to make one.
 * So this states what was done, and the only forward action offered is optional and named as
 * such.
 */
export function DayCleared({ solvedToday, minutesToday }: { solvedToday: number; minutesToday: number }) {
  return (
    <section className="glass flex flex-col gap-3 p-6" aria-label="Today is clear">
      <div className="flex items-center gap-2 border-b border-border/70 pb-2">
        <CheckCircle2 className="h-4 w-4 text-easy" aria-hidden="true" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Done for today</p>
      </div>

      <h2 className="text-xl font-semibold">Today&apos;s plan is clear.</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        {solvedToday > 0 || minutesToday > 0 ? (
          <>
            You solved <span className="figures">{solvedToday}</span>{' '}
            {solvedToday === 1 ? 'question' : 'questions'}
            {minutesToday > 0 && (
              <>
                {' '}and logged <span className="figures">{formatMinutes(minutesToday)}</span> of focused time
              </>
            )}
            . The next reviews are already scheduled — there is nothing you need to do to keep them.
          </>
        ) : (
          <>
            Nothing is due and nothing is outstanding. A day with an empty queue is the system working,
            not a day wasted.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/roadmap">Work ahead (optional)</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/analytics">See what changed</Link>
        </Button>
      </div>
    </section>
  );
}
