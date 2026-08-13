import { screen } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { makeStore } from '@/store/store';
import { PomodoroWidget } from '@/components/pomodoro/PomodoroWidget';
import { pomodoroPhaseSet } from '@/store/slices/uiSlice';

// The widget reads Date.now() through usePomodoro and ticks on an interval, so the clock is
// pinned here for the same reason the page suites pin it: an unpinned run asserts on whatever
// second it happened to render in.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PomodoroWidget — floating', () => {
  // This variant is mounted in AppShell, i.e. on every page except /focus. It used to render a
  // plate reading "25:00 / Ready" in the corner of all of them, and AppShell reserved 144px of
  // page foot to keep it from covering content — a permanent surface for a timer that is idle
  // almost all of the time.
  test('idle is a single start control: no plate, no clock, no phase word', () => {
    renderWithStore(<PomodoroWidget />);

    expect(screen.getByRole('button', { name: 'Start pomodoro' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pomodoro timer' })).not.toBeInTheDocument();
    expect(screen.queryByText('25:00')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  test('the surface materialises once a phase is counting, with the full control set', () => {
    const store = makeStore();
    store.dispatch(pomodoroPhaseSet({ phase: 'focus', endsAt: Date.now() + 25 * 60_000 }));

    renderWithStore(<PomodoroWidget />, store);

    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause pomodoro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset pomodoro' })).toBeInTheDocument();
  });

  test('a paused phase keeps the surface — collapsing is about idle, not about running', () => {
    const store = makeStore();
    store.dispatch(pomodoroPhaseSet({ phase: 'focus', endsAt: null }));

    renderWithStore(<PomodoroWidget />, store);

    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pomodoro' })).toBeInTheDocument();
  });

  test('phase transitions stay announced across the collapse', () => {
    renderWithStore(<PomodoroWidget />);

    // The live region sits outside the collapsible surface, so returning to idle is still spoken.
    expect(screen.getByText('Pomodoro ready')).toBeInTheDocument();
  });
});

describe('PomodoroWidget — inline', () => {
  // On /focus the dial IS the page (that route is mounted outside AppShell, so this is the only
  // copy there). It is exempt from the collapse.
  test('keeps its dial and its clock while idle', () => {
    renderWithStore(<PomodoroWidget variant="inline" />);

    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
