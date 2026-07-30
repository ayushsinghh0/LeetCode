import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { SearchDialog } from '@/components/shared/SearchDialog';
import { AchievementToast } from '@/components/gamification/AchievementToast';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { useCelebration } from '@/hooks/useCelebration';

export function AppShell() {
  // Mounted once here so every page shares a single celebration subscription instead of each
  // page wiring its own.
  useCelebration();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10">
          <PageTransition>
            <Outlet />
          </PageTransition>
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
