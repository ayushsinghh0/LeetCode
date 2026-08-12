import { screen, fireEvent } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import FocusPage from '@/pages/FocusPage';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { initialCourseProgress } from '@/utils/engine/aimlCourse';
import { COURSE_WEEKS } from '@/data/aimlCourse';
import questionsData from '@/data/questions.json';
import type { CourseWeekProgress, Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

// Safety net mirroring the existing suites: fake timers must never leak between tests.
afterEach(() => {
  vi.useRealTimers();
});

describe('FocusPage: new-question source (today\'s slice has an unsolved item)', () => {
  test('fresh store: shows the first unsolved question with Solved / Need Revision / Skip buttons', () => {
    renderWithStore(<FocusPage />);

    // Day 1's first question is id 1, "Valid Palindrome" (see dashboard/today test fixtures).
    expect(screen.getByRole('heading', { name: 'Valid Palindrome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Need Revision' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fail' })).not.toBeInTheDocument();
  });

  test('clicking Solved dispatches solveQuestion, marking the question solved', () => {
    const { store } = renderWithStore(<FocusPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Solved' }));

    expect(store.getState().progress.byId[1]!.status).toBe('solved');
  });

  test('keeps ui.focusQuestionId pointed at the on-screen question, and clears it on unmount', () => {
    const { store, unmount } = renderWithStore(<FocusPage />);

    expect(store.getState().ui.focusQuestionId).toBe(1); // "Valid Palindrome" is up

    unmount();
    expect(store.getState().ui.focusQuestionId).toBeNull(); // pomodoro attribution stops with the page
  });

  test('clicking Skip advances to the next question instead of re-presenting the same one', () => {
    const { store } = renderWithStore(<FocusPage />);

    expect(screen.getByRole('heading', { name: 'Valid Palindrome' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(store.getState().progress.byId[1]!.status).toBe('skipped');
    // Day 1's second question (id 2, "3Sum") takes the stage — the skipped one does not linger.
    expect(screen.queryByRole('heading', { name: 'Valid Palindrome' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3Sum' })).toBeInTheDocument();
  });
});

describe('FocusPage: revision-queue source (today\'s slice is fully solved, a revision is due)', () => {
  function revisionOnlyStore(): AppStore {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));

    // Every question marked solved (so today's day-68 slice — the last, partial day — has
    // nothing left unsolved) with a comfortably future nextRevision, except question 1, whose
    // nextRevision is set to today so it's the sole due revision. Preloaded directly rather than
    // via hundreds of solveQuestion dispatches, mirroring dashboard.test.tsx's
    // "roadmap-complete fallback" fixture — only .status/.revisionStage/.nextRevision are read by
    // the selectors under test here.
    const byId: Record<number, QuestionProgress> = {};
    for (const q of questions) {
      byId[q.id] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: '2026-08-15' };
    }
    byId[1] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: TODAY };

    return makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-01-01' } });
  }

  test('shows the due question with Pass / Fail buttons instead of Solved / Need Revision / Skip', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    expect(screen.getByRole('heading', { name: questions.find((q) => q.id === 1)!.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solved' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Need Revision' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  test('clicking Pass dispatches reviseQuestion(id, true), advancing the revision stage', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(store.getState().progress.byId[1]!.revisionStage).toBe(2); // 1 -> 2, not reset to 0
  });

  test('clicking Fail dispatches reviseQuestion(id, false), resetting the revision stage', () => {
    const store = revisionOnlyStore();
    renderWithStore(<FocusPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    expect(store.getState().progress.byId[1]!.revisionStage).toBe(0);
    expect(store.getState().progress.byId[1]!.nextRevision).toBe('2026-07-31'); // today + 1
  });
});

// All questions solved with far-future revisions: DSA offers nothing, so focus falls through to
// the AI/ML track — first the next course session, then (once every core week is cleared) any
// due week review.
function dsaExhaustedById(): Record<number, QuestionProgress> {
  const byId: Record<number, QuestionProgress> = {};
  for (const q of questions) {
    byId[q.id] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: '2026-08-15' };
  }
  return byId;
}

describe('FocusPage: course-session source (no DSA work left)', () => {
  function courseSessionStore(): AppStore {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
    return makeStore({ progress: { byId: dsaExhaustedById(), dayLogs: {}, startDate: '2026-01-01' } });
  }

  test('shows the next course session with a "Session done" action, and completing it advances the plan', () => {
    const store = courseSessionStore();
    renderWithStore(<FocusPage />, store);

    // Week 0 ("Orientation"), day 1 is the first pending core session.
    expect(screen.getByRole('heading', { name: 'Orientation' })).toBeInTheDocument();
    expect(screen.getByText(/Day 1 — Lecture/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Session done' }));
    expect(store.getState().course.byWeekId['w00']!.day1DoneOn).toBe(TODAY);

    // Same week, day 2 comes up next — still Orientation, now labelled Practice.
    expect(screen.getByRole('heading', { name: 'Orientation' })).toBeInTheDocument();
    expect(screen.getByText(/Day 2 — Practice/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Session done' }));
    expect(store.getState().course.byWeekId['w00']!.day2DoneOn).toBe(TODAY);
    expect(screen.getByRole('heading', { name: 'Fast-tracking the Course of AI' })).toBeInTheDocument();
  });
});

describe('FocusPage: course-review source (course complete, one week review due)', () => {
  function courseReviewStore(): AppStore {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));

    const byWeekId: Record<string, CourseWeekProgress> = {};
    for (const week of COURSE_WEEKS) {
      byWeekId[week.id] = {
        ...initialCourseProgress(),
        day1DoneOn: '2026-07-01',
        day2DoneOn: '2026-07-02',
        revisionStage: 1,
        nextRevision: '2026-08-15',
        lastReviewed: '2026-07-02',
      };
    }
    byWeekId['w00'] = { ...byWeekId['w00']!, nextRevision: TODAY }; // the one due review

    return makeStore({
      progress: { byId: dsaExhaustedById(), dayLogs: {}, startDate: '2026-01-01' },
      course: { byWeekId },
    });
  }

  test('shows the due week review with Pass / Fail; Pass advances its ladder stage', () => {
    const store = courseReviewStore();
    renderWithStore(<FocusPage />, store);

    expect(screen.getByRole('heading', { name: 'Orientation' })).toBeInTheDocument();
    expect(screen.getByText(/Week 0 review/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(store.getState().course.byWeekId['w00']!.revisionStage).toBe(2); // 1 -> 2
  });

  test('Fail resets the week to stage 0, due tomorrow', () => {
    const store = courseReviewStore();
    renderWithStore(<FocusPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    expect(store.getState().course.byWeekId['w00']!.revisionStage).toBe(0);
    expect(store.getState().course.byWeekId['w00']!.nextRevision).toBe('2026-07-31');
  });
});
