import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PageTransition } from '@/components/layout/PageTransition';

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:pb-6 lg:px-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <MobileNav />
    </div>
  );
}

export default AppShell;
