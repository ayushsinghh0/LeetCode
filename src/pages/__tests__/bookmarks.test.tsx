import { screen, fireEvent, within } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import BookmarksPage from '@/pages/BookmarksPage';
import { toggleBookmark, solveQuestion } from '@/store/actions';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const question1 = questions.find((q) => q.id === 1)!; // "Valid Palindrome" — easy, two-pointers
const question2 = questions.find((q) => q.id === 2)!; // "3Sum" — medium, two-pointers

describe('BookmarksPage', () => {
  test('with no bookmarks, shows an empty state with a hint (no filter row rendered)', () => {
    renderWithStore(<BookmarksPage />);

    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    expect(screen.getByText(/bookmark a question/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Easy' })).not.toBeInTheDocument();
  });

  test('lists bookmarked questions as ruled rows carrying title, what it tests, estimate, difficulty and pattern — and only bookmarked ones', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id));
    renderWithStore(<BookmarksPage />, store);

    // Rows, not cards: each question is a <li> in a hairline-ruled list, and the whole row is one
    // native button. Scoping to the region keeps the filter chips (also buttons) out of the count.
    const region = screen.getByRole('region', { name: 'Bookmarked questions' });
    const rows = within(region).getAllByRole('listitem');
    expect(rows).toHaveLength(1);

    const row = within(rows[0]!).getByRole('button');
    expect(row.tagName).toBe('BUTTON');
    expect(within(row).getByText(question1.title)).toBeInTheDocument();
    expect(within(row).getByText(question1.tests)).toBeInTheDocument();
    expect(within(row).getByText(`~${question1.estimatedTime} min`)).toBeInTheDocument();
    expect(within(row).getByText('Easy')).toBeInTheDocument();
    expect(within(row).getByText('Two Pointers')).toBeInTheDocument();
    expect(within(row).getByRole('img', { name: 'Bookmarked' })).toBeInTheDocument();

    expect(screen.queryByText(question2.title)).not.toBeInTheDocument();
  });

  test('clicking a row opens that question in the sheet', () => {
    const store = makeStore();
    store.dispatch(toggleBookmark(question1.id));
    renderWithStore(<BookmarksPage />, store);

    fireEvent.click(screen.getByText(question1.title));

    expect(store.getState().ui.activeQuestionId).toBe(question1.id);
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
