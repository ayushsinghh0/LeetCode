import { Provider } from 'react-redux';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore } from '@/store/store';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRoutes } from '@/App';

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7
// unless the future flags below are opted into. Passing them to MemoryRouter (and to
// BrowserRouter in src/App.tsx) keeps test/dev console output free of those warnings.
// No other router deprecation warnings are expected from this suite.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const SIDEBAR_LABELS = [
  'Dashboard',
  'Today',
  'Roadmap',
  'AI/ML',
  'Patterns',
  'Revision',
  'Calendar',
  'Analytics',
  'Achievements',
  'Bookmarks',
  'Settings',
];

function renderApp(initialEntries: string[] = ['/']) {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={initialEntries} future={routerFutureFlags}>
            <AppRoutes />
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </Provider>,
  );
}

describe('AppShell routing', () => {
  test('renders the Dashboard page and all 11 sidebar nav labels at "/"', async () => {
    renderApp(['/']);

    // This is the very first render of the whole tree, gated on DashboardPage's lazy chunk
    // (React.lazy in src/App.tsx) resolving through the top-level Suspense boundary — no router
    // transition or AnimatePresence cycle is involved (PageTransition's `initial={false}` skips
    // animating the first mount), so in isolation this resolves in well under 500ms. But that
    // dynamic import still has to actually complete, and under a full-suite run (many Vitest
    // worker threads contending for the same CPU cores) even that can occasionally take longer
    // than Testing Library's default 1000ms findBy window — observed directly during diagnosis
    // of this file's flake history (this exact query timed out on one full-suite run, at ~1.96s,
    // while passing in isolation every time). See the longer note in the next test for the fuller
    // mechanism; the fix here is the same: a generous per-query timeout, not a global bump.
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 5000 });

    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });
    for (const label of SIDEBAR_LABELS) {
      expect(within(sidebarNav).getByText(label)).toBeInTheDocument();
    }
  });

  test('clicking Today in the sidebar navigates to the Today page', async () => {
    renderApp(['/']);
    // Same lazy-chunk-under-Suspense wait as test 1 above, same justified timeout.
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 5000 });

    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });
    fireEvent.click(within(sidebarNav).getByRole('link', { name: /today/i }));

    // This one additionally (a) navigates via React Router's navigate() — wrapped in
    // startTransition by the v7_startTransition future flag above, a low-priority update React
    // can defer — and (b) crosses PageTransition's AnimatePresence mode="wait" exit/enter cycle
    // (Dashboard's exit animation must finish before the lazily imported TodayPage chunk mounts).
    // That stacks on top of the same base lazy-import cost test 1 pays, which is why this was the
    // first query in the file ever observed to flake. In isolation this resolves in ~350ms,
    // comfortably under the default 1000ms findBy timeout; but under full-suite CPU contention the
    // deferred transition can be starved well past that window even though nothing is actually
    // broken (verified: 100% reproducible pass in isolation across repeated runs; intermittent
    // timeout only under full-suite load, and navigation always completes within a couple seconds
    // regardless). A generous explicit timeout on just this query — rather than raising the global
    // default — absorbs that contention without masking a genuine hang elsewhere.
    await screen.findByRole('heading', { name: 'Today' }, { timeout: 5000 });
  });

  test('an unknown path renders the 404 page inside the shell with a way back', async () => {
    renderApp(['/nowhere']);

    // Same lazy-chunk-under-Suspense wait as the tests above, same justified timeout.
    await screen.findByRole('heading', { name: 'Page not found' }, { timeout: 5000 });
    expect(screen.getByText('/nowhere')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toBeInTheDocument();
    // Still inside the shell: the sidebar is present.
    expect(screen.getByRole('navigation', { name: /sidebar navigation/i })).toBeInTheDocument();
  });

  test('/focus renders the Focus page without sidebar chrome', async () => {
    renderApp(['/focus']);

    // FocusPage (Task 24) shows the current question's title as its heading, not a static
    // "Focus" label — assert on its Exit link instead, which is stable regardless of which
    // question is queued up.
    await screen.findByRole('link', { name: /exit/i });
    expect(screen.queryByText('DSA Roadmap')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /sidebar navigation/i })).not.toBeInTheDocument();
  });
});
