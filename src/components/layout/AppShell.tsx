import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { SearchDialog } from '@/components/shared/SearchDialog';
import { AchievementToast } from '@/components/gamification/AchievementToast';
import { useCelebration } from '@/hooks/useCelebration';

export function AppShell() {
  // Mounted once here so every page shares a single celebration subscription instead of each
  // page wiring its own.
  useCelebration();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:pb-6 lg:px-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <MobileNav />
      <QuestionDetailModal />
      <SearchDialog />
      <AchievementToast />
    </div>
  );
}

export default AppShell;
