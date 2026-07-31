import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import AimlCoursePage from '@/pages/AimlCoursePage';
import { completeCourseSession } from '@/store/actions';
import { CORE_WEEKS } from '@/data/aimlCourse';

const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

// The page derives its plan from useToday() — pin the clock like every date-dependent suite.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

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

describe('AimlCoursePage', () => {
  test('fresh store: hero shows the course header, zero progress and the projected finish', () => {
    renderWithStore(<AimlCoursePage />);

    expect(screen.getByRole('heading', { name: 'AI & ML' })).toBeInTheDocument();
    expect(screen.getByText('0 of 52 sessions · 0 of 26 weeks')).toBeInTheDocument();
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
    expect(store.getState().course.byWeekId.w00.day1DoneOn).toBe('2026-07-30');
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

  test('week notes open in a dialog and autosave on blur', () => {
    const { store } = renderWithStore(<AimlCoursePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Notes for Week 3' }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByLabelText('Notes');
    fireEvent.change(textarea, { target: { value: 'attention heads' } });
    // Blur autosave is the synchronous persistence path (Save's handleSubmit resolves async —
    // same contract as questions/NotesEditor).
    fireEvent.blur(textarea);

    expect(store.getState().course.byWeekId.w03.notes).toBe('attention heads');
  });
});
