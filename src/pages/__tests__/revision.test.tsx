import { act } from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { format, parseISO } from 'date-fns';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import RevisionPage from '@/pages/RevisionPage';
import {
  completeCourseSession,
  reviseCourseWeek,
  reviseQuestion,
  setDailyCapacity,
  solveQuestion,
} from '@/store/actions';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { selectRevisionSession } from '@/store/selectors';
import { courseWeekById } from '@/data/aimlCourse';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome"
const question2 = questions.find((q) => q.id === 2)!; // "3Sum"

afterEach(() => {
  vi.useRealTimers();
});

function setDate(iso: string) {
  vi.setSystemTime(new Date(`${iso}T12:00:00`));
}

// Drives a question from a fresh solve through every stage to "mastered" (revisionStage 5) via
// the real thunks at each actual due date, rather than hand-constructing a mastered progress.
function masterViaThunks(store: AppStore, id: number, solveDate: string) {
  setDate(solveDate);
  store.dispatch(solveQuestion(id));

  let dueDate = store.getState().progress.byId[id]!.nextRevision!;
  while (store.getState().progress.byId[id]!.revisionStage < 5) {
    setDate(dueDate);
    store.dispatch(reviseQuestion(id, true));
    dueDate = store.getState().progress.byId[id]!.nextRevision ?? dueDate;
  }
}

function retainWeekViaThunks(store: AppStore, weekId: string, clearDate: string) {
  setDate(clearDate);
  store.dispatch(completeCourseSession(weekId, 1));
  store.dispatch(completeCourseSession(weekId, 2));

  let dueDate = store.getState().course.byWeekId[weekId]!.nextRevision!;
  while (store.getState().course.byWeekId[weekId]!.revisionStage < 5) {
    setDate(dueDate);
    store.dispatch(reviseCourseWeek(weekId, true));
    dueDate = store.getState().course.byWeekId[weekId]!.nextRevision ?? dueDate;
  }
}

/** Solve a question and move the clock to the day it falls due. */
function solveAndAdvanceToDue(store: AppStore, id: number, solveDate = '2026-07-30') {
  setDate(solveDate);
  store.dispatch(solveQuestion(id));
  const due = store.getState().progress.byId[id]!.nextRevision!;
  setDate(due);
  return due;
}

