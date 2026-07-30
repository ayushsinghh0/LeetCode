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
  test('renders the Dashboard page and all 10 sidebar nav labels at "/"', async () => {
    renderApp(['/']);

    await screen.findByRole('heading', { name: 'Dashboard' });

    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });
    for (const label of SIDEBAR_LABELS) {
      expect(within(sidebarNav).getByText(label)).toBeInTheDocument();
    }
  });

  test('clicking Today in the sidebar navigates to the Today page', async () => {
    renderApp(['/']);
    await screen.findByRole('heading', { name: 'Dashboard' });

    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });
    fireEvent.click(within(sidebarNav).getByRole('link', { name: /today/i }));

    await screen.findByRole('heading', { name: 'Today' });
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
