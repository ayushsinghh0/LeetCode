import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  // `MotionConfig reducedMotion="user"` suppresses transform and layout values only, so the `y`
  // below is covered and the OPACITY fade is not — it ran on every navigation regardless. The repo
  // documents this exact gap twice (ProgressRing, RoadmapPage); this file was edited without
  // applying it.
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* `h-full` passes the shell's definite height through to the screen. Without it this
          wrapper is the break in the chain: `main` has a height, the gutter div has `lg:h-full`,
          and then an auto-height motion div underneath means a `Screen`'s own `h-full` resolves
          against `auto` and collapses to its content — which is exactly how a viewport-composed
          screen quietly becomes a document again.

          The 180ms/6px enter is the directive's navigation step: content settles rather than
          slides. `mode="wait"` means the two screens never overlap, so the rail never sees a
          second column appear beside it mid-transition. */}
      <motion.div
        key={location.pathname}
        className="h-full"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
