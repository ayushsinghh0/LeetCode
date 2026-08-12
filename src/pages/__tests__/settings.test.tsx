import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SettingsPage from '@/pages/SettingsPage';
import { completeCourseSession, solveQuestion } from '@/store/actions';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { exportAsJson } from '@/services/storage/serialize';
import { totalDays } from '@/utils/engine/roadmap';
import { todayISO } from '@/utils/dates';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const TOTAL_QUESTIONS = questions.length; // 539

const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderWithStore(store: AppStore = makeStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter future={routerFutureFlags}>
              <SettingsPage />
            </MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>
      </Provider>,
    ),
  };
}

// Radix Select renders a visually-hidden native <select aria-hidden> alongside its custom listbox
// purely for native form/autofill compatibility, and its <option> list is populated on mount
// regardless of open state (SelectContent mounts SelectItemText into an off-screen
// DocumentFragment even while closed — see @radix-ui/react-select's SelectContentFragment).
// Driving that hidden element directly sidesteps jsdom's total lack of the ResizeObserver/
// scrollIntoView APIs the *visual* popper listbox needs to open, which this codebase already
// treats as untestable in jsdom (see src/components/ui/__tests__/primitives.test.tsx's Select
// smoke test and src/pages/__tests__/patterns.test.tsx's filterPatternQuestions comment).
function changePerDay(container: HTMLElement, value: number) {
  const select = container.querySelector('select');
  if (!select) throw new Error('questionsPerDay native <select> not found');
  fireEvent.change(select, { target: { value: String(value) } });
}

