import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { PageFallback } from '@/components/layout/PageFallback';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TodayPage = lazy(() => import('@/pages/TodayPage'));
const RoadmapPage = lazy(() => import('@/pages/RoadmapPage'));
const AimlCoursePage = lazy(() => import('@/pages/AimlCoursePage'));
const PatternsPage = lazy(() => import('@/pages/PatternsPage'));
const CompaniesPage = lazy(() => import('@/pages/CompaniesPage'));
const PatternDetailPage = lazy(() => import('@/pages/PatternDetailPage'));
const RevisionPage = lazy(() => import('@/pages/RevisionPage'));
const DrillsPage = lazy(() => import('@/pages/DrillsPage'));
const InterviewPage = lazy(() => import('@/pages/InterviewPage'));
const ContestPage = lazy(() => import('@/pages/ContestPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage'));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const FocusPage = lazy(() => import('@/pages/FocusPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

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
    // AppShell carries its own Suspense around the page column, so shell-routed pages never
    // blank the chrome. This outer boundary is the backstop for routes rendered OUTSIDE the
    // shell — /focus, which has no chrome to preserve.
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/aiml" element={<AimlCoursePage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/patterns/:patternId" element={<PatternDetailPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:companyId" element={<CompaniesPage />} />
          <Route path="/revision" element={<RevisionPage />} />
          <Route path="/drills" element={<DrillsPage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/contest" element={<ContestPage />} />
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
            {/* Outer backstop for crashes outside any page (shell, providers' children). The
                per-page boundary lives inside AppShell so page crashes keep the nav alive. */}
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
