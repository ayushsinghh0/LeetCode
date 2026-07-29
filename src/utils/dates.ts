import { addDays as dfAddDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd');
export const todayISO = (): string => toISODate(new Date());
export const addDays = (iso: string, n: number): string => toISODate(dfAddDays(parseISO(iso), n));
export const diffDays = (a: string, b: string): number =>
  differenceInCalendarDays(parseISO(a), parseISO(b)); // a - b in days
