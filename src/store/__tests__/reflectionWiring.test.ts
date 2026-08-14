// The data layer behind wave D's failure-note capture: lastMissNote is written on a fail via the
// "What tripped it?" one-liner and read back at the next post-grade. Last-write-wins, trimmed.
import { describe, test, expect } from 'vitest';
import { makeStore } from '@/store/store';
import { saveMissNote, solveQuestion } from '@/store/actions';

describe('saveMissNote', () => {
  test('stores a trimmed miss note on the question, last-write-wins', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));

    store.dispatch(saveMissNote(1, '  forgot the base case  '));
    expect(store.getState().progress.byId[1]!.lastMissNote).toBe('forgot the base case');

    store.dispatch(saveMissNote(1, 'off-by-one on the window'));
    expect(store.getState().progress.byId[1]!.lastMissNote).toBe('off-by-one on the window');
  });

  test('a blank note clears the field — retracting is honest', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(saveMissNote(1, 'something'));
    store.dispatch(saveMissNote(1, '   '));
    expect(store.getState().progress.byId[1]!.lastMissNote).toBe('');
  });

  test('an unknown question id is a no-op (no sparse entry materialized)', () => {
    const store = makeStore();
    store.dispatch(saveMissNote(999999, 'x'));
    expect(store.getState().progress.byId[999999]).toBeUndefined();
  });
});
