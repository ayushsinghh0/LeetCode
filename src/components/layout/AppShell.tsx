import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageFallback } from '@/components/layout/PageFallback';
import { useAppSelector } from '@/store/hooks';

// The question sheet is the app's heaviest non-route component — hint ladder, post-solve
// reflection, family panel, and the markdown notes editor behind it. It is also opened on
// demand rather than on load, so it is deferred out of the shell chunk.
const QuestionDetailModal = lazy(() =>
  import('@/components/questions/QuestionDetailModal').then((m) => ({ default: m.QuestionDetailModal })),
);
// Same treatment for the command palette: it drags the Radix select + filter-row stack with it
// (~30 kB minified), and it only ever appears on demand. Its Ctrl/Cmd+K hotkey lives in the
// eager useSearchHotkey hook below — a lazy component cannot own the shortcut that summons it.
const SearchDialog = lazy(() => import('@/components/shared/SearchDialog'));
import { AchievementToast } from '@/components/gamification/AchievementToast';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { useCelebration } from '@/hooks/useCelebration';
import { useDueReminder } from '@/hooks/useDueReminder';
import { useRouteTitle } from '@/hooks/useRouteTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';

export function AppShell() {
  // Mounted once here so every page shares a single celebration subscription instead of each
  // page wiring its own.
  useCelebration();
  // Due-today browser reminder (permission-aware, max once per day) — see useDueReminder.
  useDueReminder();
  // Tab title follows the route ("Today · DSA Roadmap").
  useRouteTitle();
  // Ctrl/Cmd+K opens the (lazy) command palette — the hotkey must live in the eager shell.
  useSearchHotkey();

  // Latch rather than mirror: once the sheet has been opened, it stays mounted so closing it
  // still plays its exit transition. Mirroring `activeQuestionId` directly would unmount on
  // close and cut that animation off mid-way.
  const activeQuestionId = useAppSelector((s) => s.ui.activeQuestionId);
  const [sheetLoaded, setSheetLoaded] = useState(false);
  useEffect(() => {
    if (activeQuestionId !== null) setSheetLoaded(true);
  }, [activeQuestionId]);

  // Same latch for the command palette (its exit transition would be cut off by unmounting on
  // close, exactly like the sheet above).
  const searchOpen = useAppSelector((s) => s.ui.searchOpen);
  const [searchLoaded, setSearchLoaded] = useState(false);
  useEffect(() => {
    if (searchOpen) setSearchLoaded(true);
  }, [searchOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Bypass block (WCAG 2.4.1, level A). Fifteen sidebar links precede the content on every
          route, so a keyboard or switch user paid fifteen tab stops per navigation to reach the
          page they had just opened. It is the first thing in the tab order, invisible until
          focused, and then it renders as an ordinary plate above the sidebar's top edge. */}
      {/* The padding utilities carry the `focus:` prefix deliberately. Tailwind's
          `.focus\:not-sr-only:focus` sets `padding: 0` at specificity (0,2,0), which beats an
          unprefixed `px-4 py-2.5` at (0,1,0) — so the unprefixed version rendered a flush,
          padding-less box on focus. Prefixed, they match its specificity and win on source order. */}
      <a
        href="#content"
        className="glass sr-only left-4 top-4 z-50 text-sm font-medium focus:not-sr-only focus:absolute focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-2.5"
      >
        Skip to content
      </a>
      <Sidebar />
      {/* `tabIndex={-1}` so the fragment jump actually moves focus here rather than only the
          scroll position — several engines will not focus a non-focusable target. */}
      <main id="content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        {/* pb-28 on phones: the bottom-nav clearance the design system specifies (DESIGN.md
            § Adding a New Surface #8). It was pb-36 to accommodate the floating pomodoro's
            permanent plate — 144px of dead page foot on every phone screen to make room for a
            timer that is idle almost all the time. The widget now collapses to a 40px ghost
            button when idle, and its glyph sits inside this reservation. Desktop has neither. */}
        {/* `py-5 md:py-8` (was `py-6 md:py-10`). The shell's own top padding is pure lead-in — it
            communicates nothing and is charged against the first viewport of every route, twice
            over on desktop where the masthead already opens with an eyebrow. `pb-28` is untouched:
            that one is the bottom-nav clearance and shrinking it would put the nav over content. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
          {/* Boundary inside the shell: a page crash keeps the sidebar/nav alive so the user
              can still move to another route. App.tsx carries the outer backstop. */}
          <ErrorBoundary>
            {/* Suspense sits HERE, not above the shell: a lazy route's chunk should replace the
                page column, never the whole application. Above the shell it blanked the sidebar,
                the mobile nav and the brand on every cold load. */}
            <Suspense fallback={<PageFallback />}>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav />
      {sheetLoaded && (
        <Suspense fallback={null}>
          <QuestionDetailModal />
        </Suspense>
      )}
      {searchLoaded && (
        <Suspense fallback={null}>
          <SearchDialog />
        </Suspense>
      )}
      <AchievementToast />
      {/* /focus itself never renders AppShell (see src/App.tsx — it's routed outside the AppShell
          layout route), so this floating copy and FocusPage's inline <PomodoroWidget variant="inline" />
          are never mounted at the same time. */}
      <PomodoroWidget />
    </div>
  );
}

export default AppShell;
