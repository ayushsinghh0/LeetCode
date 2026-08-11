import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — pass them to every MemoryRouter (and to BrowserRouter in
// src/App.tsx) to keep test console output free of those warnings.
export const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

// Shared render harness for suites that mount UI against a real store. ThemeProvider is included
// for every suite deliberately (it reads settings and stamps a class on <html>) — harmless where
// it isn't needed, and it unifies the per-file helper variants this replaces.
export function renderWithStore(ui: ReactNode, store: AppStore = makeStore(), initialPath = '/') {
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter future={routerFutureFlags} initialEntries={[initialPath]}>
              {ui}
            </MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>
      </Provider>,
    ),
  };
}
