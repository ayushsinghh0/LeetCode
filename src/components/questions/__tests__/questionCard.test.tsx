import { act } from 'react';
import { Provider } from 'react-redux';
import { screen, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithStore } from '@/test/renderWithStore';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { reviseQuestion, solveQuestion } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import questionsData from '@/data/questions.json';
import type { Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
// id 1: "Valid Palindrome", pattern two-pointers ("Two Pointers"), difficulty easy, estimatedTime 15.
const question1 = questions.find((q) => q.id === 1)!;

// Safety net: if a test that enables fake timers fails/throws before its own vi.useRealTimers()
// cleanup line runs, fake timers would otherwise leak into every subsequent test in this file
// (breaking RTL's setTimeout-based findBy/waitFor polling and hanging them).
afterEach(() => {
  vi.useRealTimers();
});

describe('QuestionCard', () => {
  test('renders title, difficulty, pattern, and estimated time', () => {
    renderWithStore(
      <QuestionCard question={question1} progress={initialProgress()} context="browse" onOpenDetail={() => {}} />,
    );

    expect(screen.getByText('Valid Palindrome')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Two Pointers')).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
  });

  test('today context: clicking Solved dispatches solveQuestion, marking the question solved in the store', () => {
    const { store } = renderWithStore(
      <QuestionCard question={question1} progress={initialProgress()} context="today" onOpenDetail={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Solved' }));

    expect(store.getState().progress.byId[1].status).toBe('solved');
  });

  test('today context: clicking Need Revision solves the question AND flags it low-confidence (2)', () => {
    const { store } = renderWithStore(
      <QuestionCard question={question1} progress={initialProgress()} context="today" onOpenDetail={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Need Revision' }));

    const progress = store.getState().progress.byId[1];
    expect(progress.status).toBe('solved');
    expect(progress.confidence).toBe(2);
  });

  test('revision context shows Pass/Fail buttons, and Pass advances revisionStage to 1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    const store = makeStore();
    store.dispatch(solveQuestion(1)); // solved today; nextRevision = tomorrow (2026-07-31)
    vi.setSystemTime(new Date('2026-07-31T12:00:00')); // advance so the revision is actually due

    const progressBefore = store.getState().progress.byId[1];
    renderWithStore(
      <QuestionCard question={question1} progress={progressBefore} context="revision" onOpenDetail={() => {}} />,
      store,
    );

    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(store.getState().progress.byId[1].revisionStage).toBe(1);

    vi.useRealTimers();
  });

  test('shows a notes indicator when progress.notes is non-empty, and hides it when empty', () => {
    const progressWithNotes: QuestionProgress = { ...initialProgress(), notes: 'Remember the two-pointer trick' };
    const { rerender } = renderWithStore(
      <QuestionCard question={question1} progress={progressWithNotes} context="browse" onOpenDetail={() => {}} />,
    );
    expect(screen.getByRole('img', { name: 'Has notes' })).toBeInTheDocument();

    rerender(
      <Provider store={makeStore()}>
        <TooltipProvider>
          <QuestionCard question={question1} progress={initialProgress()} context="browse" onOpenDetail={() => {}} />
        </TooltipProvider>
      </Provider>,
    );
    expect(screen.queryByRole('img', { name: 'Has notes' })).not.toBeInTheDocument();
  });

  test('action buttons stop propagation: clicking Solved does not call onOpenDetail', () => {
    const onOpenDetail = vi.fn();
    renderWithStore(
      <QuestionCard question={question1} progress={initialProgress()} context="today" onOpenDetail={onOpenDetail} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Solved' }));

    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  test('clicking the card body calls onOpenDetail with the question id', () => {
    const onOpenDetail = vi.fn();
    renderWithStore(
      <QuestionCard question={question1} progress={initialProgress()} context="browse" onOpenDetail={onOpenDetail} />,
    );

    fireEvent.click(screen.getByText('Valid Palindrome'));

    expect(onOpenDetail).toHaveBeenCalledWith(1);
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
    });
    // Radix's Dialog mounts its content synchronously in response to the `open` prop flipping
    // (see the Dialog test in ui/__tests__/primitives.test.tsx) — no need to await/poll for it,
    // which matters here because polling (waitFor/findBy) relies on real setTimeout ticking and
    // would hang under vi.useFakeTimers().
    screen.getByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Confidence 4' }));

    expect(store.getState().progress.byId[1].confidence).toBe(4);
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

    expect(store.getState().progress.byId[1].bookmarked).toBe(true);
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

    expect(store.getState().progress.byId[1].notes).toBe('Use two pointers from both ends.');
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

    const strong = await screen.findByText('key');
    expect(strong.tagName).toBe('STRONG');
  });
});
