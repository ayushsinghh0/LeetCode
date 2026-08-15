import { act } from 'react';

import { screen, fireEvent, within } from '@testing-library/react';
import { makeStore } from '@/store/store';

import { renderWithStore } from '@/test/renderWithStore';
import { RuledList } from '@/components/layout/Page';
import { QuestionRow } from '@/components/questions/QuestionCard';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { reviseQuestion, solveQuestion } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
// id 1: "Valid Palindrome", pattern two-pointers ("Two Pointers"), difficulty easy, estimatedTime 15.
const question1 = questions.find((q) => q.id === 1)!;

// Safety net: if a test that enables fake timers fails/throws before its own vi.useRealTimers()
// cleanup line runs, fake timers would otherwise leak into every subsequent test in this file
// (breaking RTL's setTimeout-based findBy/waitFor polling and hanging them).
afterEach(() => {
  vi.useRealTimers();
});

// The browse row — how a question appears in a list you are scanning (/patterns/:id, /bookmarks).
// These used to be QuestionCards in a grid, which meant thirty `.glass` plates of equal weight on
// one screen; they are hairline-ruled rows now (DESIGN.md § The plate rule).
describe('QuestionRow', () => {
  function renderRow(progress = initialProgress(), onOpen: (id: number) => void = () => {}) {
    return renderWithStore(
      <RuledList>
        <QuestionRow question={question1} progress={progress} onOpen={onOpen} />
      </RuledList>,
    );
  }

  test('renders one row per question carrying title, what it tests, the authored estimate, difficulty, pattern, type and status', () => {
    renderRow();

    // The whole row is a single native button — a browse row is an index entry, so it carries no
    // solve/grade controls of its own. Counting buttons page-wide is what pins that.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const row = screen.getByRole('button');
    expect(row.tagName).toBe('BUTTON'); // native, so Enter/Space and focus order come for free
    expect(row.closest('li')).not.toBeNull();

    expect(within(row).getByText('Valid Palindrome')).toBeInTheDocument();
    expect(within(row).getByText(question1.tests)).toBeInTheDocument();
    // The estimate is authored per question, so the assertion reads it from the dataset rather
    // than hardcoding a per-difficulty constant that no longer exists. The tilde is deliberate:
    // this is a band for a typical first attempt, not a measurement of anyone.
    expect(within(row).getByText(`~${question1.estimatedTime} min`)).toBeInTheDocument();
    expect(within(row).getByText('Easy')).toBeInTheDocument();
    expect(within(row).getByText('Two Pointers')).toBeInTheDocument();
    expect(within(row).getByText('Foundation')).toBeInTheDocument();
    expect(within(row).getByText('Unsolved')).toBeInTheDocument();
  });

  test('clicking anywhere in the row calls onOpen with the question id', () => {
    const onOpen = vi.fn();
    renderRow(initialProgress(), onOpen);

    fireEvent.click(screen.getByText('Valid Palindrome'));

    expect(onOpen).toHaveBeenCalledWith(1);
  });

  test('bookmark and notes indicators show when they apply', () => {
    renderRow({ ...initialProgress(), bookmarked: true, notes: 'Remember the two-pointer trick' });

    expect(screen.getByRole('img', { name: 'Bookmarked' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Has notes' })).toBeInTheDocument();
  });

  test('an untouched question shows neither indicator', () => {
    renderRow();

    expect(screen.queryByRole('img', { name: 'Bookmarked' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Has notes' })).not.toBeInTheDocument();
  });
});

describe('QuestionDetailModal', () => {
  test('opens via activeQuestionSet, shows the question title and an empty revision-history state, and closing clears activeQuestionId', () => {
    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      store.dispatch(activeQuestionSet(1));
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Valid Palindrome' })).toBeInTheDocument();
    expect(screen.getByText('No revisions yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(store.getState().ui.activeQuestionId).toBeNull();
  });

  test('shows revision history entries with pass/fail icons and dates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    act(() => {
      store.dispatch(activeQuestionSet(1));
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    act(() => {
      store.dispatch(solveQuestion(1));
      store.dispatch(reviseQuestion(1, false));
    });

    // History dates render human-readable now, not as raw ISO strings.
    expect(screen.getByText('Jul 30, 2026')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('clicking a confidence dot dispatches setConfidence for the active question', async () => {
    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    act(() => {
      store.dispatch(activeQuestionSet(1));
      // Confidence is part of the post-solve reflection now — asking "how confident are you?"
      // before an attempt has happened is asking about nothing.
      store.dispatch(solveQuestion(1));
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Confidence 4' }));

    expect(store.getState().progress.byId[1]!.confidence).toBe(4);
  });

  test('clicking Bookmark toggles bookmarked for the active question', async () => {
    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    act(() => {
      store.dispatch(activeQuestionSet(1));
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }));

    expect(store.getState().progress.byId[1]!.bookmarked).toBe(true);
  });

  test('notes: typing then blurring the textarea autosaves via saveNotes', async () => {
    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    act(() => {
      store.dispatch(activeQuestionSet(1));
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    const textarea = screen.getByLabelText('Notes');
    fireEvent.change(textarea, { target: { value: 'Use two pointers from both ends.' } });
    fireEvent.blur(textarea);

    expect(store.getState().progress.byId[1]!.notes).toBe('Use two pointers from both ends.');
    // Autosave re-baselines the form, so Save goes back to disabled (nothing left to persist).
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('notes: Preview tab renders markdown', async () => {
    const store = makeStore();
    renderWithStore(<QuestionDetailModal />, store);

    act(() => {
      store.dispatch(activeQuestionSet(1));
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'A **key** insight' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preview' }));

    // Generous timeout, not a weaker assertion: this file has a documented history of query
    // timeouts under full-suite load, and the markdown preview is a lazy-loaded renderer.
    const strong = await screen.findByText('key', {}, { timeout: 5000 });
    expect(strong.tagName).toBe('STRONG');
  });
});
