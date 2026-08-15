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

  // THE APPLICATION SHELL.
  //
  // `lg:h-[100dvh] lg:overflow-hidden` is the whole V10 change, and the breakpoint is `lg` (1024)
  // rather than `md` (768) for a reason that cost a real defect to learn. Above it the root box is
  // exactly one viewport tall and clips, so the document can never grow —
  // `documentElement.scrollHeight === innerHeight`, the body never scrolls, and the rail beside it
  // stops being a flex child that stretches to a 4,000px document and scrolls away with it.
  //
  // It was `md` first, and the two-column screen bodies start at `lg`. Between 768 and 1023 that
  // left a height-locked column stack: the work div was `flex-1` with basis 0 while the context
  // `<aside>` was content-sized, so the aside took everything, the work column collapsed to ~96px,
  // and its overflow — being `visible` — painted *over* the rail instead of clipping. The hero's
  // primary button was not clickable at 900px, and every metric still read zero, because content
  // that overflows visibly overflows nothing. Lock the height at the same breakpoint as the
  // columns, or the band between them is neither a document nor a screen.
  //
  // Below `lg` the constraint is simply absent (`min-h-dvh`): mobile and small tablets keep an
  // honest document scroll, which the brief sanctions for surfaces too small to be a viewport.
  //
  // This is done here rather than as `html, body { overflow: hidden }` in index.css for one
  // reason: /focus is routed OUTSIDE AppShell (App.tsx) and owns its own `main`, and a global
  // overflow lock would have silently applied to it too. A shell that constrains itself constrains
  // exactly what it renders.
  //
  // There is exactly ONE scroll container below this: `<main>`. Not the sidebar's nav (that gets
  // its own only when it overflows), not a panel inside a panel. § NO NESTED SCROLL HELL.
  return (
    <div className="flex min-h-dvh lg:h-[100dvh] lg:overflow-hidden">
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
      {/* THE one scroll container in the application.
          - `min-h-0` is load-bearing: a flex child defaults to `min-height:auto`, which refuses to
            shrink below its content, so without it the main column would push the 100dvh row taller
            and hand the scroll straight back to the document.
          - `lg:overflow-y-auto`: pages flow at their natural height and scroll HERE, inside the
            shell, with the sidebar staying put. Nothing below this is permitted its own scrollbar —
            not a Panel, not a rail, not a tab body. § NO NESTED SCROLL HELL.
          - `[scrollbar-gutter:stable]` reserves the bar's lane on every route, so navigating from
            a short page to a long one does not shift the whole content column sideways.
          - `overscroll-contain` stops a finished inner scroll from chaining out to the page. */}
      <main
        id="content"
        tabIndex={-1}
        // `relative` is not decoration — without it the zero-scroll contract leaks.
        //
        // `overflow` clips an absolutely-positioned descendant only when the scroll container is
        // that descendant's containing block, i.e. only when it is itself positioned. `main` was
        // `static`, so every `sr-only` span in the tree (Tailwind's `sr-only` is
        // `position:absolute`) resolved against the initial containing block instead, sat at its
        // static offset *below* the clipped viewport, and extended
        // `documentElement.scrollHeight` — 1208px on /today, from ten 1px spans. The body reported
        // 800px and looked correct; the document scrolled anyway.
        className="relative min-w-0 flex-1 focus:outline-none lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]"
      >
        {/* pb-28 on phones: the bottom-nav clearance the design system specifies (DESIGN.md
            § Adding a New Surface #8). It was pb-36 to accommodate the floating pomodoro's
            permanent plate — 144px of dead page foot on every phone screen to make room for a
            timer that is idle almost all the time. The widget now collapses to a 40px ghost
            button when idle, and its glyph sits inside this reservation.

            `max-w-6xl` is the application measure (72rem): pages flow at natural height again, so
            an unbounded line length would stretch a masthead across 1600px of a wide display. Each
            page still narrows further through `Page`'s own width prop where prose wants less. No
            `h-full` — height belongs to content now, and the generous `md:pb-12` is what lets the
            last block of a scrolled page breathe instead of kissing the viewport edge. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-12 lg:px-8">
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
