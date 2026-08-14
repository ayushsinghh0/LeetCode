// The data layer behind the failure-evidence capture: lastMissNote (wave D's "What tripped it?"
// one-liner) and V7's classified miss kind, which attaches to the day's own fail event. Both are
// information, never penalty (copy rule 4).
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeStore } from '@/store/store';
import { classifyMiss, reviseQuestion, saveMissNote, solveQuestion } from '@/store/actions';

const TODAY = '2026-07-30';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
});

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

describe('classifyMiss — V7 slice 1', () => {
  // A question failed today: solve it, then grade the recall as a fail.
  function failedToday() {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(reviseQuestion(1, false));
    return store;
  }
  const lastEvent = (store: ReturnType<typeof makeStore>) => {
    const h = store.getState().progress.byId[1]!.revisionHistory;
    return h[h.length - 1]!;
  };

  test("attaches the kind to today's fail event, last-write-wins, clearable", () => {
    const store = failedToday();
    expect(lastEvent(store)).toEqual({ date: TODAY, passed: false });

    store.dispatch(classifyMiss(1, 'edge-case'));
    expect(lastEvent(store)).toEqual({ date: TODAY, passed: false, missKind: 'edge-case' });

    // Re-tapping another tag the same day overwrites — the learner's last read wins.
    store.dispatch(classifyMiss(1, 'implementation'));
    expect(lastEvent(store).missKind).toBe('implementation');

    // Tapping the active tag again clears it — retracting an uncertain read is honest.
    store.dispatch(classifyMiss(1, null));
    expect(lastEvent(store).missKind).toBeUndefined();
  });

  test('refuses a kind outside the registry — the thunk normalizes its own payload', () => {
    const store = failedToday();
    store.dispatch(classifyMiss(1, 'vibes'));
    expect(lastEvent(store).missKind).toBeUndefined();
  });

  test('writes nothing when the last event is a pass — a pass has no miss to classify', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(reviseQuestion(1, true));
    store.dispatch(classifyMiss(1, 'recall'));
    expect(lastEvent(store).missKind).toBeUndefined();
    expect(lastEvent(store).passed).toBe(true);
  });

  test("writes nothing when the fail is not today's — the capture window is the post-grade moment", () => {
    const store = failedToday();
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(classifyMiss(1, 'recall'));
    expect(lastEvent(store).missKind).toBeUndefined();
  });

  test('a question with no history, or an unknown id, is a no-op', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));
    store.dispatch(classifyMiss(1, 'recall')); // solved, but no review event yet
    expect(store.getState().progress.byId[1]!.revisionHistory).toEqual([]);
    store.dispatch(classifyMiss(999999, 'recall'));
    expect(store.getState().progress.byId[999999]).toBeUndefined();
  });
});
