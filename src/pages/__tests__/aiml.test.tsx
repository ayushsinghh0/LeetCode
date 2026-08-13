import { fireEvent, screen, within } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import AimlCoursePage from '@/pages/AimlCoursePage';
import { completeCourseSession } from '@/store/actions';
import { CORE_WEEKS } from '@/data/aimlCourse';

// The page derives its plan from useToday() — pin the clock like every date-dependent suite.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AimlCoursePage', () => {
  test('fresh store: masthead, the figure ledger and the projected finish', () => {
    renderWithStore(<AimlCoursePage />);

    expect(screen.getByRole('heading', { name: 'AI & ML' })).toBeInTheDocument();
    // The ledger replaced the four StatCards; each figure is now stated exactly once.
    expect(screen.getByText('0 / 52')).toBeInTheDocument();
    expect(screen.getByText('0 / 26')).toBeInTheDocument();
    // 52 sessions from 2026-07-30 → last one lands 2026-09-19.
    expect(screen.getByText('Sep 19')).toBeInTheDocument();
  });

  test('up next starts at Week 0 · Day 1 with a lecture deep link', () => {
    renderWithStore(<AimlCoursePage />);

    const upNext = screen.getByRole('heading', { name: 'Up next' }).closest('section')!;
    expect(within(upNext).getByText('Week 0 — Orientation')).toBeInTheDocument();
    expect(within(upNext).getByText('Day 1 · Lecture')).toBeInTheDocument();
    expect(within(upNext).getByRole('link', { name: /open lecture/i })).toHaveAttribute(
      'href',
      'https://100xdevs.com/new-courses/23/video/4149',
    );
  });

  test('marking the up-next session done awards XP and advances to Day 2 · Practice', () => {
    const { store } = renderWithStore(<AimlCoursePage />);

    const upNext = screen.getByRole('heading', { name: 'Up next' }).closest('section')!;
    fireEvent.click(within(upNext).getByRole('button', { name: 'Mark session done' }));

    expect(store.getState().gamification.xp).toBe(20);
    expect(store.getState().course.byWeekId.w00!.day1DoneOn).toBe('2026-07-30');
    expect(within(upNext).getByText('Day 2 · Practice')).toBeInTheDocument();
  });

  test('syllabus lists every core week with two session controls each', () => {
    renderWithStore(<AimlCoursePage />);

    const syllabus = screen.getByRole('heading', { name: 'Syllabus' }).closest('section')!;
    for (const week of CORE_WEEKS) {
      expect(within(syllabus).getByText(week.title)).toBeInTheDocument();
    }
    // 26 weeks × 2 pending session buttons on a fresh store.
    expect(within(syllabus).getAllByRole('button', { name: /^Mark Week \d+ day [12] done$/ })).toHaveLength(52);
    // Week 0's slides resource deep-links out.
    expect(within(syllabus).getAllByRole('link', { name: 'Slides' })[0]).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/1vYuRDxfmKeDN8hVMpQ-1mVB8A8rgAdyc/view?usp=drive_link',
    );
  });

  test('a completed week reads as done in the syllabus', () => {
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));
    renderWithStore(<AimlCoursePage />, store);

    const syllabus = screen.getByRole('heading', { name: 'Syllabus' }).closest('section')!;
    expect(within(syllabus).queryByRole('button', { name: 'Mark Week 0 day 1 done' })).not.toBeInTheDocument();
    expect(within(syllabus).getAllByRole('button', { name: /^Mark Week \d+ day [12] done$/ })).toHaveLength(50);
  });

  test('extras section lists the 5 optional sessions with single controls', () => {
    renderWithStore(<AimlCoursePage />);

    const extras = screen.getByRole('heading', { name: 'Extra sessions' }).closest('section')!;
    expect(within(extras).getByText('Memory — Class by Samiksha')).toBeInTheDocument();
    expect(within(extras).getAllByRole('button', { name: /^Mark .* done$/ })).toHaveLength(5);
  });

  test('a due week review surfaces in the Review due plate; passing climbs the ladder', () => {
    // Clear Week 0 on the 29th so its first review lands on the pinned "today" (the 30th).
    vi.setSystemTime(new Date('2026-07-29T12:00:00'));
    const store = makeStore();
    store.dispatch(completeCourseSession('w00', 1));
    store.dispatch(completeCourseSession('w00', 2));
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));

    renderWithStore(<AimlCoursePage />, store);

    const plate = screen.getByRole('heading', { name: 'Review due' }).closest('section')!;
    expect(within(plate).getByText('Week 0 — Orientation')).toBeInTheDocument();
    expect(within(plate).getByRole('button', { name: 'Fail Week 0 review' })).toBeInTheDocument();

    // The syllabus row carries the retention meta too.
    const syllabus = screen.getByRole('heading', { name: 'Syllabus' }).closest('section')!;
    expect(
      within(syllabus).getByText('taught Jan 9 · cleared Jul 29 · review Jul 30'),
    ).toBeInTheDocument();

    const xpBefore = store.getState().gamification.xp;
    fireEvent.click(within(plate).getByRole('button', { name: 'Pass Week 0 review' }));

    expect(store.getState().gamification.xp).toBe(xpBefore + 10);
    expect(store.getState().course.byWeekId.w00!.revisionStage).toBe(1);
    // Nothing else is due, so the plate disappears entirely.
    expect(screen.queryByRole('heading', { name: 'Review due' })).not.toBeInTheDocument();
  });

  test('implementation tracks list closed, with the failure-mode count on the shut row', () => {
    renderWithStore(<AimlCoursePage />);

    const tracks = screen.getByRole('heading', { name: 'Implement it from scratch' }).closest('section')!;
    expect(within(tracks).getAllByRole('button', { name: /failure modes$/ })).toHaveLength(11);
    // The reason to open a track is visible before opening it.
    expect(within(tracks).getAllByText('4 failure modes')).toHaveLength(11);
    // Nothing from inside a track is on screen yet.
    expect(within(tracks).queryByText('The maths')).not.toBeInTheDocument();
  });

  test('opening a track shows all five rungs, with the maths open first', () => {
    renderWithStore(<AimlCoursePage />);

    const tracks = screen.getByRole('heading', { name: 'Implement it from scratch' }).closest('section')!;
    fireEvent.click(within(tracks).getByRole('button', { name: /^Linear Regression/ }));

    for (const rung of ['The maths', 'From scratch', 'The library', 'The experiment', 'How it breaks']) {
      expect(within(tracks).getByText(rung), rung).toBeInTheDocument();
    }
    // Rung 1 is open by default — it is a ladder, so it starts at the bottom.
    expect(within(tracks).getByText('design matrix, one row per sample and one column per feature')).toBeInTheDocument();
    // Rung 2's detail is not.
    expect(within(tracks).queryByText(/prepend a column of ones/)).not.toBeInTheDocument();
  });

  test('the failure rung is open as soon as the track is — never behind a second click', () => {
    renderWithStore(<AimlCoursePage />);

    const tracks = screen.getByRole('heading', { name: 'Implement it from scratch' }).closest('section')!;
    fireEvent.click(within(tracks).getByRole('button', { name: /^Linear Regression/ }));

    // All four modes, symptom-first, with no control of their own to press.
    expect(within(tracks).getByText(/LinAlgError: Singular matrix/)).toBeInTheDocument();
    expect(within(tracks).getByText(/differ from sklearn's in the 4th or 5th significant digit/)).toBeInTheDocument();
    expect(within(tracks).getByText(/The intercept comes out as 0\.0/)).toBeInTheDocument();
    expect(within(tracks).queryByRole('button', { name: /How it breaks/ })).not.toBeInTheDocument();
    expect(within(tracks).getByText('4 modes')).toBeInTheDocument();
  });

  test('selecting another rung swaps the open detail rather than stacking it', () => {
    renderWithStore(<AimlCoursePage />);

    const tracks = screen.getByRole('heading', { name: 'Implement it from scratch' }).closest('section')!;
    fireEvent.click(within(tracks).getByRole('button', { name: /^Linear Regression/ }));
    fireEvent.click(within(tracks).getByRole('button', { name: /^From scratch/ }));

    expect(within(tracks).getByText(/prepend a column of ones/)).toBeInTheDocument();
    expect(
      within(tracks).queryByText('design matrix, one row per sample and one column per feature'),
    ).not.toBeInTheDocument();
    // The failure modes never went away.
    expect(within(tracks).getByText(/LinAlgError: Singular matrix/)).toBeInTheDocument();
  });

  test('a project states its baseline and its metric justification without being opened', () => {
    renderWithStore(<AimlCoursePage />);

    const projects = screen.getByRole('heading', { name: 'Ship something measurable' }).closest('section')!;
    expect(within(projects).getByText("Predict the training mean for every block (DummyRegressor(strategy='mean'))")).toBeInTheDocument();
    expect(within(projects).getByText('RMSE 1.1539 (≈ $115,393) · MAE 0.9117 · R² 0.000')).toBeInTheDocument();
    // The argument against the obvious alternative is the teaching, so it is never hidden.
    expect(within(projects).getByText(/RMSE rather than MAE because the cost of mispricing a house/)).toBeInTheDocument();
    // The working detail is.
    expect(within(projects).queryByText(/Ridge on the raw 8 features/)).not.toBeInTheDocument();
  });

  test('an unmeasurable baseline says the learner must establish it rather than hiding the field', () => {
    renderWithStore(<AimlCoursePage />);

    const projects = screen.getByRole('heading', { name: 'Ship something measurable' }).closest('section')!;
    expect(
      within(projects).getAllByText('No published number exists — you have to establish this one first.'),
    ).toHaveLength(2);
    // The note is the instruction, not provenance, so it renders inline with the empty score.
    expect(within(projects).getByText(/it is the most important null in this file/)).toBeInTheDocument();
  });

  test('opening a project reveals the objective, experiments and unanswered retrospective', () => {
    renderWithStore(<AimlCoursePage />);

    const projects = screen.getByRole('heading', { name: 'Ship something measurable' }).closest('section')!;
    fireEvent.click(within(projects).getByRole('button', { name: /California Housing/ }));

    expect(within(projects).getByText(/Ridge on the raw 8 features/)).toBeInTheDocument();
    expect(
      within(projects).getByText('Deliberately unanswered — every answer is a property of your own runs.'),
    ).toBeInTheDocument();
    // The early tiers ship nothing, and the page says why rather than leaving a blank.
    expect(within(projects).getByText(/deploying it would be theatre/)).toBeInTheDocument();
  });

  test('week notes open in a dialog and autosave on blur', () => {
    const { store } = renderWithStore(<AimlCoursePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add notes for Week 3' }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByLabelText('Notes');
    fireEvent.change(textarea, { target: { value: 'attention heads' } });
    // Blur autosave is the synchronous persistence path (Save's handleSubmit resolves async —
    // same contract as questions/NotesEditor).
    fireEvent.blur(textarea);

    expect(store.getState().course.byWeekId.w03!.notes).toBe('attention heads');
  });
});
