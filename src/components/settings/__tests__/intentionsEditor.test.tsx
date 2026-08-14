import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { IntentionsEditor } from '@/components/settings/IntentionsEditor';
import { makeStore } from '@/store/store';
import { MAX_INTENTIONS, PRACTICE_ACTIONS } from '@/utils/engine/practice';
import type { PracticeState } from '@/types';

const action = PRACTICE_ACTIONS[0]!;
const withIntentions = (intentions: PracticeState['intentions']) =>
  makeStore({ practice: { intentions, journal: {}, sittings: [] } });

describe('IntentionsEditor', () => {
  test('a fresh learner sees an invitation to add one, and no rows yet', () => {
    renderWithStore(<IntentionsEditor />);

    expect(screen.getByRole('button', { name: /Add an intention/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Intention 1 cue/i)).not.toBeInTheDocument();
  });

  test('adding a row, filling it, and saving persists a normalized intention', () => {
    const { store, container } = renderWithStore(<IntentionsEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Add an intention/i }));

    fireEvent.change(screen.getByLabelText('Intention 1 cue'), { target: { value: '  my morning coffee ' } });
    // The Radix Select drives through its hidden native <select> fallback (same as SettingsPage).
    fireEvent.change(container.querySelector('select')!, { target: { value: action.key } });
    fireEvent.click(screen.getByRole('button', { name: /Save intentions/i }));

    expect(store.getState().practice.intentions).toEqual([{ cue: 'my morning coffee', action: action.key }]);
  });

  test(`cannot add more than ${MAX_INTENTIONS}`, () => {
    renderWithStore(<IntentionsEditor />);
    const add = () => screen.getByRole('button', { name: /Add an intention/i });
    for (let i = 0; i < MAX_INTENTIONS; i++) fireEvent.click(add());
    expect(add()).toBeDisabled();
  });

  test('existing intentions seed the editor as filled rows', () => {
    renderWithStore(<IntentionsEditor />, withIntentions([{ cue: 'lunch', action: action.key }]));
    expect(screen.getByLabelText('Intention 1 cue')).toHaveValue('lunch');
  });

  test('removing a row and saving drops it', () => {
    const store = withIntentions([{ cue: 'lunch', action: action.key }]);
    renderWithStore(<IntentionsEditor />, store);

    fireEvent.click(screen.getByRole('button', { name: /Remove intention 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save intentions/i }));

    expect(store.getState().practice.intentions).toEqual([]);
  });

  test('carries no tracking language — a suggestion, not a scored habit', () => {
    const { container } = renderWithStore(<IntentionsEditor />);
    expect(container.textContent ?? '').not.toMatch(/\bstreak\b|\bXP\b|track your|don.t break/i);
  });
});
