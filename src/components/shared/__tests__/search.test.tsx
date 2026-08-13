import { screen, fireEvent, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import { SearchDialog } from '@/components/shared/SearchDialog';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { searchOpenSet } from '@/store/slices/uiSlice';
import { saveCourseNotes, saveNotes, toggleBookmark } from '@/store/actions';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
// id 2 is the only question whose (lowercased) title contains "3sum" — verified against the
// full dataset (no "Two Sum"/"3Sum Closest"/etc collide on that substring).
const threeSum = questions.find((q) => q.title === '3Sum')!;

// The palette navigates (pages, weeks, focus mode) — this probe makes the resulting
// location assertable without mounting real routes.
function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

// The Ctrl/Cmd+K hotkey lives in the eager useSearchHotkey hook, not the (lazy) dialog —
// AppShell mounts both. Hotkey tests mirror that wiring with this host.
function HotkeyHost() {
  useSearchHotkey();
  return null;
}

describe('SearchDialog', () => {
  test('is closed by default and opens on Ctrl+K, autofocusing the search input', () => {
    renderWithStore(
      <>
        <HotkeyHost />
        <SearchDialog />
      </>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toHaveFocus();
  });

  test('also opens on Cmd+K (metaKey), e.g. macOS', () => {
    renderWithStore(
      <>
        <HotkeyHost />
        <SearchDialog />
      </>,
    );

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('a bare "k" keydown (no modifier) does not open the dialog', () => {
    renderWithStore(
      <>
        <HotkeyHost />
        <SearchDialog />
      </>,
    );

    fireEvent.keyDown(window, { key: 'k' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('with no query and no filters, shows page commands and actions instead of the dataset', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    expect(screen.queryByText('3Sum')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Start focus mode' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  test('typing "3Sum" shows exactly one result, with its difficulty badge and pattern chip', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '3Sum' } });

    const row = screen.getByRole('option', { name: /3Sum/i });
    expect(within(row).getByText('Medium')).toBeInTheDocument();
    expect(within(row).getByText('Two Pointers')).toBeInTheDocument();
    // No other row rendered alongside it.
    expect(screen.getAllByRole('option', { name: /Sum/i })).toHaveLength(1);
  });

  // One listbox, one row grammar. Question results used to be `.glass` plates — a plate per row
  // inside DialogContent, which is itself a plate — while the page/action/week/task rows directly
  // above them were plain. Two row designs stacked on each other in a single list.
  test('question rows use the same row grammar as the command rows, not a plate of their own', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    // Both rows are captured while highlighted (each is index 0 of its own render), so this
    // compares like with like: the highlighted row must look the same whatever kind of thing it is.
    const pageRow = screen.getByRole('option', { name: 'Dashboard' });
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '3Sum' } });
    const questionRow = screen.getByRole('option', { name: /3Sum/i });

    expect(pageRow).toHaveAttribute('aria-selected', 'true');
    expect(questionRow).toHaveAttribute('aria-selected', 'true');
    expect(questionRow.className).not.toContain('glass');
    expect(questionRow.className).toBe(pageRow.className);
  });

  test('difficulty chip narrows the live query results further (AND, not OR)', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'sum' } });
    const expectedEasyCount = questions.filter(
      (q) => q.title.toLowerCase().includes('sum') && q.difficulty === 'easy',
    ).length;

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));

    // Scope to the results list so the "Easy" filter chip's own label isn't counted alongside
    // each result row's DifficultyBadge.
    const results = within(screen.getByTestId('search-results'));
    expect(results.getAllByText('Easy')).toHaveLength(expectedEasyCount);
    expect(results.queryByText('Medium')).not.toBeInTheDocument();
  });

  test('status chip "Bookmarked" filters to bookmarked questions with no query needed', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(threeSum.id));
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarked' }));

    expect(screen.getByRole('option', { name: /3Sum/i })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /Sum/i })).toHaveLength(1);
  });

  test('clicking a result row closes the search dialog and opens that question in the detail modal', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(
      <>
        <SearchDialog />
        <QuestionDetailModal />
      </>,
      store,
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '3Sum' } });
    fireEvent.click(screen.getByRole('option', { name: /3Sum/i }));

    expect(store.getState().ui.searchOpen).toBe(false);
    expect(store.getState().ui.activeQuestionId).toBe(threeSum.id);
    expect(screen.getByRole('heading', { name: '3Sum' })).toBeInTheDocument();
  });

  test('ArrowDown/ArrowUp move aria-activedescendant through the palette', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-0');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-1');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-0');
  });

  test('Enter selects the highlighted question result without a click', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: '3Sum' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(store.getState().ui.activeQuestionId).toBe(threeSum.id);
    expect(store.getState().ui.searchOpen).toBe(false);
  });

  test('typing a page name and pressing Enter navigates there and closes the palette', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(
      <>
        <SearchDialog />
        <LocationProbe />
      </>,
      store,
    );

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'settings' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
    expect(store.getState().ui.searchOpen).toBe(false);
  });

  test('the theme action flips the theme setting', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    expect(store.getState().settings.theme).toBe('dark');

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'switch to light' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(store.getState().settings.theme).toBe('light');
  });

  test('course weeks match by the notes written on them, not just the title', () => {
    const store = makeStore();
    // "backprop chain rule" appears in no week title — only in these notes on w02.
    store.dispatch(saveCourseNotes('w02', 'Key insight: backprop chain rule, layer by layer.'));
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'backprop' } });

    expect(screen.getByRole('option', { name: /Neural Networks from Scratch/i })).toBeInTheDocument();
  });

  test('question results match by saved notes as well as title', () => {
    const store = makeStore();
    // "monotonic deque trick" appears in no question title — only in these notes on 3Sum.
    store.dispatch(saveNotes(threeSum.id, 'Remember the monotonic deque trick here.'));
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'monotonic deque' } });

    expect(screen.getByRole('option', { name: /3Sum/i })).toBeInTheDocument();
  });

  test('course weeks match by title and clicking one goes to the course page', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(
      <>
        <SearchDialog />
        <LocationProbe />
      </>,
      store,
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'transformers' } });

    const weekOptions = screen.getAllByRole('option', { name: /transformers/i });
    expect(weekOptions.length).toBeGreaterThan(0);
    fireEvent.click(weekOptions[0]!);

    expect(screen.getByTestId('location')).toHaveTextContent('/aiml');
    expect(store.getState().ui.searchOpen).toBe(false);
  });
});

describe('Sidebar search button', () => {
  test('clicking it dispatches searchOpenSet(true), opening the search dialog', () => {
    const store = makeStore();
    renderWithStore(
      <>
        <Sidebar />
        <SearchDialog />
      </>,
      store,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
