import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  GraduationCap,
  Shapes,
  RotateCcw,
  Target,
  CalendarDays,
  BarChart3,
  Trophy,
  Bookmark,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Placement below md: one of the five bottom tabs, or the "More" sheet. */
  mobile: 'primary' | 'more';
}

// The one nav registry. Sidebar renders every item in order; MobileNav splits on `mobile`.
// Adding a route means adding a single entry here (and, if it should be reachable on phones
// first, choosing which primary tab it displaces — there is room for exactly five).
// Both learning tracks (Roadmap, AI/ML) are primary: phone check-ins are "what's due today,
// mark it done" for either track; Analytics is a desktop review surface and lives in More.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: 'primary' },
  { to: '/today', label: 'Today', icon: CalendarCheck, mobile: 'primary' },
  { to: '/roadmap', label: 'Roadmap', icon: Map, mobile: 'primary' },
  { to: '/aiml', label: 'AI/ML', icon: GraduationCap, mobile: 'primary' },
  { to: '/patterns', label: 'Patterns', icon: Shapes, mobile: 'more' },
  { to: '/revision', label: 'Revision', icon: RotateCcw, mobile: 'primary' },
  { to: '/drills', label: 'Drills', icon: Target, mobile: 'more' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, mobile: 'more' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, mobile: 'more' },
  { to: '/achievements', label: 'Achievements', icon: Trophy, mobile: 'more' },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark, mobile: 'more' },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: 'more' },
];
