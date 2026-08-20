import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import ContestPracticePage from '@/pages/ContestPracticePage';
import { makeStore } from '@/store/store';
import { logDrillResult, solveQuestion, startFilteredContest } from '@/store/actions';
import { contestProblemSolved } from '@/store/slices/contestLibrarySlice';
import { CONTEST_PROBLEMS } from '@/data/contestLibrary';
import { RATING_BANDS, ratingBand } from '@/utils/engine/contestLibrary';
import type { ContestLibraryProblem } from '@/types';

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

  test('the weak-areas draw and recreation are refused while a sitting runs — a live contest is a commitment', () => {
    const store = makeStore();
    store.dispatch(logDrillResult(6, 8, ['two-pointers', 'two-pointers']));
    // A live sitting seeded through the one mutation API, exactly as a real draw starts one.
    store.dispatch(
      startFilteredContest(
        [
          {
            id: -1,
            kind: 'library',
            slug: 'some-live-problem',
            title: 'Some Live Problem',
            url: 'https://leetcode.com/problems/some-live-problem/',
            difficulty: 'easy',
            targetMinutes: 14,
            patterns: [],
            contestLabel: null,
            contestRating: 1400,
            frontendId: 9999,
            premium: false,
            reasons: [],
          },
        ],
        'live-seed',
      ),
    );

    renderWithStore(<ContestPracticePage />, store, '/contest-practice');

    expect(screen.getByRole('button', { name: /Start contest/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Weak-areas contest' })).toBeDisabled();

    const first = byDisplayOrder[0]!;
    const summary = screen
      .getAllByText(first.title)
      .map((el) => el.closest('summary'))
      .find(Boolean)!;
    fireEvent.click(summary);
    expect(
      within(summary.closest('details')!).getByRole('button', { name: 'Recreate this contest' }),
    ).toBeDisabled();
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

describe('ContestPracticePage — the weak-areas contest (slice 7)', () => {
  test('without weakness evidence the draw is offered but disabled — it fails toward silence', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');
    expect(screen.getByRole('button', { name: 'Weak-areas contest' })).toBeDisabled();
  });

  test('with weakness evidence it draws from the weak patterns, and says why per problem', () => {
    const store = makeStore();
    // Two recognition misses on one pattern — the one weakness model's minimum evidence
    // (MIN_OBSERVATIONS = 2). Weakness resolves at the page's call site via selectPatternWeakness.
    store.dispatch(logDrillResult(6, 8, ['two-pointers', 'two-pointers']));
    renderWithStore(<ContestPracticePage />, store, '/contest-practice');

    fireEvent.click(screen.getByRole('button', { name: 'Weak-areas contest' }));

    const contest = store.getState().contest;
    expect(contest.seed).not.toBeNull();
    expect(contest.libraryProblems).toHaveLength(4);
    for (const row of contest.libraryProblems!) {
      // Only a confident (exact/strong) mapping may satisfy the weak-pattern filter.
      expect(row.patterns).toContain('two-pointers');
      // The stated reason is the actual selection reason: the weak pattern the problem carries,
      // then the one weakness model's own sentence — never a tag unrelated to the draw.
      expect(row.reasons[0]).toBe('Two Pointers');
      expect(row.reasons[1]).toBe('In a pattern your recent evidence says is not holding');
    }
  });

  test('the weak draw is scoped by evidence, not by the page filters', () => {
    const store = makeStore();
    store.dispatch(logDrillResult(6, 8, ['two-pointers', 'two-pointers']));
    renderWithStore(<ContestPracticePage />, store, '/contest-practice');

    fireEvent.change(searchInput(), { target: { value: 'zzzz nothing matches this' } });
    expect(resultCount()).toHaveTextContent('0 matching problems');

    const weakButton = screen.getByRole('button', { name: 'Weak-areas contest' });
    expect(weakButton).toBeEnabled();
    fireEvent.click(weakButton);
    expect(store.getState().contest.libraryProblems).toHaveLength(4);
  });
});

describe('ContestPracticePage — Recreate contest (slice 7)', () => {
  // Data-driven off the real dataset: a contest holding both a bridged and a library-only member
  // exercises both halves of the id rule in one sitting.
  const byContest = new Map<string, ContestLibraryProblem[]>();
  for (const p of CONTEST_PROBLEMS) {
    const list = byContest.get(p.contest.slug);
    if (list) list.push(p);
    else byContest.set(p.contest.slug, [p]);
  }
  const mixed = [...byContest.values()].find(
    (members) =>
      members.some((m) => m.curriculumQuestionId !== null) &&
      members.some((m) => m.curriculumQuestionId === null),
  )!;

  function recreateFromRow(title: string) {
    fireEvent.change(searchInput(), { target: { value: title } });
    const summary = screen
      .getAllByText(title)
      .map((el) => el.closest('summary'))
      .find(Boolean)!;
    fireEvent.click(summary);
    // jsdom keeps closed <details> queryable, so the click is scoped to the expanded row.
    fireEvent.click(
      within(summary.closest('details')!).getByRole('button', { name: 'Recreate this contest' }),
    );
  }

  test('recreates one contest in its original Q-order, solved rows included', () => {
    expect(mixed).toBeDefined();
    const store = makeStore();
    const bridged = mixed.find((m) => m.curriculumQuestionId !== null)!;
    // Already solved — and still in the recreation: a recreation is the whole contest, not the
    // unsolved remainder of one. Both solve paths are idempotent, so nothing can be farmed.
    store.dispatch(solveQuestion(bridged.curriculumQuestionId!));

    renderWithStore(<ContestPracticePage />, store, '/contest-practice');
    recreateFromRow(bridged.title);

    const rows = store.getState().contest.libraryProblems!;
    const expected = [...mixed].sort((a, b) => a.contest.index - b.contest.index);
    expect(rows.map((r) => r.slug)).toEqual(expected.map((m) => m.slug));
    for (const [i, row] of rows.entries()) {
      const member = expected[i]!;
      if (member.curriculumQuestionId !== null) {
        // One problem, one identity — the bridged row keeps its curriculum id.
        expect(row.id).toBe(member.curriculumQuestionId);
        expect(row.kind).toBe('curriculum');
      } else {
        // A library-only row gets a sitting-local NEGATIVE key (the ID trap).
        expect(row.id).toBeLessThan(0);
        expect(row.kind).toBe('library');
      }
    }
    expect(rows.some((r) => r.slug === bridged.slug)).toBe(true);
  });

  test('a five-problem contest recreates all five — recreation is never capped at the draw size', () => {
    const five = [...byContest.values()].find((members) => members.length === 5)!;
    expect(five).toBeDefined();

    const store = makeStore();
    renderWithStore(<ContestPracticePage />, store, '/contest-practice');
    recreateFromRow(five[0]!.title);

    expect(store.getState().contest.libraryProblems).toHaveLength(5);
  });
});

describe('ContestPracticePage — the band reading (slice 7)', () => {
  test('below the evidence minimum the page stays silent about bands', () => {
    renderWithStore(<ContestPracticePage />, makeStore(), '/contest-practice');
    expect(screen.queryByText(/You solved problems around/)).not.toBeInTheDocument();
    expect(screen.queryByText(/rated outcomes/)).not.toBeInTheDocument();
  });

  test('enough contest practice earns a reading, and one tap applies the band filter', () => {
    const store = makeStore();
    // Four clean solves in the 1400–1599 band — the conservative step up is 1600–1799. Evidence
    // is the slug register only: contest practice, never curriculum solves.
    const inBand = CONTEST_PROBLEMS.filter(
      (p) => p.curriculumQuestionId === null && ratingBand(p.contestRating).id === '1400',
    ).slice(0, 4);
    expect(inBand).toHaveLength(4);
    for (const p of inBand) {
      store.dispatch(contestProblemSolved({ slug: p.slug, date: '2026-07-29' }));
    }

    renderWithStore(<ContestPracticePage />, store, '/contest-practice');

    expect(
      screen.getByText(/You solved problems around the 1400–1599 band\. 1600–1799 is the next step up\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/From 4 rated outcomes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter to 1600–1799' }));

    const expected = CONTEST_PROBLEMS.filter(
      (p) => ratingBand(p.contestRating).id === '1600',
    ).length;
    expect(resultCount()).toHaveTextContent(`${NUM.format(expected)} matching`);
    expect(
      within(screen.getByRole('group', { name: 'Rating' })).getByRole('button', {
        name: '1600–1799',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Once the filter already points there, the offer would be noise — it goes away.
    expect(screen.queryByRole('button', { name: 'Filter to 1600–1799' })).not.toBeInTheDocument();
  });
});
