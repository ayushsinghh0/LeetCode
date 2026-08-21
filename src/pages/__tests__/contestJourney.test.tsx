import { Route, Routes } from 'react-router-dom';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import PatternDetailPage from '@/pages/PatternDetailPage';
import ContestPracticePage from '@/pages/ContestPracticePage';
import ContestPage from '@/pages/ContestPage';
import { makeStore } from '@/store/store';
import { startFilteredContest } from '@/store/actions';
import type { FilteredContestProblem } from '@/store/slices/contestSlice';
import { CONTEST_PROBLEMS } from '@/data/contestLibrary';

// The §63 acceptance journey, end to end through the real router: pattern page CTA → the Contest
// Library with the filter already applied → Start contest → a filtered sitting running on
// ContestPage with canonical links → finish → the verdict, with the inconclusive suppression
// intact. Store-level routing/evidence claims live in store/__tests__/contestFiltered.test.ts.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderJourney(initialPath: string, store = makeStore()) {
  return renderWithStore(
    <Routes>
      <Route path="/patterns/:patternId" element={<PatternDetailPage />} />
      <Route path="/contest-practice" element={<ContestPracticePage />} />
      <Route path="/contest" element={<ContestPage />} />
    </Routes>,
    store,
    initialPath,
  );
}

describe('the §63 journey: pattern → library → filtered contest → verdict', () => {
  test('walks end to end, with the filter pre-applied and the sitting drawn from it', () => {
    const { store } = renderJourney('/patterns/two-pointers');

    // 1. The pattern page offers contest practice — recommends, never gates.
    fireEvent.click(screen.getByRole('link', { name: 'Practice contest problems' }));

    // 2. The library opens with the pattern already applied.
    expect(screen.getByRole('heading', { name: 'Contest Library' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by pattern' })).toHaveTextContent(
      'Two Pointers',
    );

    // 3. Start draws a four-problem set from the filtered, unsolved pool.
    fireEvent.click(screen.getByRole('button', { name: /Start contest/ }));

    const contest = store.getState().contest;
    expect(contest.seed).not.toBeNull();
    expect(contest.libraryProblems).toHaveLength(4);
    for (const row of contest.libraryProblems!) {
      expect(row.patterns).toContain('two-pointers');
    }

    // 4. The sitting runs on ContestPage — the same clock, a different pool.
    const list = screen.getByRole('list', { name: 'Contest problems' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    // Canonical slug-built links, one per row.
    const links = within(list).getAllByRole('link', { name: /Open on LeetCode/ });
    expect(links).toHaveLength(4);
    for (const [i, link] of links.entries()) {
      expect(link).toHaveAttribute(
        'href',
        `https://leetcode.com/problems/${contest.libraryProblems![i]!.slug}/`,
      );
    }
    // Both signals ride each row, and the draw's reasons are one latch away (§45).
    expect(within(list).getAllByText(/^Contest rating \d+$/)).toHaveLength(4);
    expect(within(list).getAllByText('Why this problem?')).toHaveLength(4);

    // 5. Finishing an unattempted sitting is declared inconclusive and mined for nothing.
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(screen.getByText('0 of 4 solved')).toBeInTheDocument();
    expect(screen.getByText(/Too little of this set was genuinely attempted/)).toBeInTheDocument();
    expect(Object.keys(store.getState().contests.byDate)).toHaveLength(0);
  });

  test('the same day and filters rebuild the same set — the seeding promise holds', () => {
    const first = makeStore();
    const firstRender = renderJourney('/contest-practice?pattern=two-pointers', first);
    fireEvent.click(screen.getByRole('button', { name: /Start contest/ }));
    const firstSlugs = first.getState().contest.libraryProblems!.map((r) => r.slug);
    firstRender.unmount();

    const second = makeStore();
    renderJourney('/contest-practice?pattern=two-pointers', second);
    fireEvent.click(screen.getByRole('button', { name: /Start contest/ }));
    const secondSlugs = second.getState().contest.libraryProblems!.map((r) => r.slug);

    expect(secondSlugs).toEqual(firstSlugs);
  });

  test('a stalled library problem gets its calm second look on LeetCode, not the question sheet', () => {
    const store = makeStore();
    renderJourney('/contest-practice?pattern=two-pointers', store);
    // Scope the draw to contest-only rows: a bridged row's stall correctly opens the question
    // sheet and correctly banks a per-problem record, which is the OTHER path — this test pins
    // the library-only one.
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Source' })).getByRole('button', {
        name: 'Contest only',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Start contest/ }));

    // Put the first problem on the clock and let real time pass — a genuine stall. A second
    // problem gets time too, so at least half the set is informative and the sitting concludes.
    const rows = store.getState().contest.libraryProblems!;
    expect(rows.every((r) => r.kind === 'library')).toBe(true);
    const list = screen.getByRole('list', { name: 'Contest problems' });
    const clocks = within(list).getAllByRole('button', { name: /Put on the clock/ });
    fireEvent.click(clocks[0]!);
    vi.setSystemTime(new Date('2026-07-30T12:40:00'));
    fireEvent.click(within(list).getByRole('button', { name: /Pause/ }));
    fireEvent.click(within(list).getAllByRole('button', { name: /Put on the clock/ })[1]!);
    vi.setSystemTime(new Date('2026-07-30T13:20:00'));
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));

    // The verdict offers the stalled problems the honest second look: the external page.
    const secondLooks = screen.getAllByRole('link', { name: /Take a calm second look on LeetCode/ });
    expect(secondLooks.length).toBeGreaterThan(0);
    // And the evidence banked through the one channel, pattern-level only. The pattern list is
    // trimmed to `attempted` (a multi-pattern stall yields patterns, never inflates the count),
    // so the pin is subset-and-shape, not exact membership.
    const record = store.getState().contests.byDate['2026-07-30'];
    expect(record).toBeDefined();
    expect(record!.problems).toBeUndefined();
    expect(record!.stalledPatterns.length).toBeGreaterThan(0);
    expect(record!.stalledPatterns.length).toBeLessThanOrEqual(record!.attempted);
    const drawnPatterns = new Set<string>(rows.flatMap((r) => r.patterns));
    for (const p of record!.stalledPatterns) {
      expect(drawnPatterns.has(p)).toBe(true);
    }
    // The library problems drawn are real dataset rows (sanity: the pool is the dataset).
    for (const row of rows) {
      expect(CONTEST_PROBLEMS.some((p) => p.slug === row.slug)).toBe(true);
    }
  });
});

