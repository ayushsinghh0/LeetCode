import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { MobileNav } from '@/components/layout/MobileNav';

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
