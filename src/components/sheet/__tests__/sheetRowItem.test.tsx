import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SheetRowItem } from '@/components/sheet/SheetView';
import type { SheetEntry } from '@/utils/engine/revisionSheet';
import type { SheetRow } from '@/types';

/**
 * T1.13's UI half, pinned in isolation: `external-links.json` ships EMPTY, so no dataset row can
 * exercise the linked branch — this test hands the row item an entry the table WOULD produce.
 * A listed external links; an unlisted one stays a plain statement. Never a guessed URL.
 */

function externalEntry(url: string | null): SheetEntry {
  const row: SheetRow = {
    topicIndex: 0,
    topic: 'Prefix Sum',
    subtopicIndex: 0,
    subtopic: 'Line Sweep',
    order: 0,
    ref: { kind: 'external', title: 'Pongal Bunk', difficulty: 'medium', platform: 'Codeforces', url },
  };
  return {
    row,
    identity: null,
    title: 'Pongal Bunk',
    url: null, // the ENGINE identity url stays null — the display link is the ref's alone
    officialDifficulty: 'medium',
    contestRating: null,
    patterns: [],
    unmapped: false,
    onRoadmap: false,
    questionId: null,
    slug: null,
    premium: false,
    platform: 'Codeforces',
    status: null,
    state: undefined,
  };
}

const noop = () => {};

describe('SheetRowItem — external rows and the verified-links table', () => {
  it('links a hand-verified external row to its verified URL', () => {
    render(
      <ul>
        <SheetRowItem
          entry={externalEntry('https://codeforces.com/problemset/problem/1234/A')}
          onMarkSolved={noop}
          onViewInCurriculum={noop}
        />
      </ul>,
    );
    const link = screen.getByRole('link', { name: 'Pongal Bunk' });
    expect(link).toHaveAttribute('href', 'https://codeforces.com/problemset/problem/1234/A');
    expect(screen.getByText(/not on LeetCode · Codeforces/)).toBeInTheDocument();
  });

  it('leaves an unlisted external row unlinked — named, never guessed', () => {
    render(
      <ul>
        <SheetRowItem entry={externalEntry(null)} onMarkSolved={noop} onViewInCurriculum={noop} />
      </ul>,
    );
    const item = screen.getByText('Pongal Bunk').closest('li')!;
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(within(item).getByText(/not on LeetCode · Codeforces/)).toBeInTheDocument();
  });
});
