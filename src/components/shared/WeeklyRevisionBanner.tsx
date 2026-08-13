import { Sparkles } from 'lucide-react';

/**
 * Weekly revision day, stated as context rather than shouted.
 *
 * This used to be a solid-ink plate — the only one in the app — sitting above the next-action
 * lead and out-weighting the thing the page is built around. A recurring calendar fact is not
 * more important than the day's recommendation, so it now reads as what it is: one line of
 * context under the masthead, in the ordinary type ladder. The ink budget is spent on the icon.
 *
 * The register matters as much as the size. A weekly review day is an opportunity to bring work
 * forward cheaply, not a quota that has arrived — so the copy says what the day is for and states
 * plainly that early reviews cost nothing.
 */
export function WeeklyRevisionBanner({ count }: { count: number }) {
  return (
    <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="max-w-prose">
        <span className="font-medium text-foreground">Weekly Revision Day</span> —{' '}
        <span className="figures">{count}</span> {count === 1 ? 'revision' : 'revisions'} queued.
        Extra reviews are pulled forward today; taking one early costs nothing on the ladder, and
        leaving it costs nothing either.
      </span>
    </p>
  );
}
