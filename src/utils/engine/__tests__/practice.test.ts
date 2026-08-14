import { describe, test, expect } from 'vitest';
import {
  MAX_INTENTIONS,
  PRACTICE_ACTIONS,
  isPracticeAction,
  normalizeIntentions,
  normalizeSitting,
  sittingCounts,
} from '@/utils/engine/practice';

describe('PRACTICE_ACTIONS registry', () => {
  test('every action has a key, a label and a real deep link, with unique keys', () => {
    const keys = new Set<string>();
    for (const a of PRACTICE_ACTIONS) {
      expect(a.key).not.toBe('');
      expect(a.label).not.toBe('');
      expect(a.href.startsWith('/')).toBe(true);
      keys.add(a.key);
    }
    expect(keys.size).toBe(PRACTICE_ACTIONS.length);
  });

  test('isPracticeAction recognizes registry keys and rejects strangers', () => {
    expect(isPracticeAction(PRACTICE_ACTIONS[0]!.key)).toBe(true);
    expect(isPracticeAction('delete-everything')).toBe(false);
    expect(isPracticeAction('')).toBe(false);
  });
});

describe('normalizeIntentions', () => {
  const valid = PRACTICE_ACTIONS[0]!.key;
  const other = PRACTICE_ACTIONS[1]!.key;

  test('trims the cue and keeps a well-formed intention', () => {
    expect(normalizeIntentions([{ cue: '  after coffee  ', action: valid }])).toEqual([
      { cue: 'after coffee', action: valid },
    ]);
  });

  test('drops an intention with a blank cue', () => {
    expect(normalizeIntentions([{ cue: '   ', action: valid }])).toEqual([]);
  });

  test('drops an intention whose action is not a known app action', () => {
    expect(normalizeIntentions([{ cue: 'after lunch', action: 'rm -rf' }])).toEqual([]);
  });

  test(`caps the list at ${MAX_INTENTIONS}, keeping the first valid ones in order`, () => {
    const many = Array.from({ length: MAX_INTENTIONS + 2 }, (_, i) => ({ cue: `cue ${i}`, action: i % 2 ? other : valid }));
    const result = normalizeIntentions(many);
    expect(result).toHaveLength(MAX_INTENTIONS);
    expect(result[0]!.cue).toBe('cue 0');
  });
});

describe('sittingCounts — follow-through measures committed work only', () => {
  const a = (id: string, kind: string) => ({ id, kind });

  test('the optional reflect and the drill pointer are excluded from planned and done', () => {
    const activities = [a('recall-1', 'recall'), a('review-2', 'review'), a('drill', 'drill'), a('reflect', 'reflect')];
    // Both reviews graded, the reflect ticked, the drill skipped — a full review session.
    expect(sittingCounts(activities, ['recall-1', 'review-2', 'reflect'])).toEqual({ planned: 2, done: 2 });
  });

  test('done counts only completed committed activities', () => {
    const activities = [a('recall-1', 'recall'), a('deep-2', 'deep'), a('transfer-3', 'transfer'), a('reflect', 'reflect')];
    expect(sittingCounts(activities, ['recall-1'])).toEqual({ planned: 3, done: 1 });
  });

  test('a session of only adjuncts has zero committed work', () => {
    expect(sittingCounts([a('drill', 'drill'), a('reflect', 'reflect')], ['drill', 'reflect'])).toEqual({
      planned: 0,
      done: 0,
    });
  });
});

describe('normalizeSitting', () => {
  test('passes a well-formed sitting through unchanged', () => {
    expect(normalizeSitting({ date: '2026-07-30', planned: 10, done: 3 })).toEqual({
      date: '2026-07-30',
      planned: 10,
      done: 3,
    });
  });

  test('clamps done into [0, planned] — you cannot complete more than was planned', () => {
    expect(normalizeSitting({ date: '2026-07-30', planned: 5, done: 9 }).done).toBe(5);
    expect(normalizeSitting({ date: '2026-07-30', planned: 5, done: -2 }).done).toBe(0);
  });

  test('floors non-integer / non-finite counts to a persistable shape', () => {
    expect(normalizeSitting({ date: '2026-07-30', planned: 5.9, done: 2.9 })).toEqual({
      date: '2026-07-30',
      planned: 5,
      done: 2,
    });
    expect(normalizeSitting({ date: '2026-07-30', planned: NaN, done: NaN })).toEqual({
      date: '2026-07-30',
      planned: 0,
      done: 0,
    });
  });
});
