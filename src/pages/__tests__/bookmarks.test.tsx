import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from '@/store/store';
import { TooltipProvider } from '@/components/ui/tooltip';
import BookmarksPage from '@/pages/BookmarksPage';
import { toggleBookmark, solveQuestion } from '@/store/actions';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome" — easy, two-pointers
const question2 = questions.find((q) => q.id === 2)!; // "3Sum" — medium, two-pointers

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

describe('BookmarksPage', () => {
  test('with no bookmarks, shows an empty state with a hint (no filter row rendered)', () => {
    renderWithStore(<BookmarksPage />);

    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    expect(screen.getByText(/bookmark a question/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Easy' })).not.toBeInTheDocument();
  });

  test('lists bookmarked questions as browse-context cards, and only bookmarked ones', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id));
    renderWithStore(<BookmarksPage />, store);

    // browse context renders the card root as role="button" (no action buttons inside it —
    // see QuestionCard's context prop), so a button whose name includes the title is the card.
    expect(screen.getByRole('button', { name: new RegExp(question1.title) })).toBeInTheDocument();
    expect(screen.queryByText(question2.title)).not.toBeInTheDocument();
  });

  test('difficulty chip filters the bookmarked set (AND, not OR, with bookmarked-ness)', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id)); // easy
    store.dispatch(toggleBookmark(question2.id)); // medium
    renderWithStore(<BookmarksPage />, store);

    expect(screen.getByText(question1.title)).toBeInTheDocument();
    expect(screen.getByText(question2.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));

    expect(screen.getByText(question1.title)).toBeInTheDocument();
    expect(screen.queryByText(question2.title)).not.toBeInTheDocument();
  });

  test('status chip "Solved" narrows to solved bookmarked questions', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id));
    store.dispatch(toggleBookmark(question2.id));
    store.dispatch(solveQuestion(question1.id));
    renderWithStore(<BookmarksPage />, store);

    fireEvent.click(screen.getByRole('button', { name: 'Solved' }));

    expect(screen.getByText(question1.title)).toBeInTheDocument();
    expect(screen.queryByText(question2.title)).not.toBeInTheDocument();
  });

  test('filters that match nothing show a distinct "no bookmarks match" empty state, not the zero-bookmarks one', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id)); // easy

    renderWithStore(<BookmarksPage />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));

    expect(screen.getByText('No bookmarks match these filters')).toBeInTheDocument();
    expect(screen.queryByText('No bookmarks yet')).not.toBeInTheDocument();
  });
});
