import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { MotionConfig } from 'framer-motion';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRoutes } from '@/App';
import { makeStore } from '@/store/store';
import { NAV_ITEMS } from '@/components/layout/navItems';

// Integration smoke: every navigable route mounts inside the real shell, through the real lazy
// boundaries and providers. Unit tests render pages directly and so cannot catch a broken lazy
// import, a missing route entry, or a provider a page newly depends on.
//
// The chunk-resolution timeout is generous on purpose — several of these routes are lazy and
// resolve slowly under a fully parallel suite. It is patience, not a weaker assertion.
const CHUNK_TIMEOUT = 8000;

function renderRoute(path: string) {
  render(
    <Provider store={makeStore()}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </Provider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every navigable route mounts', () => {
  // Driven off the nav registry so a new route cannot ship without smoke coverage.
  test.each(NAV_ITEMS.map((item) => [item.label, item.to] as const))(
    '%s (%s) renders a heading',
    async (_label, to) => {
      renderRoute(to);
      const headings = await screen.findAllByRole('heading', undefined, { timeout: CHUNK_TIMEOUT });
      expect(headings.length).toBeGreaterThan(0);
    },
  );

  test('a company detail route renders its source plate', async () => {
    renderRoute('/companies/google');
    expect(
      await screen.findByRole('region', { name: 'Source' }, { timeout: CHUNK_TIMEOUT }),
    ).toBeInTheDocument();
  });

  test('a pattern detail route renders', async () => {
    renderRoute('/patterns/two-pointers');
    expect(
      await screen.findByRole('heading', { name: 'Two Pointers' }, { timeout: CHUNK_TIMEOUT }),
    ).toBeInTheDocument();
  });

  test('focus mode routes outside the shell, so the floating pomodoro cannot double-mount', async () => {
    renderRoute('/focus');
    const headings = await screen.findAllByRole('heading', undefined, { timeout: CHUNK_TIMEOUT });
    expect(headings.length).toBeGreaterThan(0);
    // The shell's nav is absent on this route by design.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('an unknown route falls through to the 404 rather than crashing the shell', async () => {
    renderRoute('/not-a-real-route');
    expect(
      await screen.findByRole('heading', undefined, { timeout: CHUNK_TIMEOUT }),
    ).toBeInTheDocument();
  });
});
