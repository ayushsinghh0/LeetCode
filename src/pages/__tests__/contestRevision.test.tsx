import { screen, within, fireEvent } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import RevisionPage from '@/pages/RevisionPage';
import { solveQuestion } from '@/store/actions';
import { contestProblemSolved } from '@/store/slices/contestLibrarySlice';
import { MIN_BAND_EVIDENCE } from '@/utils/engine/contestLibrary';

/**
 * V13 slice 6 — Contest Revision, the second universe's half of `/revision`.
 *
 * Two things are on trial here and they pull in opposite directions. The new mode must actually
 * work — rank the library, grade a due problem onto the one 1/3/7/15/30 ladder, and read a band
 * only when the evidence supports one. And Standard must be exactly what it was: `revision.test.tsx`
 * (30 tests, unmodified) is the real proof of that, and the first test below is its sentry.
 */

// Contest-only fixtures, read off the generated dataset. Both are `medium`, so a graded review is
// worth revisionXp('medium') = 10.
const LIB_SLUG = 'steps-to-make-array-non-decreasing';
const LIB_TITLE = 'Steps to Make Array Non-decreasing';
const OTHER_SLUGS = [
  'longest-subsequence-with-decreasing-adjacent-difference',
  'find-the-lexicographically-smallest-valid-sequence',
  'kth-smallest-product-of-two-sorted-arrays',
];

// A BRIDGED fixture: curriculum question 264 IS contest problem `collect-coins-in-a-tree`. Its
// progress lives in `progress.byId` and must never gain a second copy in the slug register.
const BRIDGED_QUESTION_ID = 264;
const BRIDGED_TITLE = 'Collect Coins in a Tree';

afterEach(() => {
  vi.useRealTimers();
});

/**
 * `shouldAdvanceTime`, and it is load-bearing rather than decorative.
 *
 * Contest Revision is mounted through `React.lazy`, so every test here has to `await` a query —
 * and Testing Library only detects *Jest's* fake timers (`helpers.js`: `typeof jest !== 'undefined'`).
 * Under a plain `vi.useFakeTimers()` its `waitFor` polls with a mocked `setInterval` that nothing
 * ever advances, and the suite deadlocks instead of failing. Letting the mocked clock advance with
 * real time keeps the system date pinned — which is all these tests need it for — while leaving
 * the polling alive.
 */
function useClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
}

function setDate(iso: string) {
  vi.setSystemTime(new Date(`${iso}T12:00:00`));
}

/** Switch the page into one of the contest pools and wait for the lazy chunk to mount. */
async function chooseMode(name: 'Contest' | 'Weak areas' | 'Pattern') {
  const modes = screen.getByRole('radiogroup', { name: 'Revision mode' });
  fireEvent.click(within(modes).getByRole('radio', { name }));
  // A generous timeout, not a weaker assertion — the same treatment `questionCard.test.tsx`
  // documents for its markdown preview. This awaits a `lazy()` boundary whose chunk also decodes
  // 2,561 records on first import, and under full-suite load that occasionally overran the 1s
  // default while passing comfortably in isolation.
  return screen.findByRole('heading', { name: 'Due now' }, { timeout: 5000 });
}