describe('RevisionPage — the page asks how long you have, not what you owe', () => {
  test('the heading is the page, not a debt notice: no overdue count is promoted to a headline', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    // Twenty overdue items — the shape of week that made the old page unusable.
    for (let id = 1; id <= 20; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-20');

    renderWithStore(<RevisionPage />, store);

    expect(screen.getByRole('heading', { level: 1, name: 'Revision' })).toBeInTheDocument();
    for (const heading of screen.getAllByRole('heading')) {
      expect(heading.textContent ?? '').not.toMatch(/\d+\s+(overdue|due)/i);
    }
    // The total is still stated — calmly, in body copy, framed as waiting rather than owed.
    expect(screen.getByText(/items are due in total/i)).toBeInTheDocument();
    expect(screen.getByText(/simply waiting/i)).toBeInTheDocument();
  });

  test('the total counts deferred work too, and says how much did not fit', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    for (let id = 1; id <= 20; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-20');
    // A short budget cannot hold twenty overdue items, so most of them defer.
    store.dispatch(setDailyCapacity(15));

    const { store: s } = renderWithStore(<RevisionPage />, store);
    const session = selectRevisionSession(s.getState(), '2026-08-20');
    expect(session.deferred.length).toBeGreaterThan(0);

    // The footer states the WHOLE due total (placed + deferred), not just what fit, and names
    // the shortfall — "N items are due in total — M of them are not in this session".
    const placed = session.rationale.due + session.rationale.overdue;
    expect(
      screen.getByText(
        new RegExp(`${placed + session.deferred.length} items are due in total`, 'i'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${session.deferred.length} of them are not in this session`, 'i')),
    ).toBeInTheDocument();
  });

  test('with spaced revision switched off, the Revision page agrees with Today instead of contradicting it', () => {
    vi.useFakeTimers();
    const store = makeStore();
    const due = solveAndAdvanceToDue(store, 1);
    store.dispatch(settingsUpdated({ revisionEnabled: false }));

    const { store: s } = renderWithStore(<RevisionPage />, store);

    // Today reports the day clear when revision is off (selectRevisionQueueIds returns []); this
    // page must not simultaneously schedule the same due review. Ladder work is gone entirely...
    const session = selectRevisionSession(s.getState(), due);
    expect(session.rationale.due + session.rationale.overdue).toBe(0);
    expect(session.deferred).toHaveLength(0);
    expect(screen.queryByText(question1.title)).not.toBeInTheDocument();
    // ...and the page says why, rather than leaving the learner to read the silence as "recall is
    // safe". (Recognition/transfer practice is not gated by this setting, exactly as on Today.)
    expect(screen.getByText(/spaced revision is switched off in settings/i)).toBeInTheDocument();
  });

  test('the preview names the session, its cost, and why these items were chosen', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);

    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText(/Why these:/)).toBeInTheDocument();
  });

  test('the chosen length changes the session, not just the number of items', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    for (let id = 1; id <= 12; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-10');

    store.dispatch(setDailyCapacity(15));
    const { unmount } = renderWithStore(<RevisionPage />, store);
    expect(screen.getByRole('heading', { name: 'Quick recall' })).toBeInTheDocument();
    unmount();

    store.dispatch(setDailyCapacity(120));
    renderWithStore(<RevisionPage />, store);
    // Not merely more items: a longer budget buys a different kind of work.
    expect(screen.getByRole('heading', { name: 'Extended session' })).toBeInTheDocument();
  });

  test('a 15-minute session offers retrieval only — it never asks for a re-implementation', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    for (let id = 1; id <= 12; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-10');
    store.dispatch(setDailyCapacity(15));

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    const list = screen.getByRole('list', { name: 'Session activities' });
    expect(within(list).getAllByText('Quick recall').length).toBeGreaterThan(0);
    expect(within(list).queryByText('Deep review')).not.toBeInTheDocument();
  });
});

describe('RevisionPage — running a session', () => {
  test('progress is reported in minutes as well as in activities', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    // "3 of 10" says nothing about whether the evening is nearly over.
    expect(screen.getByText(/of \d+m/)).toBeInTheDocument();
    expect(screen.getByText(/0 of \d+ activities/)).toBeInTheDocument();
  });

  test('a due question appears as an activity carrying its own reason', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    store.dispatch(solveQuestion(1));
    setDate('2026-08-02'); // two days past the one-day step

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    const list = screen.getByRole('list', { name: 'Session activities' });
    expect(within(list).getByText(question1.title)).toBeInTheDocument();
    expect(within(list).getByText(/days past its 1-day step/)).toBeInTheDocument();
  });

  test('grading a revision from the session advances the ladder in the store', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Recalled it' })[0]!);

    expect(store.getState().progress.byId[1]!.revisionStage).toBe(1);
  });

  test('a missed recall resets the ladder to stage 0, due tomorrow — the locked spec', () => {
    vi.useFakeTimers();
    const store = makeStore();
    const due = solveAndAdvanceToDue(store, 1);
    act(() => {
      store.dispatch(reviseQuestion(1, true)); // stage 1
    });
    setDate(store.getState().progress.byId[1]!.nextRevision!);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Not yet' })[0]!);

    const progress = store.getState().progress.byId[1]!;
    expect(progress.revisionStage).toBe(0);
    expect(progress.nextRevision).not.toBe(due);
  });

  test('the plan is frozen once started — grading an item does not reshuffle the session', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    for (let id = 1; id <= 6; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-05');

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    const before = store.getState().session.frozen!.activities.map((a) => a.id);
    fireEvent.click(screen.getAllByRole('button', { name: 'Recalled it' })[0]!);
    const after = store.getState().session.frozen!.activities.map((a) => a.id);

    expect(after).toEqual(before);
    expect(store.getState().session.doneIds).toHaveLength(1);
  });

  test('a recorded grade is final for the sitting — the row states the outcome and offers no Undo', () => {
    vi.useFakeTimers();
    const store = makeStore();
    setDate('2026-07-30');
    for (let id = 1; id <= 6; id++) store.dispatch(solveQuestion(id));
    setDate('2026-08-05');

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Recalled it' })[0]!);

    // The slice recorded the grade, and the graded row now states the outcome...
    const gradedId = Object.keys(store.getState().session.grades)[0]!;
    expect(store.getState().session.grades[gradedId]).toBe(true);
    const gradedRow = screen.getByText('Recalled').closest('li')!;
    // ...and offers neither an Undo nor a second grade: the ladder has already moved, so
    // re-grading from this surface must be unreachable.
    expect(within(gradedRow).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(within(gradedRow).queryByRole('button', { name: 'Recalled it' })).not.toBeInTheDocument();
    expect(within(gradedRow).queryByRole('button', { name: 'Not yet' })).not.toBeInTheDocument();
  });

  test('a due course review is in the session and grading it climbs the course ladder', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));
    setDate('2026-07-31');

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    const w00 = courseWeekById.get('w00')!;
    const list = screen.getByRole('list', { name: 'Session activities' });
    expect(within(list).getByText(`Week ${w00.week} — ${w00.title}`)).toBeInTheDocument();

    fireEvent.click(within(list).getAllByRole('button', { name: 'Recalled it' })[0]!);
    expect(store.getState().course.byWeekId.w00!.revisionStage).toBe(1);
  });
});

describe('RevisionPage — finishing', () => {
  test('the summary reports graded outcomes, not merely which rows were ticked', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Recalled it' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText('Held')).toBeInTheDocument();
    expect(screen.getByText(question1.title)).toBeInTheDocument();
  });

  test('an ungraded sitting says so rather than inventing a recall verdict', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));

    expect(screen.getByText(/no recall verdict to report/i)).toBeInTheDocument();
    expect(screen.queryByText('Held')).not.toBeInTheDocument();
  });

  test('a failed recall is reported without blame, and named as back on the ladder', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Not yet' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));

    expect(screen.getByText('Needs another pass')).toBeInTheDocument();
    const summary = screen.getByText('Needs another pass').closest('div')!.parentElement!;
    expect(summary.textContent ?? '').not.toMatch(/failed|lost|behind|should have/i);
  });

  test('planning another session clears the sitting and returns to the chooser', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);

    renderWithStore(<RevisionPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));
    fireEvent.click(screen.getByRole('button', { name: /Plan another session/ }));

    expect(store.getState().session.startedOn).toBeNull();
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
  });
});

describe('RevisionPage — reference sections', () => {
  test('upcoming reviews are listed by date, described as not needing doing today', () => {
    vi.useFakeTimers();
    const store = makeStore();
    solveAndAdvanceToDue(store, 1);
    act(() => {
      store.dispatch(reviseQuestion(1, true)); // stage 1 → +3 days
    });
    const next = store.getState().progress.byId[1]!.nextRevision!;

    renderWithStore(<RevisionPage />, store);

    const section = screen.getByRole('heading', { name: 'Coming up' }).closest('section')!;
    expect(within(section).getByText(format(parseISO(next), 'EEEE, MMM d'))).toBeInTheDocument();
    expect(within(section).getByText(/Nothing here needs doing today/)).toBeInTheDocument();
  });

  test('a mastered question is counted, and listed on request', () => {
    vi.useFakeTimers();
    const store = makeStore();
    masterViaThunks(store, 2, '2026-07-01');
    setDate('2026-07-30');

    expect(store.getState().progress.byId[2]!.revisionStage).toBe(5);
    expect(store.getState().progress.byId[2]!.nextRevision).toBeNull();

    renderWithStore(<RevisionPage />, store);

    const section = screen.getByRole('heading', { name: 'Mastered' }).closest('section')!;
    expect(within(section).getByText('1 question')).toBeInTheDocument();
    expect(within(section).queryByText(question2.title)).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: /Show list/ }));
    expect(within(section).getByText(question2.title)).toBeInTheDocument();
  });

  test('a retained course week counts alongside mastered questions', () => {
    vi.useFakeTimers();
    const store = makeStore();
    retainWeekViaThunks(store, 'w00', '2026-06-01');
    setDate('2026-07-30');

    renderWithStore(<RevisionPage />, store);

    const section = screen.getByRole('heading', { name: 'Mastered' }).closest('section')!;
    expect(within(section).getByText(/1 course week/)).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: /Show list/ }));
    const w00 = courseWeekById.get('w00')!;
    expect(within(section).getByText(`Week ${w00.week} — ${w00.title}`)).toBeInTheDocument();
  });

  test('an empty ladder gets a calm empty state, not a session with nothing in it', () => {
    vi.useFakeTimers();
    setDate('2026-07-30');
    const store = makeStore();

    renderWithStore(<RevisionPage />, store);

    expect(screen.getByText('Nothing to revise right now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
  });
});
