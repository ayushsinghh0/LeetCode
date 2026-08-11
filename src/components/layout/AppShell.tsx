import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { SearchDialog } from '@/components/shared/SearchDialog';
import { AchievementToast } from '@/components/gamification/AchievementToast';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { useCelebration } from '@/hooks/useCelebration';
import { useDueReminder } from '@/hooks/useDueReminder';
import { useRouteTitle } from '@/hooks/useRouteTitle';

export function AppShell() {
  // Mounted once here so every page shares a single celebration subscription instead of each
  // page wiring its own.
  useCelebration();
  // Due-today browser reminder (permission-aware, max once per day) — see useDueReminder.
  useDueReminder();
  // Tab title follows the route ("Today · DSA Roadmap").
  useRouteTitle();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10">
          {/* Boundary inside the shell: a page crash keeps the sidebar/nav alive so the user
              can still move to another route. App.tsx carries the outer backstop. */}
          <ErrorBoundary>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav />
      <QuestionDetailModal />
      <SearchDialog />
      <AchievementToast />
      {/* /focus itself never renders AppShell (see src/App.tsx — it's routed outside the AppShell
          layout route), so this floating copy and FocusPage's inline <PomodoroWidget variant="inline" />
          are never mounted at the same time. */}
      <PomodoroWidget />
    </div>
  );
}

export default AppShell;
