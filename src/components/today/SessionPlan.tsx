import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Section, RuledList, RuledItem } from '@/components/layout/Page';
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
 * The chips write the same capacity the Settings page and the Revision session own, so today's
 * answer becomes tomorrow's default — the commitment is asked once and then remembered, not
 * re-asked every morning. One number, three places to set it, never three competing numbers.
 *
 * Composition note: this is a `Section`, not a plate. It is the support for the lead above it,
 * and giving it an outline of its own was what made the two read as siblings. The commitment row
 * also gets its own full-width line rather than sharing one with the heading — six 44px targets
 * and an h2 do not fit across a 375px phone, and the wrapped three-row result was the loudest
 * layout break on the page.
 */
export function SessionPlan({ ranked }: { ranked: WorkItem[] }) {
  const dispatch = useAppDispatch();
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);

  const session = useMemo(() => buildSession(capacityMin, ranked), [capacityMin, ranked]);

  if (ranked.length === 0) return null;

  const skippedMinutes = session.skipped.reduce((sum, i) => sum + i.minutes, 0);

  return (
    <Section
      aria-label="Session plan"
      title="Today's plan"
      support="Say how long you have and the list is cut to fit it. Whatever does not fit simply waits."
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground">
          How long have you got?
        </legend>
        {/* A radiogroup, not a row of toggles: these are six mutually exclusive options, and
            `aria-pressed` would announce six independent switches with five "not pressed" for
            no stated reason. Six equal columns keep every target at or above 44px down to a
            375px viewport without the row ever wrapping. */}
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Time available today">
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
                  'figures inline-flex min-h-[44px] items-center justify-center rounded-sm border px-1 text-xs transition-colors duration-150 ease-swift',
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
      </fieldset>

      {session.items.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing on today&apos;s list fits {formatMinutes(capacityMin)}. The smallest item left is{' '}
          ~{formatMinutes(Math.min(...session.skipped.map((i) => i.minutes)))} — pick a longer window, or
          come back when you have one.
        </p>
      ) : (
        <RuledList as="ol" aria-label="Planned work, in order">
          {session.items.map((item, index) => (
            <RuledItem key={item.id} className="flex items-baseline gap-3">
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
            </RuledItem>
          ))}
        </RuledList>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="figures text-sm text-muted-foreground">
          ~{formatMinutes(session.totalMinutes)} planned
          {session.leftoverMin > 0 && ` · ~${formatMinutes(session.leftoverMin)} spare`}
        </p>

        {session.skipped.length > 0 && (
          <p className="max-w-prose text-sm text-muted-foreground">
            Not in this session: {session.skipped.length}{' '}
            {session.skipped.length === 1 ? 'item' : 'items'} (~{formatMinutes(skippedMinutes)}). They
            stay on the list — nothing expires.
          </p>
        )}
      </div>
    </Section>
  );
}
