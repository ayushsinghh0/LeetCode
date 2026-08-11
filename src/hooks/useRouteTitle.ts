import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/layout/navItems';

const APP_NAME = 'DSA Roadmap';

function labelFor(pathname: string): string | null {
  const exact = NAV_ITEMS.find((item) => item.to === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith('/patterns/')) return 'Patterns';
  return null;
}

// Keeps the browser tab named after the current route ("Today · DSA Roadmap") so history,
// tab bars, and screen readers announce where you are. Driven by the same nav registry as
// the sidebar — a new route gets its title for free.
export function useRouteTitle(override?: string): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const label = override ?? labelFor(pathname);
    document.title = label && label !== 'Dashboard' ? `${label} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [pathname, override]);
}
