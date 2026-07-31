import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  RotateCcw,
  BarChart3,
  MoreHorizontal,
  GraduationCap,
  Shapes,
  CalendarDays,
  Trophy,
  Bookmark,
  Settings,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppDispatch } from '@/store/hooks';
import { searchOpenSet } from '@/store/slices/uiSlice';

interface MobileNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_ITEMS: MobileNavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
  { to: '/revision', label: 'Revision', icon: RotateCcw },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const MORE_ITEMS: MobileNavItem[] = [
  { to: '/aiml', label: 'AI/ML', icon: GraduationCap },
  { to: '/patterns', label: 'Patterns', icon: Shapes },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
];

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
        className="glass fixed inset-x-2 bottom-2 z-40 flex items-center justify-between px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {PRIMARY_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-swift active:scale-[0.97]',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-swift active:scale-[0.97]"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
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
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
