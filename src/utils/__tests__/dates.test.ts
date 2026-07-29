import { addDays, diffDays, toISODate } from '@/utils/dates';

test('addDays crosses month boundaries', () => {
  expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});

test('diffDays is signed (a - b)', () => {
  expect(diffDays('2026-08-02', '2026-07-30')).toBe(3);
  expect(diffDays('2026-07-30', '2026-08-02')).toBe(-3);
});

test('toISODate formats', () => {
  expect(toISODate(new Date(2026, 6, 30))).toBe('2026-07-30');
});
