import { Sparkles } from 'lucide-react';

// The weekly-revision-day callout, shared by Today and Revision so the two surfaces can never
// drift. text-primary-foreground (not text-white): the accent plate is theme-inked, and this
// pairing is what the token exists for — white on the lamplight ink fails AA contrast.
export function WeeklyRevisionBanner({ count }: { count: number }) {
  return (
    <div className="glass flex items-center gap-3 bg-accent-gradient p-4 text-primary-foreground">
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="font-semibold">Weekly Revision Day — {count} revisions queued</p>
    </div>
  );
}
