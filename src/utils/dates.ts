// Hand-rolled day-level ISO date math. date-fns stays available to the lazy routes (calendar
// grids, rich display formats), but these helpers sit in the eager graph — the engine and the
// shell reach them — and importing date-fns's format/parseISO here was pulling ~40 kB of
// minified formatting machinery into the main chunk for what is, at day granularity, a few
// lines of Date arithmetic.

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const todayISO = (): string => toISODate(new Date());

// Local midnight for a 'yyyy-MM-dd' string — matches date-fns parseISO on date-only input.
// (`new Date('yyyy-MM-dd')` would be UTC midnight, i.e. yesterday evening west of Greenwich.)
const fromISODate = (iso: string): Date =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export const addDays = (iso: string, n: number): string => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// a - b in whole calendar days. Both operands are local midnights, so the raw millisecond
// difference is a whole number of days give or take a DST hour — Math.round absorbs it.
export const diffDays = (a: string, b: string): number =>
  Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000);