/**
 * V14 T7: a sitting row may be honestly unrated. Sheet-only problems carry no ZeroTrac estimate,
 * and the run page must render their absence as absence — never a zero, never an invented number.
 */
describe('an honestly unrated sitting row', () => {
  const sittingRow = (over: Partial<FilteredContestProblem>): FilteredContestProblem => ({
    id: -1,
    kind: 'library',
    slug: 'a-row',
    title: 'A Row',
    url: 'https://leetcode.com/problems/a-row/',
    difficulty: 'medium',
    targetMinutes: 25,
    patterns: [],
    contestLabel: null,
    contestRating: 1500,
    frontendId: 1234,
    premium: false,
    reasons: [],
    ...over,
  });

  test('renders title and difficulty without a rating line when contestRating is null', () => {
    const store = makeStore();
    store.dispatch(
      startFilteredContest(
        [
          sittingRow({ id: -1, slug: 'rated-row', title: 'Rated Row' }),
          sittingRow({ id: -2, slug: 'unrated-row', title: 'Unrated Row', contestRating: null }),
        ],
        '2026-07-30|test-seed',
      ),
    );
    renderJourney('/contest', store);

    const list = screen.getByRole('list', { name: 'Contest problems' });
    const items = within(list).getAllByRole('listitem');
    const unrated = items.find((el) => within(el).queryByText('Unrated Row') !== null)!;
    expect(unrated).toBeDefined();
    expect(within(unrated).getByText('Medium')).toBeInTheDocument();
    expect(within(unrated).queryByText(/Contest rating/)).not.toBeInTheDocument();

    // The rated row keeps both signals side by side, exactly as before.
    const rated = items.find((el) => within(el).queryByText('Rated Row') !== null)!;
    expect(within(rated).getByText('Contest rating 1500')).toBeInTheDocument();
  });
});
