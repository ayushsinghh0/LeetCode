import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchDialog } from '@/components/shared/SearchDialog';
import { QuestionDetailModal } from '@/components/questions/QuestionDetailModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { searchOpenSet } from '@/store/slices/uiSlice';
import { toggleBookmark } from '@/store/actions';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
// id 2 is the only question whose (lowercased) title contains "3sum" — verified against the
// full dataset (no "Two Sum"/"3Sum Closest"/etc collide on that substring).
const threeSum = questions.find((q) => q.title === '3Sum')!;

const routerFutureFlags = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

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

describe('SearchDialog', () => {
  test('is closed by default and opens on Ctrl+K, autofocusing the search input', () => {
    renderWithStore(<SearchDialog />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toHaveFocus();
  });

  test('also opens on Cmd+K (metaKey), e.g. macOS', () => {
    renderWithStore(<SearchDialog />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('a bare "k" keydown (no modifier) does not open the dialog', () => {
    renderWithStore(<SearchDialog />);

    fireEvent.keyDown(window, { key: 'k' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('with no query and no filters, shows a hint instead of dumping the whole dataset', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    expect(screen.queryByText('3Sum')).not.toBeInTheDocument();
    expect(screen.getByText(/type to search/i)).toBeInTheDocument();
  });

  test('typing "3Sum" shows exactly one result, with its difficulty badge and pattern chip', () => {
    const store = makeStore();
    store.dispatch(searchOpenSet(true));
    renderWithStore(<SearchDialog />, store);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '3Sum' } });

    const row = screen.getByRole('button', { name: /3Sum/i });
    expect(within(row).getByText('Medium')).toBeInTheDocument();
    expect(within(row).getByText('Two Pointers')).toBeInTheDocument();
    // No other row rendered alongside it.
    expect(screen.getAllByRole('button', { name: /Sum/i })).toHaveLength(1);
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

    expect(screen.getByRole('button', { name: /3Sum/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Sum/i })).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: /3Sum/i }));

    expect(store.getState().ui.searchOpen).toBe(false);
    expect(store.getState().ui.activeQuestionId).toBe(threeSum.id);
    expect(screen.getByRole('heading', { name: '3Sum' })).toBeInTheDocument();
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
