import { describe, expect, test } from 'vitest';
import reducer, {
  drillRecorded,
  selectMissCounts,
  selectMostMissedPatterns,
} from '@/store/slices/drillsSlice';
import { stateImported, progressReset } from '@/store/sharedActions';
import type { DrillsState, PersistedStateV1 } from '@/types';

const empty: DrillsState = { byDate: {} };

const record = (date: string, correct: number, total: number, missed: string[] = []) =>
  drillRecorded({ date, correct, total, missedPatterns: missed });

describe('drillsSlice', () => {
  test('records the first attempt of a date with its misses', () => {
    const state = reducer(empty, record('2026-07-30', 6, 8, ['graphs', 'graphs', 'stacks']));
    expect(state.byDate['2026-07-30']).toEqual({
      correct: 6,
      total: 8,
      missedPatterns: ['graphs', 'graphs', 'stacks'],
    });
  });

  test('reruns on the same date are practice, not signal: first attempt wins', () => {
    const first = reducer(empty, record('2026-07-30', 4, 8, ['graphs']));
    const rerun = reducer(first, record('2026-07-30', 8, 8, []));
    expect(rerun.byDate['2026-07-30']).toEqual({ correct: 4, total: 8, missedPatterns: ['graphs'] });
  });

  test('stateImported replaces drills wholesale, defaulting when the payload predates them', () => {
    const seeded = reducer(empty, record('2026-07-30', 6, 8, ['graphs']));
    const payload = { version: 1 } as PersistedStateV1; // no drills field
    expect(reducer(seeded, stateImported(payload))).toEqual(empty);

    const withDrills = {
      version: 1,
      drills: { byDate: { '2026-07-01': { correct: 5, total: 8, missedPatterns: ['stacks'] } } },
    } as unknown as PersistedStateV1;
    const imported = reducer(seeded, stateImported(withDrills));
    expect(imported.byDate['2026-07-01']).toEqual({ correct: 5, total: 8, missedPatterns: ['stacks'] });
  });

  test('progressReset clears drill history', () => {
    const seeded = reducer(empty, record('2026-07-30', 6, 8, ['graphs']));
    expect(reducer(seeded, progressReset())).toEqual(empty);
  });

  test('selectMissCounts aggregates across dates and can exclude one date (today-stability)', () => {
    let state = empty;
    state = reducer(state, record('2026-07-29', 6, 8, ['graphs', 'stacks']));
    state = reducer(state, record('2026-07-30', 7, 8, ['graphs']));
    expect(selectMissCounts({ drills: state })).toEqual({ graphs: 2, stacks: 1 });
    expect(selectMissCounts({ drills: state }, '2026-07-30')).toEqual({ graphs: 1, stacks: 1 });
  });

  test('selectMostMissedPatterns needs repeated evidence: one miss is not a weakness', () => {
    let state = empty;
    state = reducer(state, record('2026-07-28', 5, 8, ['graphs', 'trie', 'stacks']));
    state = reducer(state, record('2026-07-29', 5, 8, ['graphs', 'trie', 'graphs']));
    expect(selectMostMissedPatterns({ drills: state })).toEqual([
      { pattern: 'graphs', count: 3 },
      { pattern: 'trie', count: 2 },
    ]);
  });
});
