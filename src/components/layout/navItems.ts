import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  GraduationCap,
  Shapes,
  Building2,
  RotateCcw,
  Target,
  Speech,
  Swords,
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
  /**
   * Placement in the desktop rail. `work` is the learning surfaces you move between all day;
   * `shelf` is the two you visit occasionally and would rather not scan past fifteen times a
   * session. The rail rules them off from each other rather than boxing either.
   *
   * This exists because the rail is now a fixed-height column — it cannot grow with the document
   * any more, so the order in it has to earn its space rather than simply continue downward.
   */
  group: 'work' | 'shelf';
}

// The one nav registry. Sidebar renders every item in order; MobileNav splits on `mobile`.
// Adding a route means adding a single entry here (and, if it should be reachable on phones
// first, choosing which primary tab it displaces — there is room for exactly five).
// Both learning tracks (Roadmap, AI/ML) are primary: phone check-ins are "what's due today,
// mark it done" for either track; Analytics is a desktop review surface and lives in More.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: 'primary' , group: 'work' },
  { to: '/today', label: 'Today', icon: CalendarCheck, mobile: 'primary' , group: 'work' },
  { to: '/roadmap', label: 'Roadmap', icon: Map, mobile: 'primary' , group: 'work' },
  { to: '/aiml', label: 'AI/ML', icon: GraduationCap, mobile: 'primary' , group: 'work' },
  { to: '/patterns', label: 'Patterns', icon: Shapes, mobile: 'more' , group: 'work' },
  { to: '/companies', label: 'Companies', icon: Building2, mobile: 'more' , group: 'work' },
  { to: '/revision', label: 'Revision', icon: RotateCcw, mobile: 'primary' , group: 'work' },
  { to: '/drills', label: 'Drills', icon: Target, mobile: 'more' , group: 'work' },
  // Interview mode is a desk-and-whiteboard ritual, not a phone check-in — hence 'more', and
  // hence its place next to Drills: both are rehearsal surfaces rather than progress ledgers.
  { to: '/interview', label: 'Interview', icon: Speech, mobile: 'more' , group: 'work' },
  // Contest closes the rehearsal cluster: Drills rehearse recognition, Interview rehearses the
  // ritual, Contest rehearses the clock. A timed sitting is a desk activity, hence 'more'.
  { to: '/contest', label: 'Contest', icon: Swords, mobile: 'more' , group: 'work' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, mobile: 'more' , group: 'work' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, mobile: 'more' , group: 'work' },
  { to: '/achievements', label: 'Achievements', icon: Trophy, mobile: 'more' , group: 'work' },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark, mobile: 'more' , group: 'shelf' },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: 'more' , group: 'shelf' },
];
