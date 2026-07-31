import type { ReactNode } from 'react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import RevisionPage from '@/pages/RevisionPage';
import { completeCourseSession, reviseCourseWeek, reviseQuestion, solveQuestion } from '@/store/actions';
import { courseWeekById } from '@/data/aimlCourse';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome"
const question2 = questions.find((q) => q.id === 2)!; // "3Sum"

// react-router-dom v6.28 warns about the v7 behaviors it will adopt by default in v7 unless
// these future flags are opted into — mirrors src/pages/__tests__/today.test.tsx.
const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

afterEach(() => {
  vi.useRealTimers();
});

function renderWithStore(ui: ReactNode, store: AppStore = makeStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter future={routerFutureFlags}>{ui}</MemoryRouter>
        </TooltipProvider>
      </Provider>,
    ),
  };
}

// Fake-timer date advance, mirroring today.test.tsx's "solve now, advance to due date" pattern.
// Noon avoids any timezone-induced off-by-one on the yyyy-MM-dd conversion.
function setDate(iso: string) {
  vi.setSystemTime(new Date(`${iso}T12:00:00`));
}

// Drives a question from a fresh solve through every stage to "mastered" (revisionStage 5) by
// dispatching the real reviseQuestion thunk at each of its actual due dates — the same path the
// UI's Pass button uses — rather than hand-constructing a mastered QuestionProgress.
function masterViaThunks(store: AppStore, id: number, solveDate: string) {
  setDate(solveDate);
  store.dispatch(solveQuestion(id));

  let dueDate = store.getState().progress.byId[id].nextRevision!;
  while (store.getState().progress.byId[id].revisionStage < 5) {
    setDate(dueDate);
    store.dispatch(reviseQuestion(id, true));
    dueDate = store.getState().progress.byId[id].nextRevision ?? dueDate;
  }
}

// Course analogue of masterViaThunks: clears the week, then passes every review at its actual
// due date until the week is retained (revisionStage 5).
function retainWeekViaThunks(store: AppStore, weekId: string, clearDate: string) {
  setDate(clearDate);
  store.dispatch(completeCourseSession(weekId, 1));
  store.dispatch(completeCourseSession(weekId, 2));

  let dueDate = store.getState().course.byWeekId[weekId].nextRevision!;
  while (store.getState().course.byWeekId[weekId].revisionStage < 5) {
    setDate(dueDate);
    store.dispatch(reviseCourseWeek(weekId, true));
    dueDate = store.getState().course.byWeekId[weekId].nextRevision ?? dueDate;
  }
}

