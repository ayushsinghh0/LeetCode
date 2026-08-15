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

  // p-3.5 is the system's row step (DESIGN.md § The rhythm); the old p-3 was a step that does not
  // exist. The icon rail widens from 4rem to 4.5rem to absorb it — 72 − 28 = 44px of content,
  // which still centres the 40px level ring and gives every nav row a 44px-wide hit target
  // instead of 40px.
  return (
    // `lg:w-52` (208px), down from `w-60` (240px). At exactly 1024px the rail jumps from 73px to
    // its full width, so a page's content box *narrows* by 167px the moment the viewport gets one
    // pixel wider — the worst number in the layout, and the reason a 1024 laptop had less room to
    // read in than a 1023 one. 208px still fits the longest label ("Achievements", ~90px) beside
    // its icon with room to spare, and hands 32px back to every screen at or above 1024.
    <aside className="hidden shrink-0 flex-col gap-4 border-r border-border p-3.5 md:flex md:w-[4.5rem] lg:w-52">
      {/* The wordmark has 28px of usable width in the 72px icon rail (w-[4.5rem] − p-3.5 − px-2),
          which rendered "DSA Roadmap" as "D…". Below lg it keeps its accessible name and gives up
          its pixels; the rail's identity is the ink-marked active tab, not a clipped title. */}
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

      {/* The active tab is a margin mark, not a filled block. A saturated ink pill the full width
          of the rail was the loudest object on all 18 pages — it out-weighed each page's own
          primary button, which is the one thing allowed to spend the ink budget (DESIGN.md
          § Adding a New Surface #4). The app's own active-state idiom is the ruled edge, so this
          is a 2px ink rail plus an ink icon and a weight step, and the fill is left to the
          capacity chips where DESIGN.md explicitly permits it.

          Three carriers, so no single one is load-bearing: `aria-current="page"` (NavLink writes
          it for free) for assistive tech, a border that is present-vs-absent rather than one hue
          vs another, and semibold-vs-medium text for anyone who reads neither. Every item carries
          the border at `transparent` so nothing shifts by 2px when it inks. Focus is the global
          `:focus-visible` outline in index.css and is untouched. */}
      <nav aria-label="Sidebar navigation" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-150 ease-swift',
                isActive
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} aria-hidden="true" />
                {/* sr-only below lg (not display:none): in the 72px icon-only rail each link keeps
                    its accessible name instead of becoming an unlabeled icon. */}
                <span className="sr-only lg:not-sr-only">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* A rail does not need a plate inside it. This was a `.glass` box holding a 40px ring — a
          56px bordered rectangle drawn inside an already-bordered column, i.e. a plate that had
          not earned itself (DESIGN.md § Composition). It is now the same hairline the rest of the
          document uses to rule off a block. */}
      {/* No horizontal padding below lg: the rail leaves 44px of content width and the ring is
          40px, so it centres with 2px either side. */}
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
