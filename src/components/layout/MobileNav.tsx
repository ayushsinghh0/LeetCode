import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppDispatch } from '@/store/hooks';
import { searchOpenSet } from '@/store/slices/uiSlice';
import { NAV_ITEMS } from '@/components/layout/navItems';

const PRIMARY_ITEMS = NAV_ITEMS.filter((item) => item.mobile === 'primary');
const MORE_ITEMS = NAV_ITEMS.filter((item) => item.mobile === 'more');

// The registry allows exactly five primary tabs, and "More" was silently taking a sixth equal
// share of the same bar: at 375px the plate is 359px wide, so six `flex-1` slots got 58.5px each
// and "Dashboard" ellipsised to "Dashboa…". More is not a tab — it is the utility that opens the
// rest of the app — so it now takes a fixed 44px slot (the WCAG-comfortable minimum, and enough
// for its own four-letter label) behind a hairline, and the five real tabs share what is left:
// 355 − 44 − 5 (hairline + its margins) = 306px, i.e. 61.2px per tab, 57.2px inside the tab's own
// padding, against ~51px for "Dashboard" at 11px medium (~53px at the active tab's semibold).
// `truncate` stays as the guard for 320px phones.
const TAB_CLASS =
  'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[11px] leading-tight transition-colors duration-150 ease-swift active:scale-[0.97]';

// The active tab is an ink icon over a foreground, semibold label — not a filled block. The solid
// ink pill this replaces was, alongside the sidebar's, the loudest object on every phone screen,
// and it spent the ink budget that belongs to the page's own primary action (DESIGN.md § Adding a
// New Surface #4). State survives the fill's removal on three independent carriers: NavLink's own
// `aria-current="page"`, the icon inking, and the medium → semibold weight step, so neither
// assistive tech nor a reader who cannot separate the hues loses the answer to "where am I".
const TAB_STATE = (isActive: boolean) =>
  isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground';

export function MobileNav() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);

  // No physical keyboard below md, so Ctrl/Cmd+K is unreachable there — this is the only mobile
  // entry point into SearchDialog. Closes the "More" sheet itself before opening search so the
  // two overlays never stack.
  function openSearch() {
    setOpen(false);
    dispatch(searchOpenSet(true));
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="glass fixed inset-x-2 bottom-2 z-40 flex items-center px-0.5 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {PRIMARY_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                TAB_CLASS,
                // basis-0 + min-w-0: equal shares regardless of label length, and truncation is
                // allowed to kick in on very narrow phones instead of overflowing the plate.
                'min-w-0 flex-1 basis-0',
                TAB_STATE(isActive),
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-colors duration-150 ease-swift',
                    isActive && 'text-primary',
                  )}
                  aria-hidden="true"
                />
                <span className="w-full truncate text-center">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* The hairline that says "the tabs stop here". Same idiom as Ledger's column rules. */}
        <span aria-hidden="true" className="mx-0.5 h-8 w-px shrink-0 bg-border" />

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(TAB_CLASS, 'w-11 shrink-0', TAB_STATE(false))}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="w-full truncate text-center">More</span>
        </button>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openSearch}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors duration-150 ease-swift hover:bg-muted hover:text-foreground"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              Search
            </button>
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-150 ease-swift',
                    // The same margin mark the sidebar uses, for the same reason — the sheet lists
                    // the identical routes, so it must not answer "where am I" in a second dialect.
                    isActive
                      ? 'border-primary font-semibold text-foreground'
                      : 'border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors duration-150 ease-swift',
                        isActive && 'text-primary',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