describe('RevisionPage', () => {
  test('due fixture appears in the Due tab with the count in its tab label, then shows an overdue badge once past due', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // nextRevision = 2026-07-31

    renderWithStore(<RevisionPage />, store);

    act(() => {
      setDate('2026-07-31');
      vi.advanceTimersByTime(60_000); // useToday's poll interval
    });

    expect(screen.getByRole('tab', { name: 'Due Today (1)' })).toBeInTheDocument();
    let duePanel = screen.getByRole('tabpanel');
    expect(within(duePanel).getByText(question1.title)).toBeInTheDocument();
    expect(within(duePanel).queryByText(/overdue/)).not.toBeInTheDocument();

    act(() => {
      setDate('2026-08-02');
      vi.advanceTimersByTime(60_000);
    });

    duePanel = screen.getByRole('tabpanel');
    expect(within(duePanel).getByText('2 days overdue')).toBeInTheDocument();
  });

  test('clicking Pass on a due card advances its revisionStage to 1 in the store', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // nextRevision = 2026-07-31

    renderWithStore(<RevisionPage />, store);

    act(() => {
      setDate('2026-07-31');
      vi.advanceTimersByTime(60_000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(store.getState().progress.byId[1].revisionStage).toBe(1);
  });

  test('Upcoming tab groups the question title under its newly scheduled date after a pass', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(solveQuestion(1)); // nextRevision = 2026-07-31

    renderWithStore(<RevisionPage />, store);

    act(() => {
      setDate('2026-07-31');
      vi.advanceTimersByTime(60_000);
    });

    act(() => {
      store.dispatch(reviseQuestion(1, true)); // stage 1, nextRevision = 2026-08-03 (+3 days)
    });

    expect(store.getState().progress.byId[1].nextRevision).toBe('2026-08-03');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Upcoming' }));

    const dateLabel = format(parseISO('2026-08-03'), 'EEE, MMM d');
    const dateGroup = screen.getByRole('group', { name: dateLabel });
    expect(within(dateGroup).getByText(question1.title)).toBeInTheDocument();
  });

  test('a question mastered through repeated real revision passes appears in the Mastered tab', () => {
    vi.useFakeTimers();
    const store = makeStore();
    masterViaThunks(store, 1, '2026-07-30');

    expect(store.getState().progress.byId[1].revisionStage).toBe(5);
    expect(store.getState().progress.byId[1].nextRevision).toBeNull();

    renderWithStore(<RevisionPage />, store);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Mastered' }));

    const masteredPanel = screen.getByRole('tabpanel');
    expect(within(masteredPanel).getByText(question1.title)).toBeInTheDocument();
  });

  test('a due course review renders in the Due tab, counts in its label, and Pass climbs the ladder', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2)); // review due 2026-07-31

    renderWithStore(<RevisionPage />, store);

    act(() => {
      setDate('2026-07-31');
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole('tab', { name: 'Due Today (1)' })).toBeInTheDocument();
    const duePanel = screen.getByRole('tabpanel');
    expect(within(duePanel).getByText('Course reviews')).toBeInTheDocument();

    const w00 = courseWeekById.get('w00')!;
    expect(within(duePanel).getByText(`Week ${w00.week} — ${w00.title}`)).toBeInTheDocument();

    fireEvent.click(within(duePanel).getByRole('button', { name: `Pass Week ${w00.week} review` }));
    expect(store.getState().course.byWeekId.w00.revisionStage).toBe(1);
  });

  test('an upcoming course review groups under its scheduled date in the Upcoming tab', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2)); // review lands tomorrow

    renderWithStore(<RevisionPage />, store);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Upcoming' }));

    const dateLabel = format(parseISO('2026-07-31'), 'EEE, MMM d');
    const dateGroup = screen.getByRole('group', { name: dateLabel });
    const w00 = courseWeekById.get('w00')!;
    expect(within(dateGroup).getByText(`Week ${w00.week} — ${w00.title}`)).toBeInTheDocument();
    expect(within(dateGroup).getByText('1 due')).toBeInTheDocument();
  });

  test('a retained course week appears in the Mastered tab and counts in the header stat', () => {
    vi.useFakeTimers();
    const store = makeStore();
    retainWeekViaThunks(store, 'w00', '2026-06-01'); // retained well before "today"
    setDate('2026-07-30');

    renderWithStore(<RevisionPage />, store);

    const header = screen.getByRole('heading', { name: 'Revision' }).closest('header')!;
    const masteredGroup = within(header).getByText('Mastered').parentElement!;
    expect(within(masteredGroup).getByText('1')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Mastered' }));
    const masteredPanel = screen.getByRole('tabpanel');
    expect(within(masteredPanel).getByText('Course week · retained')).toBeInTheDocument();
  });

  test('header stats show the correct due-now and mastered counts for the fixtures', () => {
    vi.useFakeTimers();
    const store = makeStore();

    masterViaThunks(store, 2, '2026-07-01'); // fully mastered — not due, nextRevision null

    setDate('2026-07-30');
    store.dispatch(solveQuestion(1)); // nextRevision = 2026-07-31, not yet due
    setDate('2026-07-31'); // now due

    renderWithStore(<RevisionPage />, store);

    // Scope to the header stats strip: "Mastered" also appears as a bare Tabs trigger label.
    const header = screen.getByRole('heading', { name: 'Revision' }).closest('header')!;

    const dueNowGroup = within(header).getByText('Due now').parentElement!;
    expect(within(dueNowGroup).getByText('1')).toBeInTheDocument();

    const masteredGroup = within(header).getByText('Mastered').parentElement!;
    expect(within(masteredGroup).getByText('1')).toBeInTheDocument();

    // Sanity check the fixtures don't overlap the wrong tab.
    expect(question2.id).not.toBe(question1.id);
  });
});
