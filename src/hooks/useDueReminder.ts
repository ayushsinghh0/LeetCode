import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useToday } from '@/hooks/useToday';
import { selectCourseDueReviewIds, selectRevisionQueueIds } from '@/store/selectors';

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
export function useDueReminder(): void {
  const today = useToday();
  const enabled = useAppSelector((s) => s.settings.notifications);
  const dueQuestionIds = useAppSelector((s) => selectRevisionQueueIds(s, today));
  const dueWeekIds = useAppSelector((s) => selectCourseDueReviewIds(s, today));
  const totalDue = dueQuestionIds.length + dueWeekIds.length;

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
