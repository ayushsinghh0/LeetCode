import { NavLink } from 'react-router-dom';
import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToday } from '@/hooks/useToday';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectLevelInfo, selectStreaks } from '@/store/selectors';
import { searchOpenSet } from '@/store/slices/uiSlice';
import { NAV_ITEMS } from '@/components/layout/navItems';
import { LevelRing } from '@/components/gamification/LevelRing';
import { StreakFlame } from '@/components/gamification/StreakFlame';

export function Sidebar() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const levelInfo = useAppSelector(selectLevelInfo);
  const streaks = useAppSelector((state) => selectStreaks(state, today));

  return (
    <aside className="hidden shrink-0 flex-col gap-4 border-r border-border p-3 md:flex md:w-16 lg:w-60">
      {/* The wordmark has 24px of usable width in the 64px icon rail (w-16 − p-3 − px-2), which
          rendered "DSA Roadmap" as "D…". Below lg it keeps its accessible name and gives up its
          pixels; the rail's identity is the ink-marked active tab, not a clipped title. */}
      <div className="px-2 py-1 font-serif text-lg font-semibold tracking-tight">
        <span className="sr-only lg:not-sr-only lg:block lg:truncate">DSA Roadmap</span>
      </div>

      <button
        type="button"
        aria-label="Search and commands (Ctrl+K)"
        onClick={() => dispatch(searchOpenSet(true))}
        className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-swift hover:bg-muted hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </button>

      <nav aria-label="Sidebar navigation" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {/* sr-only below lg (not display:none): in the 64px icon-only rail each link keeps
                its accessible name instead of becoming an unlabeled icon. */}
            <span className="sr-only lg:not-sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* A rail does not need a plate inside it. This was a `.glass` box holding a 40px ring — a
          56px bordered rectangle drawn inside an already-bordered column, i.e. a plate that had
          not earned itself (DESIGN.md § Composition). It is now the same hairline the rest of the
          document uses to rule off a block. */}
      {/* No horizontal padding below lg: the rail leaves exactly 40px of content width, which is
          exactly the ring's diameter. */}
      <div className="flex items-center justify-center gap-2 border-t border-border pt-3 lg:justify-start lg:px-2">
        <LevelRing level={levelInfo.level} intoLevel={levelInfo.intoLevel} needed={levelInfo.needed} size={40} />
        <span className="hidden lg:inline">
          <StreakFlame current={streaks.current} />
          {/* The flame is aria-hidden, so the count alone read as a bare number. */}
          <span className="sr-only"> day streak</span>
        </span>
      </div>
    </aside>
  );
}