// jsdom's Blob polyfill doesn't implement Blob.prototype.text(); FileReader is already exercised
// (and known to work) by the Import tests below, so read the exported Blob's content through it.
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('SettingsPage: Preferences form', () => {
  test('renders current settings from the store, with Save disabled until dirty', () => {
    renderWithStore();

    expect(screen.getByText(new RegExp(`${totalDays(TOTAL_QUESTIONS, 8)} days`))).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Spaced revision' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'false');
    // The setting is live now — the description states what it actually does.
    expect(screen.getByText(/A browser notification when revisions are due/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('changing perDay updates the live total-days help text immediately, and the store once Saved', () => {
    const { store, container } = renderWithStore();
    expect(screen.getByText(new RegExp(`${totalDays(TOTAL_QUESTIONS, 8)} days`))).toBeInTheDocument();

    changePerDay(container, 12);

    // Help text recomputes live off the watched form value, before any Save.
    expect(screen.getByText(new RegExp(`${totalDays(TOTAL_QUESTIONS, 12)} days`))).toBeInTheDocument();
    expect(store.getState().settings.questionsPerDay).toBe(8); // not yet persisted

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    expect(store.getState().settings.questionsPerDay).toBe(12);
    expect(saveButton).toBeDisabled(); // re-baselined after save
  });

  test('toggling revisionEnabled and saving updates the store', () => {
    const { store } = renderWithStore();

    fireEvent.click(screen.getByRole('switch', { name: 'Spaced revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(store.getState().settings.revisionEnabled).toBe(false);
  });

  test('notifications switch is a stub: toggling and saving still updates settings', () => {
    const { store } = renderWithStore();

    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(store.getState().settings.notifications).toBe(true);
  });

  test('theme switch is wired through ThemeContext: applies immediately, no Save required', () => {
    const { store } = renderWithStore();
    const themeSwitch = screen.getByRole('switch', { name: 'Dark mode' });
    expect(themeSwitch).toHaveAttribute('aria-checked', 'true'); // default theme is dark

    fireEvent.click(themeSwitch);

    expect(store.getState().settings.theme).toBe('light');
    expect(themeSwitch).toHaveAttribute('aria-checked', 'false');
    // Theme isn't part of the dirty-tracked preferences form.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('SettingsPage: Export', () => {
  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  test('clicking Export downloads a dated JSON backup of the current state via a Blob URL', async () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));

    let clickedAnchor: HTMLAnchorElement | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockClick(this: HTMLAnchorElement) {
        clickedAnchor = this;
      });

    renderWithStore(store);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = (window.URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
    expect(blobArg.type).toBe('application/json');
    expect(await readBlobAsText(blobArg)).toBe(exportAsJson(store.getState()));

    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor!.download).toBe(`dsa-roadmap-backup-${todayISO()}.json`);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });
});

describe('SettingsPage: Import', () => {
  test('importing a valid backup shows a confirm dialog with solved/course/XP counts, and Import applies it', async () => {
    const sourceStore = makeStore();
    sourceStore.dispatch(solveQuestion(1));
    sourceStore.dispatch(solveQuestion(2));
    const backupJson = exportAsJson(sourceStore.getState());
    const expectedXp = sourceStore.getState().gamification.xp;

    const { store } = renderWithStore();
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    // A DSA-only backup carries no course slice — the preview says so explicitly (0 sessions).
    await screen.findByText(new RegExp(`2 solved, 0 course\\s+sessions, ${expectedXp} XP`));
    expect(screen.queryByText(/not a valid/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(store.getState().progress.byId[1]!.status).toBe('solved');
    expect(store.getState().progress.byId[2]!.status).toBe('solved');
    expect(store.getState().gamification.xp).toBe(expectedXp);
  });

  test('a backup carrying course work previews its session count too', async () => {
    const sourceStore = makeStore();
    sourceStore.dispatch(solveQuestion(1));
    sourceStore.dispatch(completeCourseSession('w00', 1));
    sourceStore.dispatch(completeCourseSession('w00', 2));
    sourceStore.dispatch(completeCourseSession('w01', 1));
    const backupJson = exportAsJson(sourceStore.getState());

    renderWithStore();
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    await screen.findByText(/1 solved, 3 course\s+sessions/);
  });

  test('after importing, the Preferences form re-syncs to the imported settings, and a subsequent Save does not revert them', async () => {
    const sourceStore = makeStore();
    sourceStore.dispatch(settingsUpdated({ questionsPerDay: 14, notifications: true }));
    const backupJson = exportAsJson(sourceStore.getState());

    const { store } = renderWithStore(); // fresh store: perDay 8, notifications false, revisionEnabled true
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    await screen.findByRole('button', { name: 'Import' });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    // The form controls reflect the freshly-imported settings, not the pre-import baseline.
    expect(screen.getByText(new RegExp(`${totalDays(TOTAL_QUESTIONS, 14)} days`))).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'true');
    // Re-synced to the new values, so nothing is unsaved yet.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Editing one untouched-by-import field and saving must not revert the other imported fields.
    fireEvent.click(screen.getByRole('switch', { name: 'Spaced revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(store.getState().settings.questionsPerDay).toBe(14); // not reverted to the pre-import 8
    expect(store.getState().settings.notifications).toBe(true); // not reverted to the pre-import false
    expect(store.getState().settings.revisionEnabled).toBe(false); // the actual edit took effect
  });

  test('cancelling the import confirm dialog does not dispatch', async () => {
    const sourceStore = makeStore();
    sourceStore.dispatch(solveQuestion(1));
    const backupJson = exportAsJson(sourceStore.getState());

    const { store } = renderWithStore();
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    await screen.findByRole('button', { name: 'Import' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(store.getState().progress.byId[1]).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });

  test('importing a structurally invalid backup shows a destructive error and does NOT dispatch', async () => {
    const { store } = renderWithStore();
    const file = new File([JSON.stringify({ version: 2, foo: 'bar' })], 'bad.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    const error = await screen.findByText(/not a valid dsa roadmap backup/i);
    expect(error).toHaveClass('text-destructive');
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(store.getState().progress.byId).toEqual({});
  });

  test('importing a file that is not valid JSON shows a destructive parse error and does NOT dispatch', async () => {
    const { store } = renderWithStore();
    const file = new File(['not json{'], 'bad.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [file] } });

    const error = await screen.findByText(/not valid json/i);
    expect(error).toHaveClass('text-destructive');
    expect(store.getState().progress.byId).toEqual({});
  });
});

describe('SettingsPage: Reset', () => {
  test('reset requires typing RESET exactly before the destructive confirm button enables', () => {
    renderWithStore();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));

    const confirmButton = screen.getByRole('button', { name: 'Yes, reset everything' });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText('Type RESET to confirm');
    fireEvent.change(input, { target: { value: 'reset' } }); // wrong case
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'RESE' } }); // incomplete
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'RESET' } });
    expect(confirmButton).not.toBeDisabled();
  });

  test('confirming reset dispatches resetProgress and clears all progress', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    renderWithStore(store);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));
    fireEvent.change(screen.getByLabelText('Type RESET to confirm'), { target: { value: 'RESET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, reset everything' }));

    expect(store.getState().progress.byId).toEqual({});
    expect(store.getState().gamification.xp).toBe(0);
    expect(screen.queryByRole('button', { name: 'Yes, reset everything' })).not.toBeInTheDocument();
  });

  test('cancelling the reset dialog does NOT dispatch', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    renderWithStore(store);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));
    fireEvent.change(screen.getByLabelText('Type RESET to confirm'), { target: { value: 'RESET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(store.getState().progress.byId[1]!.status).toBe('solved'); // untouched
  });
});
