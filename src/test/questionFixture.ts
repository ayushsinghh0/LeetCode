import type { Question } from '@/types';

/**
 * The authored-intelligence half of a `Question`, for unit-test fixtures.
 *
 * Engine tests build tiny question arrays to exercise scheduling, stats, and planning — none of
 * which read `type` or `tests`. Spreading this keeps those fixtures honest about the shape
 * without making every test restate editorial content it does not care about. Tests that DO
 * assert on the intelligence layer set the fields explicitly instead.
 */
export const QF = {
  type: 'foundation',
  tests: 'A fixture sentence standing in for the authored capability statement.',
} satisfies Pick<Question, 'type' | 'tests'>;
