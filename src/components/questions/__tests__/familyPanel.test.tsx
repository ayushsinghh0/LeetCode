import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { FamilyPanel } from '@/components/questions/FamilyPanel';
import { makeStore } from '@/store/store';
import { solveQuestion } from '@/store/actions';
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

// The three rungs are the shared `Disclosure` (native `<details>`/`<summary>`), so they are
// addressed as summaries rather than as buttons: `<summary>` carries no `button` role.
//
// Closed content stays in the DOM — that is what `<details>` does, and jsdom applies no UA
// stylesheet to hide it — so "not yet revealed" is asserted against the disclosure's `open` state,
// which is the actual mechanism, rather than against element absence, which only ever worked
// because the previous local implementation unmounted its children.
const rung = (name: RegExp): HTMLElement => {
  const summary = screen.getAllByText(name).map((el) => el.closest('summary')).find(Boolean);
  if (!summary) throw new Error(`no disclosure summary matching ${name}`);
  return summary as HTMLElement;
};
const isOpen = (name: RegExp): boolean => rung(name).closest('details')!.hasAttribute('open');
const openRung = (name: RegExp) => fireEvent.click(rung(name));
const openLadder = () => openRung(/the problem ladder/i);

describe('FamilyPanel', () => {
  test('states how far through the idea the learner is, without opening the ladder', () => {
    // A list of five problems says what exists; "2 of 3 solved" says where you are in it.
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(4));
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />, store);

    expect(screen.getByText('2 of 3 solved')).toBeInTheDocument();
  });

  test('the count is over members that exist, so a renamed member cannot inflate it', () => {
    const withGhost: ProblemFamily = {
      ...family,
      members: [...family.members, { questionId: 999_999, role: 'stretch' }],
    };
    renderWithStore(<FamilyPanel family={withGhost} currentQuestionId={1} />);

    expect(screen.getByText('0 of 3 solved')).toBeInTheDocument();
  });

  test('the core idea is the only thing shown up front — signals, trap and ladder each wait to be asked for', () => {
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);

    expect(screen.getByText('Same idea: Converging pointers')).toBeInTheDocument();
    expect(screen.getByText(/discard one side/)).toBeInTheDocument();

    // Progressive disclosure: the mini-course does not arrive all at once. All three rungs start
    // shut, so none of their content is revealed.
    expect(isOpen(/recognition cues/i)).toBe(false);
    expect(isOpen(/the common trap/i)).toBe(false);
    expect(isOpen(/the problem ladder/i)).toBe(false);
  });

  test('recognition cues open on request (recall before explanation), and the trap is its own step', () => {
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);

    openRung(/recognition cues/i);
    expect(isOpen(/recognition cues/i)).toBe(true);
    expect(screen.getByText(/Pairs in sorted or symmetric input/)).toBeInTheDocument();
    // The trap is a separate rung of the same course — revealing the cues does not spend it.
    expect(isOpen(/the common trap/i)).toBe(false);

    openRung(/the common trap/i);
    expect(isOpen(/the common trap/i)).toBe(true);
    expect(screen.getByText(/silently breaks the discard argument/)).toBeInTheDocument();
  });

  test('the ladder groups members by learning role, canonical first, and explains what each role is for', () => {
    renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);
    openLadder();

    expect(screen.getByText('Canonical')).toBeInTheDocument();
    expect(screen.getByText(/The reference statement of the idea/)).toBeInTheDocument();
    // The transfer framing, stated per role rather than left for the learner to infer.
    expect(screen.getByText(/One constraint or objective changed/)).toBeInTheDocument();

    const roleLabels = ['Canonical', 'Standard', 'Variant'].map((label) => screen.getByText(label));
    expect(roleLabels[0]!.compareDocumentPosition(roleLabels[1]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(roleLabels[1]!.compareDocumentPosition(roleLabels[2]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('the current question is disabled; siblings dispatch navigation to their modal', () => {
    const { store } = renderWithStore(<FamilyPanel family={family} currentQuestionId={1} />);
    openLadder();

    expect(screen.getByRole('button', { name: /Valid Palindrome/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /3Sum/ }));
    expect(store.getState().ui.activeQuestionId).toBe(2);
  });
});
