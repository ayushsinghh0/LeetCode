import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { MobileNav } from '@/components/layout/MobileNav';

// Below the md breakpoint there's no physical keyboard for Ctrl/Cmd+K, so the "More" sheet is
// the only mobile entry point into SearchDialog (see Sidebar's search button for the desktop
// equivalent).
describe('MobileNav', () => {
  test('the bar carries the five primary tabs and nothing else — "More" is a control beside them, not a sixth tab', () => {
    renderWithStore(<MobileNav />);

    const bar = screen.getByRole('navigation', { name: /mobile navigation/i });
    // Five links, in registry order, each keeping its whole label. The registry caps the bar at
    // five; letting "More" take an equal sixth share is what squeezed "Dashboard" into an
    // ellipsis, so it now sits in a fixed slot outside the shared width.
    expect(within(bar).getAllByRole('link').map((tab) => tab.textContent)).toEqual([
      'Dashboard',
      'Today',
      'Roadmap',
      'AI/ML',
      'Revision',
    ]);
    expect(within(bar).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  // Same removal as the sidebar's, and the same three carriers have to replace it: the bottom
  // bar's active tab was a solid ink block, which spent on navigation chrome the ink budget that
  // belongs to the page's own primary action.
  test('the active tab is marked for assistive tech and weighted, not filled', () => {
    renderWithStore(<MobileNav />, undefined, '/roadmap');

    const bar = screen.getByRole('navigation', { name: /mobile navigation/i });
    const active = within(bar).getByRole('link', { name: 'Roadmap' });
    const inactive = within(bar).getByRole('link', { name: 'Today' });

    expect(active).toHaveAttribute('aria-current', 'page');
    expect(inactive).not.toHaveAttribute('aria-current');
    expect(active.className).toContain('font-semibold');
    expect(inactive.className).toContain('font-medium');
    expect(active.className).not.toContain('bg-primary');
  });

  test('the "More" control describes the sheet it opens', () => {
    renderWithStore(<MobileNav />);

    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    expect(more).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
  });

  test('the "More" sheet includes a Search entry that dispatches searchOpenSet(true) and closes the sheet', () => {
    const { store } = renderWithStore(<MobileNav />);

    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(store.getState().ui.searchOpen).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
