import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  RotateCcw,
  BarChart3,
  MoreHorizontal,
  Shapes,
  CalendarDays,
  Trophy,
  Bookmark,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  { to: '/patterns', label: 'Patterns', icon: Shapes },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="glass fixed inset-x-2 bottom-2 z-40 flex items-center justify-between px-1 py-2 md:hidden"
      >
        {PRIMARY_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium',
                isActive ? 'bg-accent-gradient text-white' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </button>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-accent-gradient text-white' : 'text-muted-foreground hover:text-foreground',
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
