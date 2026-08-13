import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { FamilyPanel } from '@/components/questions/FamilyPanel';
import type { ProblemFamily } from '@/types';

// Fixture family over real dataset ids (1 = Valid Palindrome, 2 = 3Sum, 4 = Sort Colors),
// so the panel resolves titles without depending on authored curriculum content.
const family: ProblemFamily = {
  id: 'two-pointers-test-family',
  pattern: 'two-pointers',
  name: 'Converging pointers',
  idea: 'Walk inward from both ends while an invariant lets you discard one side.',
  signals: ['Pairs in sorted or symmetric input', 'Answer shrinks from the outside in'],
  trap: 'Unsorted input silently breaks the discard argument.',
  members: [
    { questionId: 2, role: 'standard' },
    { questionId: 1, role: 'canonical' },
    { questionId: 4, role: 'variant' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('FamilyPanel', () => {
  test('shows the family name and idea, and orders members canonical-first', () => {
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);
    expect(screen.getByText('Same idea: Converging pointers')).toBeInTheDocument();
    expect(screen.getByText(/discard one side/)).toBeInTheDocument();

    const items = screen.getAllByRole('listitem').filter((li) => li.querySelector('button'));
    const titles = items.map((li) => li.textContent);
    expect(titles[0]).toContain('Valid Palindrome'); // canonical first despite authoring order
    expect(titles[0]).toContain('Canonical');
  });

  test('recognition cues are hidden until revealed (recall before explanation)', () => {
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);
    expect(screen.queryByText(/Pairs in sorted or symmetric input/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /recognition cues/i }));
    expect(screen.getByText(/Pairs in sorted or symmetric input/)).toBeInTheDocument();
    expect(screen.getByText(/silently breaks the discard argument/)).toBeInTheDocument();
  });

  test('the current question is disabled; siblings dispatch navigation to their modal', () => {
    const { store } = renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);
    expect(screen.getByRole('button', { name: /Valid Palindrome/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /3Sum/ }));
    expect(store.getState().ui.activeQuestionId).toBe(2);
  });
});
