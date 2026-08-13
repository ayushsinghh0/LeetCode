import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import { selectCourseDueReviewIds, selectDueRevisionIds } from '@/store/selectors';

// Module-level (not component state) so navigating in and out of /focus — which unmounts
// AppShell and this hook with it — cannot re-fire the reminder on the same day.
let lastNotifiedDate: string | null = null;

export function resetDueReminderForTests(): void {
  lastNotifiedDate = null;
}

// The notifications setting, wired to the one reminder a local-first app can honestly deliver:
// at most one browser notification per day, fired when the app is open and revision work
// (either track) is due. Permission-aware — silent unless the user granted notifications —
// and never schedules anything in the background.
//
// It counts `selectDueRevisionIds`, NOT the full revision queue. On a weekly revision day the
// queue is `[...due, ...weeklyTopUp]`, and every top-up is by construction *not* due — the engine
// builds them by excluding the due set, so each one has a future `nextRevision`. Counting the
// queue made the phone say "15 items are due for review today" on a day when zero were, which is
// the fastest way to teach someone to ignore the notification. Pulled-forward work is an
// opportunity the app offers when you open it, never a thing it interrupts you for.
//
// The `revisionEnabled` gate is applied here because it lives in `selectRevisionQueueIds` rather
// than in `selectDueRevisionIds`; dropping it would start notifying learners who turned revision
// off. Course reviews stay outside that gate, exactly as they were before.
export function useDueReminder(): void {
  const today = useToday();
  const enabled = useAppSelector((s) => s.settings.notifications);
  const revisionEnabled = useAppSelector((s) => s.settings.revisionEnabled);
  const dueQuestionIds = useAppSelector((s) => selectDueRevisionIds(s, today));
  const dueWeekIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const totalDue = (revisionEnabled ? dueQuestionIds.length : 0) + dueWeekIds.length;

  useEffect(() => {
    if (!enabled || totalDue === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (lastNotifiedDate === today) return;
    lastNotifiedDate = today;
    new Notification('Revisions due', {
      body: `${totalDue} item${totalDue === 1 ? ' is' : 's are'} due for review today.`,
      tag: 'dsa-roadmap-due', // same tag -> replaces instead of stacking
    });
  }, [enabled, totalDue, today]);
}
