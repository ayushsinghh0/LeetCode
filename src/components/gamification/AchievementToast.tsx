import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, X } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toastPopped } from '@/store/slices/uiSlice';
import { ACHIEVEMENTS } from '@/utils/engine/achievements';

const TOAST_DURATION_MS = 4000;

const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/**
 * Watches ui.toastQueue and renders a single slide-in toast for the achievement at the front of
 * the queue. Auto-dismisses after 4s by dispatching toastPopped, which advances the queue and
 * (via the effect re-running on the new id) starts a fresh 4s timer for the next toast — so the
 * queue drains one toast at a time. Mounted once in AppShell.
 */
export function AchievementToast() {
  const currentId = useAppSelector((state) => state.ui.toastQueue[0] ?? null);
  const dispatch = useAppDispatch();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentId) return undefined;

    timerRef.current = setTimeout(() => {
      dispatch(toastPopped());
    }, TOAST_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [currentId, dispatch]);

  function handleDismiss() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch(toastPopped());
  }

  const def = currentId ? achievementById.get(currentId) : undefined;
  const Icon = def ? iconByName(def.icon, Award) : Award;

  // bottom-20 below md clears MobileNav's fixed full-width bottom bar (same offset the
  // floating PomodoroWidget uses); md+ can sit in the corner proper.
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 md:bottom-4">
      {/* No `exit` variant on the motion.div below: framer-motion only defers unmounting for an
          AnimatePresence child that declares one, and this toast needs to leave the DOM the
          instant its id is popped from the queue (both on the 4s auto-dismiss and the X button)
          rather than lingering through an exit animation — so only the slide-in entrance is
          animated. */}
      <AnimatePresence>
        {def && (
          <motion.div
            key={def.id}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            role="status"
            className="glass pointer-events-auto flex items-center gap-3 p-4 pr-3 shadow-lg"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-primary-foreground">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Achievement unlocked!</p>
              <p className="truncate text-sm font-semibold">{def.title}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={handleDismiss}
              className="ml-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AchievementToast;
