import { act } from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { solveQuestion } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { MIN_SAMPLES } from '@/utils/engine/timeEstimate';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const byId = new Map(questions.map((q) => [q.id, q]));

// id 1  "Valid Palindrome"  — two-pointers / converging-ends, easy, mapped to a problem family,
//                             and one of the 528 questions with a verified LeetCode identity.
// id 2  "3Sum"              — same pattern and sub-pattern, but deliberately outside the family
//                             map: the honest-absence cases (no hint ladder, sub-pattern
//                             fallback) need a real dataset question, not a fixture.
const q1 = byId.get(1)!;
const q2 = byId.get(2)!;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

function openQuestion(id: number, store: AppStore = makeStore()) {
  const rendered = renderWithStore(<QuestionDetailModal />, store);
  act(() => {
    store.dispatch(activeQuestionSet(id));
  });
  // Radix mounts dialog content synchronously off the `open` prop — no polling needed (and
  // polling would hang under fake timers anyway).
  return { ...rendered, dialog: screen.getByRole('dialog') };
}

/** A store whose history contains `MIN_SAMPLES` timed two-pointers solves, each at half the book estimate. */
function storeWithPace(): AppStore {
  const timed: Record<number, QuestionProgress> = {};
  for (const id of [2, 3, 4, 5, 6]) {
    const q = byId.get(id)!;
    timed[id] = {
      ...initialProgress(),
      status: 'solved',
      completedAt: '2026-07-29',
      timeSpentMin: q.estimatedTime / 2,
    };
  }
  expect(Object.keys(timed)).toHaveLength(MIN_SAMPLES);
  return makeStore({ progress: { byId: timed, dayLogs: {}, startDate: '2026-07-01' } });
}

describe('the question header', () => {
  test('places the question in the course and says what it tests, before anything is attempted', () => {
    const { dialog } = openQuestion(1);
    // The masthead is one labelled group — scoping here is also the assertion that it *is* one.
    const header = within(dialog).getByRole('group', { name: 'Question summary' });

    // Chapter line: pattern, then the sub-pattern inside it.
    expect(within(header).getByText('Two Pointers')).toBeInTheDocument();
    expect(within(header).getByText('Converging from both ends')).toBeInTheDocument();

    expect(within(header).getByRole('heading', { name: 'Valid Palindrome' })).toBeInTheDocument();

    // One metadata line, not four plates.
    expect(within(header).getByText('Easy')).toBeInTheDocument();
    expect(within(header).getByText('Foundation')).toBeInTheDocument();
    expect(within(header).getByText(`~${q1.estimatedTime} min typical`)).toBeInTheDocument();

    expect(within(header).getByText('What this tests')).toBeInTheDocument();
    expect(within(header).getByText(q1.tests)).toBeInTheDocument();
  });

  test('the intended complexity stays hidden until the attempt is resolved', () => {
    const store = makeStore();
    const { dialog } = openQuestion(1, store);

    expect(within(dialog).queryByText(/O\(1\) space/)).not.toBeInTheDocument();

    act(() => {
      store.dispatch(solveQuestion(1));
    });

    expect(
      within(screen.getByRole('dialog')).getByText(
        `${q1.complexity!.time} time, ${q1.complexity!.space} space.`,
      ),
    ).toBeInTheDocument();
  });
});

describe('the time estimate', () => {
  test('with no timed history there is a typical figure and an honest silence — no personal claim', () => {
    const { dialog } = openQuestion(1);
    const header = within(dialog).getByRole('group', { name: 'Question summary' });

    expect(within(header).getByText(`~${q1.estimatedTime} min typical`)).toBeInTheDocument();
    expect(within(header).queryByText(/for you/)).not.toBeInTheDocument();
  });

  test(`at ${MIN_SAMPLES} comparable measurements it reports a personal figure AND what it was measured over`, () => {
    const { dialog } = openQuestion(1, storeWithPace());
    const header = within(dialog).getByRole('group', { name: 'Question summary' });

    // Every sample ran at half the book estimate, so the median pace ratio is 0.5.
    expect(within(header).getByText(`~${Math.round(q1.estimatedTime / 2)} min`)).toBeInTheDocument();
    expect(within(header).getByText(/your pace on this pattern, measured over/)).toBeInTheDocument();
    expect(within(header).getByText(String(MIN_SAMPLES))).toBeInTheDocument();
  });
});

