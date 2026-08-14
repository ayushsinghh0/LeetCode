import { Link } from 'react-router-dom';
import { practiceActionByKey } from '@/utils/engine/practice';
import type { PracticeIntention } from '@/types';

/**
 * The learner's own "After [cue], I will [action]" lines, on Today.
 *
 * Implementation intentions + habit stacking (Atomic Habits, Law 1) — but a suggestion the learner
 * authored, never a habit the app scores. So this is a quiet marginal rail, not a plate, and it
 * carries no checkbox, no tally, no XP: the work ledgers already track the practice itself; adding
 * per-intention tracking here is anti-trap #4 (habit tracking replacing the work). Each action
 * deep-links into the surface it names, so the reminder opens onto the work rather than describing
 * it. An intention whose action key no longer exists is skipped rather than rendered dead.
 *
 * See docs/superpowers/specs/2026-08-14-practice-engine-design.md § 4 for the binding copy rules
 * (plain language only — no Buddhist/Zen register on this scheduling surface).
 */
export function PracticeIntentionsRail({ intentions }: { intentions: PracticeIntention[] }) {
  const resolved = intentions
    .map((i) => ({ cue: i.cue, action: practiceActionByKey(i.action) }))
    .filter((r): r is { cue: string; action: NonNullable<ReturnType<typeof practiceActionByKey>> } => r.action !== undefined);

  if (resolved.length === 0) return null;

  return (
    <section aria-label="Your intentions" className="flex flex-col gap-2 border-l-2 border-border pl-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Intentions</p>
      <ul className="flex flex-col gap-1.5">
        {resolved.map((r, i) => (
          <li key={i} className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            After {r.cue}, I will{' '}
            <Link to={r.action.href} className="text-foreground underline underline-offset-2">
              {r.action.label}
            </Link>
            .
          </li>
        ))}
      </ul>
    </section>
  );
}