describe('RevisionPage — the mode selector is additive', () => {
  test('Standard is the default, and choosing it changes nothing about the page', () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    setDate('2026-07-31'); // the solve's first rung, so the standard session has work to preview

    renderWithStore(<RevisionPage />, store);

    const modes = screen.getByRole('radiogroup', { name: 'Revision mode' });
    expect(within(modes).getByRole('radio', { name: 'Standard' })).toBeChecked();
    // The standard flow's own entry point, untouched beneath the new control.
    expect(
      screen.getByRole('radiogroup', { name: 'How long have you got?' }),
    ).toBeInTheDocument();
  });

  test('the chips step aside once a session is running — a session is a commitment', () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    setDate('2026-07-31');

    renderWithStore(<RevisionPage />, store);
    expect(screen.getByRole('radiogroup', { name: 'Revision mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    // Switching pools mid-sitting would reshuffle the very thing the frozen plan exists to hold
    // still, so the control is not offered until the session ends.
    expect(screen.queryByRole('radiogroup', { name: 'Revision mode' })).not.toBeInTheDocument();
  });
});

describe('Contest Revision — the pool, and what it claims', () => {
  test('with nothing on the contest ladder, "Due now" says so instead of manufacturing a queue', async () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    expect(screen.getByText(/Nothing on the contest ladder has come due/)).toBeInTheDocument();
    // Acquisition is still offered — labelled as practice, never as something owed.
    expect(screen.getByRole('heading', { name: 'Worth practising' })).toBeInTheDocument();
  });

  test('a due library problem is graded in place: the ladder moves and the review pays XP', async () => {
    useClock();
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: LIB_SLUG, date: '2026-07-30' }));
    setDate('2026-07-31');

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    const list = screen.getByRole('list', { name: 'Contest problems due for revision' });
    const row = within(list).getByText(LIB_TITLE).closest('li')!;
    const xpBefore = store.getState().gamification.xp;

    fireEvent.click(within(row).getByRole('button', { name: 'Recalled it' }));

    const after = store.getState().contestLibrary.bySlug[LIB_SLUG]!;
    expect(after.revisionStage).toBe(1);
    expect(after.lastReviewed).toBe('2026-07-31');
    expect(after.revisionHistory).toEqual([{ date: '2026-07-31', passed: true }]);
    // revisionXp('medium') — half a solve, paid pass or fail.
    expect(store.getState().gamification.xp - xpBefore).toBe(10);
    // The day log is the CURRICULUM's ledger; library work never writes into it.
    expect(store.getState().progress.dayLogs['2026-07-31']).toBeUndefined();
  });

  test('the ladder takes one grade per day — a graded row states the fact instead of offering buttons', async () => {
    useClock();
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: LIB_SLUG, date: '2026-07-30' }));
    setDate('2026-07-31');

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    const list = screen.getByRole('list', { name: 'Contest problems due for revision' });
    fireEvent.click(
      within(within(list).getByText(LIB_TITLE).closest('li')!).getByRole('button', {
        name: 'Recalled it',
      }),
    );

    const row = within(list).getByText(LIB_TITLE).closest('li')!;
    expect(within(row).getByText(/Reviewed today/)).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Recalled it' })).not.toBeInTheDocument();
    // Offering a control that records nothing is the app reporting work that did not happen.
    expect(store.getState().contestLibrary.bySlug[LIB_SLUG]!.revisionHistory).toHaveLength(1);
  });

  test('the due list is frozen for the sitting — a graded row does not vanish under the learner', async () => {
    useClock();
    const store = makeStore();
    for (const slug of [LIB_SLUG, ...OTHER_SLUGS.slice(0, 2)]) {
      store.dispatch(contestProblemSolved({ slug, date: '2026-07-30' }));
    }
    setDate('2026-07-31');

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    const list = screen.getByRole('list', { name: 'Contest problems due for revision' });
    expect(within(list).getAllByRole('button', { name: 'Recalled it' })).toHaveLength(3);
    const before = within(list).getAllByRole('listitem').length;

    fireEvent.click(
      within(within(list).getByText(LIB_TITLE).closest('li')!).getByRole('button', {
        name: 'Recalled it',
      }),
    );

    // Grading pushes the ladder date days out, so the live due query would drop this row, shrink
    // the count and jump the rows below it up. That is work vanishing as it is completed — the
    // reason Standard freezes its plan, and the reason this list freezes its membership.
    expect(within(list).getAllByRole('listitem')).toHaveLength(before);
    expect(within(list).getByText(LIB_TITLE)).toBeInTheDocument();
    expect(screen.getByText('3 problems')).toBeInTheDocument();
  });

  test('a bridged problem grades through its ONE curriculum record, never a second copy', async () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(BRIDGED_QUESTION_ID));
    const due = store.getState().progress.byId[BRIDGED_QUESTION_ID]!.nextRevision!;
    setDate(due);

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    const list = screen.getByRole('list', { name: 'Contest problems due for revision' });
    const row = within(list).getByText(BRIDGED_TITLE).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Recalled it' }));

    expect(store.getState().progress.byId[BRIDGED_QUESTION_ID]!.revisionStage).toBe(1);
    // The ID trap's product-level form: one problem, one identity. The slug register must stay
    // empty — a second copy is a record that can disagree with the first.
    expect(store.getState().contestLibrary.bySlug['collect-coins-in-a-tree']).toBeUndefined();
  });
});

