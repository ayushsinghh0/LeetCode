// The practice layer's store surface: the intentions/journal/sittings channel, the two authoring
// thunks, and the sitting ledger written at a session's finish or partial stop.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import reducer, { intentionsSet, journalWritten, sittingRecorded } from '@/store/slices/practiceSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { makeStore, type AppStore } from '@/store/store';
import {
  clearRevisionSession,
  completeSessionActivity,
  finishRevisionSession,
  setIntentions,
  startRevisionSession,
  writeJournal,
} from '@/store/actions';
import { SITTINGS_CAP, PRACTICE_ACTIONS } from '@/utils/engine/practice';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import questionsData from '@/data/questions.json';
import type { PersistedStateV1, PracticeState, Question, QuestionProgress } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';
const empty: PracticeState = { intentions: [], journal: {}, sittings: [] };
const validAction = PRACTICE_ACTIONS[0]!.key;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
});

/* --- Slice reducers -------------------------------------------------------------------------- */

describe('practiceSlice reducers', () => {
  test('intentionsSet replaces the whole list', () => {
    const seeded = reducer(empty, intentionsSet([{ cue: 'after coffee', action: validAction }]));
    const replaced = reducer(seeded, intentionsSet([{ cue: 'after lunch', action: validAction }]));
    expect(replaced.intentions).toEqual([{ cue: 'after lunch', action: validAction }]);
  });

  test('journalWritten is last-write-wins per date; an empty line clears the entry', () => {
    const a = reducer(empty, journalWritten({ date: TODAY, line: 'first' }));
    const b = reducer(a, journalWritten({ date: TODAY, line: 'second' }));
    expect(b.journal[TODAY]).toBe('second');
    const c = reducer(b, journalWritten({ date: TODAY, line: '' }));
    expect(c.journal[TODAY]).toBeUndefined();
  });

  test('sittingRecorded appends, and the ledger is capped to the most recent SITTINGS_CAP', () => {
    let state = empty;
    for (let i = 0; i < SITTINGS_CAP + 5; i++) {
      state = reducer(state, sittingRecorded({ date: TODAY, planned: 3, done: i }));
    }
    expect(state.sittings).toHaveLength(SITTINGS_CAP);
    // The oldest five aged out; the newest survives.
    expect(state.sittings[state.sittings.length - 1]!.done).toBe(SITTINGS_CAP + 4);
    expect(state.sittings[0]!.done).toBe(5);
  });

  test('stateImported replaces wholesale, defaulting when the payload predates practice', () => {
    const seeded = reducer(empty, journalWritten({ date: TODAY, line: 'x' }));
    expect(reducer(seeded, stateImported({ version: 1 } as PersistedStateV1))).toEqual(empty);

    const withPractice = {
      version: 1,
      practice: {
        intentions: [{ cue: 'c', action: validAction }],
        journal: { '2026-07-01': 'y' },
        sittings: [{ date: '2026-07-01', planned: 2, done: 2 }],
      },
    } as unknown as PersistedStateV1;
    expect(reducer(seeded, stateImported(withPractice))).toEqual(withPractice.practice);
  });

  test('progressReset clears everything', () => {
    const seeded = reducer(empty, journalWritten({ date: TODAY, line: 'x' }));
    expect(reducer(seeded, progressReset())).toEqual(empty);
  });
});

/* --- Authoring thunks ----------------------------------------------------------------------- */

describe('setIntentions thunk normalizes its own payload', () => {
  test('trims, drops the invalid, and caps at three — in order', () => {
    const store = makeStore();
    store.dispatch(
      setIntentions([
        { cue: '  a  ', action: validAction },
        { cue: '', action: validAction }, // blank cue dropped
        { cue: 'b', action: 'not-an-action' }, // unknown action dropped
        { cue: 'c', action: validAction },
        { cue: 'd', action: validAction },
        { cue: 'e', action: validAction }, // over the cap
      ]),
    );
    expect(store.getState().practice.intentions.map((i) => i.cue)).toEqual(['a', 'c', 'd']);
  });
});

describe('writeJournal thunk', () => {
  test("writes today's line, trimmed", () => {
    const store = makeStore();
    store.dispatch(writeJournal('  named the invariant  '));
    expect(store.getState().practice.journal[TODAY]).toBe('named the invariant');
  });
});

/* --- Sittings written at finish / partial stop ---------------------------------------------- */

describe('revision sittings are banked at finish and at partial stop', () => {
  // Several due recalls, so startRevisionSession freezes a real multi-activity plan.
  function runningStore(): AppStore {
    const byId: Record<number, QuestionProgress> = {};
    for (const q of questions) {
      byId[q.id] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: '2026-08-15' };
    }
    for (const id of [1, 2, 3, 4, 5]) {
      byId[id] = { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: TODAY };
    }
    const store = makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-01-01' } });
    store.dispatch(startRevisionSession());
    return store;
  }

  // Committed work only: the optional reflect and the drill pointer are adjuncts, excluded from
  // both sides of a sitting (see sittingCounts). The default 180-minute plan carries a reflect,
  // so these fixtures genuinely exercise the exclusion.
  function committed(store: AppStore) {
    return store.getState().session.frozen!.activities.filter((a) => a.kind !== 'drill' && a.kind !== 'reflect');
  }

  test('finishing banks one sitting counting committed activities only', () => {
    const store = runningStore();
    const activities = store.getState().session.frozen!.activities;
    const plan = committed(store);
    expect(plan.length).toBeGreaterThan(0);
    // The fixture must contain an adjunct, or this test would pass under raw counting too.
    expect(activities.length).toBeGreaterThan(plan.length);

    store.dispatch(completeSessionActivity(plan[0]!.id));
    store.dispatch(completeSessionActivity('reflect')); // ticking the adjunct must not count
    store.dispatch(finishRevisionSession());

    expect(store.getState().practice.sittings).toEqual([{ date: TODAY, planned: plan.length, done: 1 }]);
  });

  test('stopping mid-session with work done banks a partial sitting, and still clears', () => {
    const store = runningStore();
    const plan = committed(store);
    store.dispatch(completeSessionActivity(plan[0]!.id));
    store.dispatch(clearRevisionSession());

    expect(store.getState().practice.sittings).toEqual([{ date: TODAY, planned: plan.length, done: 1 }]);
    expect(store.getState().session.frozen).toBeNull();
  });

  test('stopping with nothing done banks no sitting — a non-attempt is not a follow-through failure', () => {
    const store = runningStore();
    store.dispatch(clearRevisionSession());
    expect(store.getState().practice.sittings).toEqual([]);
  });

  test('stopping having ticked only the reflect banks nothing — an adjunct is not revision done', () => {
    const store = runningStore();
    expect(store.getState().session.frozen!.activities.some((a) => a.kind === 'reflect')).toBe(true);
    store.dispatch(completeSessionActivity('reflect'));
    store.dispatch(clearRevisionSession());
    expect(store.getState().practice.sittings).toEqual([]);
  });

  test('finishing then planning another (clear) does not double-book the sitting', () => {
    const store = runningStore();
    store.dispatch(completeSessionActivity(store.getState().session.frozen!.activities[0]!.id));
    store.dispatch(finishRevisionSession());
    expect(store.getState().practice.sittings).toHaveLength(1);

    store.dispatch(clearRevisionSession()); // the "Plan another session" button
    expect(store.getState().practice.sittings).toHaveLength(1);
  });

  test('finishing or clearing with no running session banks nothing', () => {
    const store = makeStore();
    store.dispatch(finishRevisionSession());
    store.dispatch(clearRevisionSession());
    expect(store.getState().practice.sittings).toEqual([]);
  });
});
