import { screen, within } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { PracticeIntentionsRail } from '@/components/today/PracticeIntentionsRail';
import { PRACTICE_ACTIONS, practiceActionByKey } from '@/utils/engine/practice';
import type { PracticeIntention } from '@/types';

const action = PRACTICE_ACTIONS[0]!; // { key, label, href }

describe('PracticeIntentionsRail', () => {
  test('renders each intention as an "After …, I will …" line whose action deep-links', () => {
    const intentions: PracticeIntention[] = [{ cue: 'my morning coffee', action: action.key }];
    renderWithStore(<PracticeIntentionsRail intentions={intentions} />);

    const rail = screen.getByRole('region', { name: /intention/i });
    expect(within(rail).getByText(/After my morning coffee/)).toBeInTheDocument();
    const link = within(rail).getByRole('link', { name: action.label });
    expect(link).toHaveAttribute('href', action.href);
  });

  test('renders nothing when there are no intentions', () => {
    const { container } = renderWithStore(<PracticeIntentionsRail intentions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('skips an intention whose action key is no longer a real app action', () => {
    // A key removed from the registry must degrade gracefully — never render a dead line.
    expect(practiceActionByKey('ghost-action')).toBeUndefined();
    const intentions: PracticeIntention[] = [
      { cue: 'lunch', action: 'ghost-action' },
      { cue: 'my commute', action: action.key },
    ];
    renderWithStore(<PracticeIntentionsRail intentions={intentions} />);

    expect(screen.queryByText(/After lunch/)).not.toBeInTheDocument();
    expect(screen.getByText(/After my commute/)).toBeInTheDocument();
  });

  test('carries no tracking affordance — no checkboxes, no counters', () => {
    const intentions: PracticeIntention[] = [{ cue: 'my morning coffee', action: action.key }];
    const { container } = renderWithStore(<PracticeIntentionsRail intentions={intentions} />);

    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/\bstreak\b|\bXP\b|\/\s*\d|day \d/i);
  });
});
