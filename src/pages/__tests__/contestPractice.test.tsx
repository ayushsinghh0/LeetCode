import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import ContestPracticePage from '@/pages/ContestPracticePage';
import { makeStore } from '@/store/store';
import { solveQuestion } from '@/store/actions';
import { contestProblemSolved } from '@/store/slices/contestLibrarySlice';
import { CONTEST_PROBLEMS } from '@/data/contestLibrary';
import { RATING_BANDS, ratingBand } from '@/utils/engine/contestLibrary';

// The Contest Library surface (V13 slice 4). These tests are data-driven off the real dataset —
// no magic counts that rot when the snapshots are refreshed.

const NUM = new Intl.NumberFormat('en-US');
const TOTAL = CONTEST_PROBLEMS.length;

/** Display order: rating ascending, slug tiebreak — the page's own deterministic sort. */
const byDisplayOrder = [...CONTEST_PROBLEMS].sort(
  (a, b) => a.contestRating - b.contestRating || a.slug.localeCompare(b.slug),
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function searchInput(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Search problem titles' });
}

/** The always-visible count line, scoped so a row's own figures can never satisfy the assertion. */
function resultCount(): HTMLElement {
  return screen.getByText(/matching problem/);
}

describe('ContestPracticePage — the library and its one filter system', () => {
  test('renders the whole pool with an always-visible result count', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');

    expect(screen.getByRole('heading', { name: 'Contest Library' })).toBeInTheDocument();
    expect(resultCount()).toHaveTextContent(`${NUM.format(TOTAL)} matching problems`);
    // No filter active, so no clear affordance to press.
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  test('the fold paints a bounded slice while the count stays whole-result truth', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');

    const list = screen.getByRole('list', { name: 'Contest problems' });
    // 50 problem rows plus the fold row itself.
    expect(within(list).getAllByRole('listitem')).toHaveLength(51);
    expect(screen.getByText(`${NUM.format(TOTAL - 50)} remaining`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show 150 more/ }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(201);
  });

  test('?pattern= preselects the filter, which is the journey the pattern CTA depends on', () => {
    const expected = CONTEST_PROBLEMS.filter((p) => p.aicmPatterns.includes('two-pointers')).length;
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice?pattern=two-pointers');

    expect(screen.getByRole('combobox', { name: 'Filter by pattern' })).toHaveTextContent(
      'Two Pointers',
    );
    expect(resultCount()).toHaveTextContent(`${NUM.format(expected)} matching`);

    // Clearing removes the preselected pattern AND its query param, so it cannot come back on
    // its own — a cleared filter stays cleared.
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(resultCount()).toHaveTextContent(`${NUM.format(TOTAL)} matching problems`);
    expect(screen.getByRole('combobox', { name: 'Filter by pattern' })).toHaveTextContent(
      'All Patterns',
    );
  });

  test('an unknown ?pattern= is ignored rather than filtering to nothing', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice?pattern=not-a-pattern');
    expect(resultCount()).toHaveTextContent(`${NUM.format(TOTAL)} matching problems`);
  });

  test('an empty result keeps the filters and suggests the loosening that would help', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');

    fireEvent.change(searchInput(), { target: { value: 'zzzz no such contest problem' } });

    expect(resultCount()).toHaveTextContent('0 matching problems');
    expect(screen.getByText('No matching contest problems.')).toBeInTheDocument();
    expect(screen.getByText('Try a shorter search.')).toBeInTheDocument();
    // The learner's filter survives the empty state — nothing was reset for them.
    expect(searchInput()).toHaveValue('zzzz no such contest problem');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(searchInput()).toHaveValue('');
    expect(resultCount()).toHaveTextContent(`${NUM.format(TOTAL)} matching problems`);
  });

  test('a rating-band dead end names the rating range — and only because widening it would help', () => {
    // Data-driven dead end: a pattern that has problems, and a band where it has none. The hint
    // is verified against the pool, so the suggested loosening must actually produce results.
    const bandsByPattern = new Map<string, Set<string>>();
    for (const p of CONTEST_PROBLEMS) {
      for (const id of p.aicmPatterns) {
        if (!bandsByPattern.has(id)) bandsByPattern.set(id, new Set());
        bandsByPattern.get(id)!.add(ratingBand(p.contestRating).id);
      }
    }
    let deadEnd: { pattern: string; bandLabel: string } | null = null;
    for (const [pattern, bands] of bandsByPattern) {
      const missing = RATING_BANDS.find((b) => !bands.has(b.id));
      if (missing) {
        deadEnd = { pattern, bandLabel: missing.label };
        break;
      }
    }
    expect(deadEnd).not.toBeNull();

    renderWithStore(
      <ContestPracticePage />,
      makeStore(),
      `/contest-practice?pattern=${deadEnd!.pattern}`,
    );
    const rating = screen.getByRole('group', { name: 'Rating' });
    fireEvent.click(within(rating).getByRole('button', { name: deadEnd!.bandLabel }));

    expect(screen.getByText('No matching contest problems.')).toBeInTheDocument();
    expect(screen.getByText('Try widening the rating range.')).toBeInTheDocument();
  });

  test('rows expand to a detail carrying the canonical slug-built LeetCode link', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');

    const first = byDisplayOrder[0]!;
    const links = screen.getAllByRole('link', { name: 'Open on LeetCode →' });
    // First painted row is the lowest-rated problem, and its link is built from the slug.
    expect(links[0]).toHaveAttribute('href', `https://leetcode.com/problems/${first.slug}/`);
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');

    const summary = screen
      .getAllByText(first.title)
      .map((el) => el.closest('summary'))
      .find(Boolean)!;
    const details = summary.closest('details')!;
    expect(details.hasAttribute('open')).toBe(false);
    fireEvent.click(summary);
    expect(details.hasAttribute('open')).toBe(true);
  });

  test('an unmapped problem claims no pattern, and a heuristic one is labelled inferred', () => {
    const unmapped = CONTEST_PROBLEMS.find(
      (p) => p.aicmPatterns.length === 0 && p.inferredPatterns.length === 0,
    )!;
    const inferred = CONTEST_PROBLEMS.find(
      (p) => p.aicmPatterns.length === 0 && p.inferredPatterns.length > 0,
    )!;
    expect(unmapped).toBeDefined();
    expect(inferred).toBeDefined();

    const { unmount } = renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');
    fireEvent.change(searchInput(), { target: { value: unmapped.title } });
    expect(screen.getAllByText('Pattern mapping unavailable').length).toBeGreaterThan(0);
    unmount();

    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');
    fireEvent.change(searchInput(), { target: { value: inferred.title } });
    expect(screen.getAllByText(/Inferred pattern:/).length).toBeGreaterThan(0);
  });

  test('status reads both registers: the slug-keyed slice and the 207 bridge through progress.byId', () => {
    const contestOnly = CONTEST_PROBLEMS.find((p) => p.curriculumQuestionId === null)!;
    const bridged = CONTEST_PROBLEMS.find((p) => p.curriculumQuestionId !== null)!;

    const store = makeStore();
    // Solved TODAY so the ladder's next date is tomorrow — the row reads "Solved", not "Due".
    store.dispatch(contestProblemSolved({ slug: contestOnly.slug, date: '2026-07-30' }));
    store.dispatch(solveQuestion(bridged.curriculumQuestionId!));

    renderWithStore(<ContestPracticePage />, store, '/contest-practice');

    const status = screen.getByRole('group', { name: 'Status' });
    fireEvent.click(within(status).getByRole('button', { name: 'Solved' }));

    expect(resultCount()).toHaveTextContent('2 matching problems');
    expect(screen.getAllByText(contestOnly.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(bridged.title).length).toBeGreaterThan(0);
  });
});
