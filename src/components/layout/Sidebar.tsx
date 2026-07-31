import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  GraduationCap,
  Shapes,
  RotateCcw,
  CalendarDays,
  BarChart3,
  Trophy,
  Bookmark,
  Settings,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectLevelInfo, selectStreaks } from '@/store/selectors';
import { searchOpenSet } from '@/store/slices/uiSlice';
import { LevelRing } from '@/components/gamification/LevelRing';
import { StreakFlame } from '@/components/gamification/StreakFlame';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
  { to: '/aiml', label: 'AI/ML', icon: GraduationCap },
  { to: '/patterns', label: 'Patterns', icon: Shapes },
  { to: '/revision', label: 'Revision', icon: RotateCcw },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const levelInfo = useAppSelector(selectLevelInfo);
  const streaks = useAppSelector((state) => selectStreaks(state, today));

  return (
    <aside className="hidden shrink-0 flex-col gap-4 border-r border-border p-3 md:flex md:w-16 lg:w-60">
      <div className="truncate px-2 py-1 font-serif text-lg font-semibold tracking-tight">DSA Roadmap</div>

      <button
        type="button"
        aria-label="Search questions (Ctrl+K)"
        onClick={() => dispatch(searchOpenSet(true))}
        className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-swift hover:bg-muted hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </button>

      <nav aria-label="Sidebar navigation" className="flex flex-1 flex-col gap-1">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-swift',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="glass flex items-center justify-center gap-2 px-2 py-2 lg:justify-start">
        <LevelRing level={levelInfo.level} intoLevel={levelInfo.intoLevel} needed={levelInfo.needed} size={40} />
        <span className="hidden lg:inline">
          <StreakFlame current={streaks.current} />
        </span>
      </div>
    </aside>
  );
}
