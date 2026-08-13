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

// Deliberately hardcoded rather than derived from NAV_ITEMS: deriving would pass tautologically,
// and this list is the assertion that no label was renamed or dropped by accident.
const SIDEBAR_LABELS = [
  'Dashboard',
  'Today',
  'Roadmap',
  'AI/ML',
  'Patterns',
  'Companies',
  'Revision',
  'Drills',
  'Interview',
  'Contest',
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
  test('renders all 15 sidebar nav labels at "/"', () => {
    renderApp(['/']);

    // Synchronous, and deliberately so. This assertion is about the SHELL's nav registry, which
    // renders eagerly — it used to await DashboardPage's lazy chunk first, purely because the
    // Suspense boundary sat above the shell and nothing at all painted until that chunk landed.
    // With the boundary moved inside AppShell the wait is not just unnecessary, it was the
    // slowest thing in the suite: ~1.7s in isolation and >8s under full-worker contention, for a
    // chunk this test never asserts on. That the Dashboard route itself mounts is covered by
    // routes.test.tsx, which mounts every NAV_ITEMS route through the real lazy boundaries.
    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });
    for (const label of SIDEBAR_LABELS) {
      expect(within(sidebarNav).getByText(label)).toBeInTheDocument();
    }
  });

  test('clicking Today in the sidebar navigates to the Today page', async () => {
    renderApp(['/']);
    // Same lazy-chunk-under-Suspense wait as test 1 above, same justified timeout.
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 8000 });

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

  test('the shell chrome paints before the route chunk resolves, not after it', () => {
    renderApp(['/']);

    // Synchronous assertions, deliberately: no awaiting. The Suspense boundary lives inside
    // AppShell (around the page column), so the sidebar, brand and mobile nav are on screen
    // during the very first render while DashboardPage's chunk is still in flight. With the
    // boundary above the shell — where it used to be — every one of these was replaced by a
    // single pulsing plate until the chunk landed, on every cold load.
    expect(screen.getByRole('navigation', { name: /sidebar navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByText('DSA Roadmap')).toBeInTheDocument();
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
