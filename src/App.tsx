import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TodayPage = lazy(() => import('@/pages/TodayPage'));
const RoadmapPage = lazy(() => import('@/pages/RoadmapPage'));
const AimlCoursePage = lazy(() => import('@/pages/AimlCoursePage'));
const PatternsPage = lazy(() => import('@/pages/PatternsPage'));
const PatternDetailPage = lazy(() => import('@/pages/PatternDetailPage'));
const RevisionPage = lazy(() => import('@/pages/RevisionPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage'));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const FocusPage = lazy(() => import('@/pages/FocusPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageFallback() {
  return (
    <div
      className="glass flex min-h-[240px] w-full animate-pulse items-center justify-center p-6"
      aria-busy="true"
    >
      <div className="h-8 w-8 rounded-full bg-accent-gradient" />
    </div>
  );
}

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7
// unless these future flags are opted into. Passing them here keeps dev/console output
// free of those deprecation warnings.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

/**
 * The route tree, exported separately (without BrowserRouter) so tests can mount it
 * inside a MemoryRouter.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/aiml" element={<AimlCoursePage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/patterns/:patternId" element={<PatternDetailPage />} />
          <Route path="/revision" element={<RevisionPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/focus" element={<FocusPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/* framer-motion animates via JS, so the CSS prefers-reduced-motion override alone can't
          reach it — this honors the user's motion preference for every motion.* component. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <BrowserRouter future={routerFutureFlags}>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
