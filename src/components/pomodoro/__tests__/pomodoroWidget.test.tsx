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
  // /focus used to exempt the inline variant from the idle collapse ("the dial IS the page"), but
  // idle is where the timer spends nearly all its life, and idle meant a permanent 258px plate
  // showing a 160px ring at 100% and the word "Ready" above the question the learner came to work
  // on. Idle is now a quiet ruled row — clock, phase, start — still a role="timer" with the clock
  // a screen reader needs. The dial returns the moment a phase counts.
  test('idle is a quiet row: clock and phase stay readable, the dial does not render', () => {
    renderWithStore(<PomodoroWidget variant="inline" />);

    expect(screen.queryByRole('group', { name: 'Pomodoro timer' })).not.toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Pomodoro: Ready, 25:00 remaining' })).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start pomodoro/i })).toBeInTheDocument();
  });

  test('the dial returns the moment a phase counts', () => {
    const store = makeStore();
    store.dispatch(pomodoroPhaseSet({ phase: 'focus', endsAt: Date.now() + 25 * 60_000 }));
    renderWithStore(<PomodoroWidget variant="inline" />, store);

    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();
  });
});
