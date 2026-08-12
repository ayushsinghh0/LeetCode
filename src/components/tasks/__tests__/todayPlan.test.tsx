import { fireEvent, screen, within } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import { TodayPlan } from '@/components/tasks/TodayPlan';
import { addTask, solveQuestion } from '@/store/actions';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { selectTasksForDate } from '@/store/slices/tasksSlice';

const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

function plan() {
  return screen.getByRole('region', { name: "Today's plan" });
}

describe('TodayPlan', () => {
  test('fresh store: shows the workload lines (8 new questions + course session) against the default 3h capacity', () => {
    renderWithStore(<TodayPlan />);

    expect(within(plan()).getByText('8 new questions')).toBeInTheDocument();
    expect(within(plan()).getByText('AI/ML session')).toBeInTheDocument();
    expect(within(plan()).getByText(/of 3h capacity/)).toBeInTheDocument();
    // Day 1's slice: 4 easy (15m) + 4 medium (25m) = 160m, + 60m session = 220m > 180m budget.
    expect(within(plan()).getByText(/More than your usual capacity/)).toBeInTheDocument();
  });

  test('solving questions shrinks the plan; a raised capacity clears the over-budget note', () => {
    const store = makeStore();
    for (let id = 1; id <= 6; id++) store.dispatch(solveQuestion(id));
    store.dispatch(settingsUpdated({ dailyCapacityMin: 240 }));
    renderWithStore(<TodayPlan />, store);

    expect(within(plan()).getByText('2 new questions')).toBeInTheDocument();
    expect(within(plan()).queryByText(/More than your usual capacity/)).not.toBeInTheDocument();
  });

  test('adding a task via the form appends it to today and clears the input', () => {
    const { store } = renderWithStore(<TodayPlan />);

    const input = screen.getByLabelText('New task title');
    fireEvent.change(input, { target: { value: 'Email the recruiter' } });
    fireEvent.change(screen.getByLabelText('Estimated minutes (optional)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));

    expect(selectTasksForDate(store.getState(), TODAY)).toHaveLength(1);
    expect(within(plan()).getByText('Email the recruiter')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  test('complete, defer, and delete controls drive the store', () => {
    const store = makeStore();
    store.dispatch(addTask({ title: 'Finish write-up', category: 'project' }));
    store.dispatch(addTask({ title: 'Ping mentor', category: 'communication' }));
    renderWithStore(<TodayPlan />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Complete "Finish write-up"' }));
    expect(store.getState().tasks.byId.t1).toMatchObject({ done: true, completedOn: TODAY });

    fireEvent.click(screen.getByRole('button', { name: 'Defer "Ping mentor" to tomorrow' }));
    expect(store.getState().tasks.byId.t2!.date).toBe('2026-07-31');
    expect(within(plan()).queryByText('Ping mentor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete "Finish write-up"' }));
    expect(store.getState().tasks.byId.t1).toBeUndefined();
  });
});