describe('Contest Revision — the band reading is conservative and never about the learner', () => {
  function solveN(store: AppStore, n: number) {
    const slugs = [LIB_SLUG, ...OTHER_SLUGS];
    for (let i = 0; i < n; i++) {
      store.dispatch(contestProblemSolved({ slug: slugs[i]!, date: '2026-07-01' }));
    }
  }

  test('below the stated minimum it says how far short the evidence is, and reads no band', async () => {
    useClock();
    setDate('2026-08-20');
    const store = makeStore();
    solveN(store, MIN_BAND_EVIDENCE - 1);

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    expect(
      screen.getByText(`${MIN_BAND_EVIDENCE - 1} of ${MIN_BAND_EVIDENCE} rated outcomes so far — not enough to suggest a band.`),
    ).toBeInTheDocument();
  });

  test('at the minimum it reads a band, states its sample size, and describes the PROBLEMS', async () => {
    useClock();
    setDate('2026-08-20');
    const store = makeStore();
    solveN(store, MIN_BAND_EVIDENCE);

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    const band = screen.getByRole('heading', { name: 'Your band' }).closest('section')!;
    // §31: the sentence is about the band of problems that went well, never a rating claimed for
    // the learner. The sample size travels with it, always.
    expect(within(band).getByText(/You solved problems around the/)).toBeInTheDocument();
    expect(within(band).getByText(`From ${MIN_BAND_EVIDENCE} rated outcomes`)).toBeInTheDocument();
    expect(within(band).queryByText(/your rating|Your rating/)).not.toBeInTheDocument();
  });

  test('with no contest practice at all it reads nothing rather than reading the curriculum', async () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();
    // Twenty curriculum solves — several of them rated contest problems. They are done with the
    // roadmap's guidance and no clock, so they are deliberately NOT band evidence.
    for (let id = 1; id <= 20; id++) store.dispatch(solveQuestion(id));

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Contest');

    expect(
      screen.getByText('No contest practice recorded yet, so there is no band to read.'),
    ).toBeInTheDocument();
  });
});

describe('Contest Revision — weak areas fails toward silence', () => {
  test('with nothing saying a pattern is not holding, it says exactly that', async () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();

    renderWithStore(<RevisionPage />, store);
    await chooseMode('Weak areas');

    // Weakness is claimed in exactly one place. Where that one place has no evidence, the surface
    // says so rather than picking a pattern to show.
    expect(screen.getByText(/Nothing yet says a pattern is not holding/)).toBeInTheDocument();
  });
});

describe('Contest Revision — pattern mode asks before it answers', () => {
  test('with no pattern chosen it invites the choice instead of ranking everything', async () => {
    useClock();
    setDate('2026-07-30');
    const store = makeStore();

    renderWithStore(<RevisionPage />, store);
    const modes = screen.getByRole('radiogroup', { name: 'Revision mode' });
    fireEvent.click(within(modes).getByRole('radio', { name: 'Pattern' }));

    expect(
      await screen.findByText(/Choose a pattern and the library will rank/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Due now' })).not.toBeInTheDocument();
  });
});
