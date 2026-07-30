import { useEffect, useState } from 'react';
import { todayISO } from '@/utils/dates';

const POLL_INTERVAL_MS = 60_000;

/**
 * The one sanctioned place UI derives "today". Returns todayISO(), memoized in state and
 * refreshed on a 60s interval so a page left open across midnight eventually notices the
 * date rolled over without needing a manual refresh.
 */
export function useToday(): string {
  const [today, setToday] = useState<string>(() => todayISO());

  useEffect(() => {
    const id = setInterval(() => {
      setToday(todayISO());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return today;
}
