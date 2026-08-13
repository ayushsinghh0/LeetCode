import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDailyCapacity } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { buildSession, SESSION_PRESETS, type WorkItem } from '@/utils/engine/nextAction';
import { formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';

const SHORT_LABEL: Record<number, string> = {
  15: '15m', 30: '30m', 60: '1h', 90: '90m', 120: '2h', 180: '3h',
};

/**
 * "I have N minutes" — fixed time, variable scope.
 *
 * The budget is the input and the plan is cut to fit it, which is the opposite of a to-do list
 * that prints a total and leaves the trimming to the reader. What does not fit is stated rather
 * than hidden: a plan that silently drops work reads as "you are done" when you are not.
 *
 * The chips write the same capacity the Settings page owns, so today's answer becomes tomorrow's
 * default — the commitment is asked once and then remembered, not re-asked every morning.
 */
export function SessionPlan({ ranked }: { ranked: WorkItem[] }) {
  const dispatch = useAppDispatch();
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);

  const session = useMemo(() => buildSession(capacityMin, ranked), [capacityMin, ranked]);

  if (ranked.length === 0) return null;

  const skippedMinutes = session.skipped.reduce((sum, i) => sum + i.minutes, 0);

  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Session plan">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 pb-3">
        <h2 className="text-base font-medium">I have&hellip;</h2>
        {/* A radiogroup, not a row of toggles: these are six mutually exclusive options, and
            `aria-pressed` would announce six independent switches with five "not pressed" for
            no stated reason. Targets are 44px — this is on the phone check-in path. */}
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Time available today">
          {SESSION_PRESETS.map((preset) => {
            const active = capacityMin === preset;
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => dispatch(setDailyCapacity(preset))}
                className={cn(
                  'figures inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border px-3 text-xs transition-colors duration-150 ease-swift',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {SHORT_LABEL[preset] ?? `${preset}m`}
              </button>
            );
          })}
        </div>
      </div>

      {session.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing on today&apos;s list fits {formatMinutes(capacityMin)}. The smallest item left is{' '}
          ~{formatMinutes(Math.min(...session.skipped.map((i) => i.minutes)))} — pick a longer window, or
          come back when you have one.
        </p>
      ) : (
        <ol className="flex flex-col">
          {session.items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-baseline gap-3 border-b border-border/50 py-2 last:border-b-0"
            >
              <span className="figures w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              {item.questionId !== undefined ? (
                <button
                  type="button"
                  onClick={() => dispatch(activeQuestionSet(item.questionId!))}
                  className="min-w-0 flex-1 truncate text-left text-sm transition-colors duration-150 ease-swift hover:text-primary"
                >
                  {item.title}
                </button>
              ) : (
                <Link
                  to={item.href}
                  className="min-w-0 flex-1 truncate text-sm transition-colors duration-150 ease-swift hover:text-primary"
                >
                  {item.title}
                </Link>
              )}
              <span className="figures shrink-0 text-xs text-muted-foreground">
                ~{formatMinutes(item.minutes)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="figures text-xs text-muted-foreground">
        ~{formatMinutes(session.totalMinutes)} planned
        {session.leftoverMin > 0 && ` · ~${formatMinutes(session.leftoverMin)} spare`}
      </p>

      {session.skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not in this session: {session.skipped.length}{' '}
          {session.skipped.length === 1 ? 'item' : 'items'} (~{formatMinutes(skippedMinutes)}). They
          stay on the list — nothing expires.
        </p>
      )}

      <Button asChild variant="outline" size="sm" className="self-start">
        <Link to="/focus">Open focus timer</Link>
      </Button>
    </section>
  );
}
