import { screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { renderWithStore } from '@/test/renderWithStore';
import RoadmapPage from '@/pages/RoadmapPage';
import { solveQuestion } from '@/store/actions';
import questionsData from '@/data/questions.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const TOTAL_DAYS = 68; // ceil(539 / 8) — derived here for assertions, not hardcoded in the page.
const day2Titles = questions.slice(8, 16).map((q) => q.title); // ids 9-16

describe('RoadmapPage', () => {
  // The weeks are a master–detail: a 10-tile radiogroup strip, with the chosen week's seven
  // days as the detail. Every one of the 68 days is still reachable — through its week tile —
  // but only the viewed week's rows are in the DOM, which is what lets the whole route fit a
  // 590px viewport.
  test('renders the 10 week tiles and the current week\'s 7 day rows', () => {
    renderWithStore(<RoadmapPage />);

    expect(screen.getAllByRole('radio')).toHaveLength(Math.ceil(TOTAL_DAYS / 7));
    expect(screen.queryAllByText(/^Day \d+$/)).toHaveLength(7);
    // Fresh store stands in week 1, and its tile announces that.
    expect(screen.getByRole('radio', { name: /^Week 1,.*current week$/ })).toBeChecked();
  });

  test('selecting a week tile shows that week\'s days and drops the previous week\'s', () => {
    renderWithStore(<RoadmapPage />);

    fireEvent.click(screen.getByRole('radio', { name: /^Week 2\b/ }));

    expect(screen.getByText('Day 8')).toBeInTheDocument();
    expect(screen.getByText('Day 14')).toBeInTheDocument();
    expect(screen.queryByText(/^Day 1$/)).not.toBeInTheDocument();
  });

  test('fresh store: Day 1 is marked as the current day', () => {
    renderWithStore(<RoadmapPage />);

    const node = screen.getByLabelText('Day 1 current');
    expect(node).toHaveAttribute('aria-current', 'step');
  });

  test('after solving ids 1-8, Day 1 shows complete and Day 2 becomes current', () => {
    const store = makeStore();
    for (let id = 1; id <= 8; id++) {
      store.dispatch(solveQuestion(id));
    }
    renderWithStore(<RoadmapPage />, store);

    expect(screen.getByLabelText('Day 1 complete')).toBeInTheDocument();
    const currentNode = screen.getByLabelText('Day 2 current');
    expect(currentNode).toHaveAttribute('aria-current', 'step');
  });

  test('expanding Day 2 lists the titles of ids 9-16', () => {
    renderWithStore(<RoadmapPage />);

    // Anchored + word-boundary: the button's accessible name is "Day 2 <pattern> <...>", and an
    // unanchored /Day 2/ would also match "Day 20".."Day 29" (they all contain "Day 2" as a
    // substring), breaking getByRole's single-match requirement.
    const day2Button = screen.getByRole('button', { name: /^Day 2\b/ });
    fireEvent.click(day2Button);

    for (const title of day2Titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  test('clicking a question row in an expanded day dispatches activeQuestionSet', () => {
    const store = makeStore();
    renderWithStore(<RoadmapPage />, store);

    const day2Button = screen.getByRole('button', { name: /^Day 2\b/ });
    fireEvent.click(day2Button);

    const firstTitle = day2Titles[0]!; // id 9
    fireEvent.click(screen.getByText(firstTitle));

    expect(store.getState().ui.activeQuestionId).toBe(9);
  });

  test('only one day is expanded at a time', async () => {
    renderWithStore(<RoadmapPage />);

    const day1Button = screen.getByRole('button', { name: /^Day 1\b/ });
    const day2Button = screen.getByRole('button', { name: /^Day 2\b/ });
    const day1FirstTitle = questions[0]!.title; // "Valid Palindrome"

    fireEvent.click(day1Button);
    for (const title of questions.slice(0, 8).map((q) => q.title)) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    fireEvent.click(day2Button);
    for (const title of day2Titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // Day 1's questions are no longer shown since only one day expands at a time. The
    // collapse runs through framer-motion's exit animation, so the node leaves the DOM
    // asynchronously — wait for it rather than asserting absence synchronously after the click.
    await waitForElementToBeRemoved(() => screen.queryByText(day1FirstTitle));
  });
});