describe('the resource panel', () => {
  test('offers exactly one external link — the question’s own verified LeetCode page', () => {
    const { dialog } = openQuestion(1);

    expect(within(dialog).getByText('Solve')).toBeInTheDocument();

    // The guard that matters: this repo verifies exactly one external identity per question
    // (see the closed-world rule in CLAUDE.md). Any second outbound link would be invented.
    const links = within(dialog).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', q1.url);
  });

  test('groups siblings by why they exist: Explore restates the idea, Practice bends it', () => {
    const { dialog } = openQuestion(1);

    expect(within(dialog).getByText('Explore')).toBeInTheDocument();
    expect(within(dialog).getByText(/same underlying technique, stated differently/i)).toBeInTheDocument();
    expect(
      within(within(dialog).getByRole('list', { name: 'Explore' })).getByText('Reverse Vowels of a String'),
    ).toBeInTheDocument();

    expect(within(dialog).getByText('Practice')).toBeInTheDocument();
    expect(within(dialog).getByText(/one constraint or objective moved/i)).toBeInTheDocument();
  });

  test('a sibling row opens that question in place', () => {
    const { store, dialog } = openQuestion(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /Reverse Vowels of a String/ }));

    expect(store.getState().ui.activeQuestionId).toBe(26);
  });

  test('an unmapped question falls back to its sub-pattern, and says that is the weaker claim', () => {
    const { dialog } = openQuestion(2);
    expect(within(dialog).getByRole('heading', { name: q2.title })).toBeInTheDocument();

    expect(within(dialog).queryByText('Explore')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Practice')).toBeInTheDocument();
    expect(within(dialog).getByText(/not mapped to a problem family/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Converging from both ends.*same machinery/)).toBeInTheDocument();
  });

  test('once solved the family mini-course takes over, so the same titles are not listed twice', () => {
    const store = makeStore();
    openQuestion(1, store);

    act(() => {
      store.dispatch(solveQuestion(1));
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Explore')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Practice')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/^Same idea: /)).toBeInTheDocument();
    // Solve survives — it is still where you reopen the problem.
    expect(within(dialog).getByText('Solve')).toBeInTheDocument();
  });
});

describe('the hint ladder', () => {
  test('an unmapped question says there is no ladder rather than inventing one', () => {
    const { dialog } = openQuestion(2);

    fireEvent.click(within(dialog).getByRole('button', { name: /Stuck\? Open the hint ladder/ }));

    expect(within(dialog).getByText(/sits outside the mapped problem families/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Show a hint/ })).not.toBeInTheDocument();
  });

  test('revealing a rung records the level and costs nothing', () => {
    const { store, dialog } = openQuestion(1);
    expect(store.getState().gamification.xp).toBe(0);

    fireEvent.click(within(dialog).getByRole('button', { name: /Stuck\? Open the hint ladder/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Show a hint/ }));

    expect(store.getState().progress.byId[1]!.hintLevelUsed).toBe(1);
    expect(store.getState().gamification.xp).toBe(0);
    // No price tag, no score, no warning — the whole reason the signal is trustworthy.
    expect(screen.getByRole('dialog').textContent).not.toMatch(/penalt|\bXP\b|costs? you/i);
  });

  test('the ladder is derived from the family, so rung 1 is the family’s own recognition signals', () => {
    const { dialog } = openQuestion(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /Stuck\? Open the hint ladder/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Show a hint/ }));

    expect(within(dialog).getByText(/Hint 1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/reads the same forwards and backwards/)).toBeInTheDocument();
  });
});

describe('after solving', () => {
  test('asks for confidence first, then the optional reflection, then one next step with its reason', () => {
    const store = makeStore();
    openQuestion(1, store);
    act(() => {
      store.dispatch(solveQuestion(1));
    });
    const dialog = screen.getByRole('dialog');

    const confidence = within(dialog).getByText('How confident are you?');
    const reflection = within(dialog).getByText('What did you learn?');
    expect(confidence.compareDocumentPosition(reflection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Exactly one recommendation, and it explains itself.
    expect(within(dialog).getByText('Next')).toBeInTheDocument();
    expect(within(dialog).getByText(/same technique, moved constraint/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Open Reverse Vowels of a String/ }));
    expect(store.getState().ui.activeQuestionId).toBe(26);
  });

  test('the reflection survives an Escape dismiss without ever being blurred', () => {
    const store = makeStore();
    openQuestion(1, store);
    act(() => {
      store.dispatch(solveQuestion(1));
    });

    fireEvent.change(screen.getByLabelText('What did you learn?'), {
      target: { value: 'Skipping from both ends at once is the whole trick.' },
    });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(store.getState().ui.activeQuestionId).toBeNull();
    expect(store.getState().progress.byId[1]!.reflection).toBe(
      'Skipping from both ends at once is the whole trick.',
    );
  });

  test('the reflection survives closing the dialog with the close button', () => {
    const store = makeStore();
    openQuestion(1, store);
    act(() => {
      store.dispatch(solveQuestion(1));
    });

    fireEvent.change(screen.getByLabelText('What did you learn?'), {
      target: { value: 'Two pointers, one invariant.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(store.getState().progress.byId[1]!.reflection).toBe('Two pointers, one invariant.');
  });
});
