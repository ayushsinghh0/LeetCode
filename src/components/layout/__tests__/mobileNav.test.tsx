import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MobileNav } from '@/components/layout/MobileNav';

const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderWithStore(ui: ReactNode, store: AppStore = makeStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter future={routerFutureFlags}>{ui}</MemoryRouter>
        </TooltipProvider>
      </Provider>,
    ),
  };
}

// Below the md breakpoint there's no physical keyboard for Ctrl/Cmd+K, so the "More" sheet is
// the only mobile entry point into SearchDialog (see Sidebar's search button for the desktop
// equivalent).
describe('MobileNav', () => {
  test('the "More" sheet includes a Search entry that dispatches searchOpenSet(true) and closes the sheet', () => {
    const { store } = renderWithStore(<MobileNav />);

    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(store.getState().ui.searchOpen).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
