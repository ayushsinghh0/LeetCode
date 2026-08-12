import type { PersistedStateV1 } from '@/types';
import type { StorageAdapter } from '@/services/storage/StorageAdapter';
import { LocalStorageAdapter } from '@/services/storage/LocalStorageAdapter';
import { selectPersistedState, validatePersisted, exportAsJson } from '@/services/storage/serialize';
import { createPersistenceMiddleware, loadInitialState } from '@/services/storage/persistence';
import { makeStore } from '@/store/store';
import { solveQuestion } from '@/store/actions';
import { stateImported, progressReset } from '@/store/sharedActions';
import { settingsUpdated } from '@/store/slices/settingsSlice';

const STORAGE_KEY = 'dsa-roadmap:v1';

const validFixture: PersistedStateV1 = {
  version: 1,
  progress: {
    byId: {
      1: {
        status: 'solved',
        revisionStage: 2,
        nextRevision: '2026-08-01',
        lastReviewed: '2026-07-30',
        revisionHistory: [{ date: '2026-07-30', passed: true }],
        notes: 'some notes',
        bookmarked: true,
        completedAt: '2026-07-30',
        confidence: 4,
        timeSpentMin: 15,
      },
    },
    dayLogs: {
      '2026-07-30': {
        date: '2026-07-30',
        solvedIds: [1],
        revisionsPassed: [],
        revisionsFailed: [],
        xpEarned: 10,
        focusMinutes: 0,
      },
    },
    startDate: '2026-07-30',
  },
  settings: {
    questionsPerDay: 8,
    revisionEnabled: true,
    theme: 'dark',
    notifications: false,
  },
  gamification: {
    xp: 10,
    unlocked: { 'first-solve': '2026-07-30' },
  },
};

// A minimal in-memory adapter used to unit-test the middleware in isolation from real
// localStorage. `save` is a spy so call counts/args can be asserted directly.
class FakeAdapter implements StorageAdapter {
  public saved: PersistedStateV1[] = [];
  load(): PersistedStateV1 | null {
    return null;
  }
  save(state: PersistedStateV1): void {
    this.saved.push(state);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- serialize.ts: selectPersistedState -----------------------------------------------------

describe('selectPersistedState', () => {
  test('builds a PersistedStateV1 snapshot from RootState, excluding ui', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));

    const persisted = selectPersistedState(store.getState());

    expect(persisted.version).toBe(1);
    expect(persisted.progress.byId[1]!.status).toBe('solved');
    expect(persisted.progress.startDate).toBe('2026-07-30');
    expect(persisted.settings).toEqual(store.getState().settings);
    expect(persisted.gamification).toEqual(store.getState().gamification);
    expect(persisted).not.toHaveProperty('ui');
  });
});

// --- serialize.ts: validatePersisted ---------------------------------------------------------

describe('validatePersisted', () => {
  test('accepts a well-formed PersistedStateV1', () => {
    expect(validatePersisted(validFixture)).toEqual(validFixture);
  });

  test('rejects version: 2', () => {
    expect(validatePersisted({ ...validFixture, version: 2 })).toBeNull();
  });

  test('rejects missing progress key', () => {
    const { progress: _progress, ...rest } = validFixture;
    expect(validatePersisted(rest)).toBeNull();
  });

  test('rejects missing settings key', () => {
    const { settings: _settings, ...rest } = validFixture;
    expect(validatePersisted(rest)).toBeNull();
  });

  test('rejects missing gamification key', () => {
    const { gamification: _gamification, ...rest } = validFixture;
    expect(validatePersisted(rest)).toBeNull();
  });

  test('rejects non-object input (string)', () => {
    expect(validatePersisted('not an object')).toBeNull();
  });

  test('rejects non-object input (number)', () => {
    expect(validatePersisted(42)).toBeNull();
  });

  test('rejects null', () => {
    expect(validatePersisted(null)).toBeNull();
  });

  test('rejects undefined', () => {
    expect(validatePersisted(undefined)).toBeNull();
  });

  test('rejects wrong-typed nested fields (settings.questionsPerDay as string)', () => {
    const bad = { ...validFixture, settings: { ...validFixture.settings, questionsPerDay: '8' } };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects wrong-typed progress.byId (array instead of record is still an object, but a plain string is not)', () => {
    const bad = { ...validFixture, progress: { ...validFixture.progress, byId: 'nope' } };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects gamification.xp of wrong type', () => {
    const bad = { ...validFixture, gamification: { ...validFixture.gamification, xp: 'lots' } };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects gamification.unlocked with a non-string value', () => {
    const bad = {
      ...validFixture,
      gamification: { ...validFixture.gamification, unlocked: { 'first-solve': 12345 } },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  // --- Deep per-entry validation (progress.byId / progress.dayLogs) --------------------------
  // Carried forward from Task 10: validatePersisted used to stop at "is progress.byId an
  // object" — a malformed-but-version-1 file with wrong-typed fields inside an entry passed
  // straight through. These cases matter now that untrusted JSON reaches stateImported via the
  // Settings page's import-from-file flow.

  test('rejects a progress.byId entry with a wrong-typed status', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], status: 'done' } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a progress.byId entry with a non-array revisionHistory', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], revisionHistory: 'nope' } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a progress.byId entry whose revisionHistory contains a malformed event', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], revisionHistory: [{ date: '2026-07-30', passed: 'yes' }] } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a progress.byId entry with an out-of-range confidence', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], confidence: 9 } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a progress.byId entry missing a required field (timeSpentMin)', () => {
    const { timeSpentMin: _timeSpentMin, ...entryWithoutTimeSpent } = validFixture.progress.byId[1]!;
    const bad = {
      ...validFixture,
      progress: { ...validFixture.progress, byId: { 1: entryWithoutTimeSpent } },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('accepts a progress.byId entry with confidence: null and nextRevision: null', () => {
    const ok = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], confidence: null, nextRevision: null } },
      },
    };
    expect(validatePersisted(ok)).toEqual(ok);
  });

  test('rejects a dayLogs entry missing the solvedIds array', () => {
    const { solvedIds: _solvedIds, ...logWithoutSolvedIds } = validFixture.progress.dayLogs['2026-07-30']!;
    const bad = {
      ...validFixture,
      progress: { ...validFixture.progress, dayLogs: { '2026-07-30': logWithoutSolvedIds } },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a dayLogs entry whose solvedIds contains a non-number', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        dayLogs: { '2026-07-30': { ...validFixture.progress.dayLogs['2026-07-30'], solvedIds: [1, '2'] } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a dayLogs entry with a wrong-typed xpEarned', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        dayLogs: { '2026-07-30': { ...validFixture.progress.dayLogs['2026-07-30'], xpEarned: '10' } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  // --- Domain-range validation: type-correct but semantically poisonous values ---------------
  // The engine compares dates as yyyy-MM-dd strings and indexes the ladder by stage, so a
  // "valid number"/"valid string" that violates those domains must be rejected wholesale.

  test.each([[-1], [99], [2.5]])('rejects an out-of-range revisionStage (%s)', (stage) => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        byId: { 1: { ...validFixture.progress.byId[1], revisionStage: stage } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test.each([['2026-1-5'], ['tomorrow'], ['2026-07-30T12:00:00Z']])(
    'rejects a non-yyyy-MM-dd nextRevision (%s)',
    (date) => {
      const bad = {
        ...validFixture,
        progress: {
          ...validFixture.progress,
          byId: { 1: { ...validFixture.progress.byId[1], nextRevision: date } },
        },
      };
      expect(validatePersisted(bad)).toBeNull();
    },
  );

  test('rejects NaN/negative counters (gamification.xp, dayLog.focusMinutes)', () => {
    const nanXp = { ...validFixture, gamification: { ...validFixture.gamification, xp: NaN } };
    expect(validatePersisted(nanXp)).toBeNull();

    const negativeFocus = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        dayLogs: { '2026-07-30': { ...validFixture.progress.dayLogs['2026-07-30'], focusMinutes: -5 } },
      },
    };
    expect(validatePersisted(negativeFocus)).toBeNull();
  });

  test('rejects a dayLogs key that is not a yyyy-MM-dd date', () => {
    const bad = {
      ...validFixture,
      progress: {
        ...validFixture.progress,
        dayLogs: { 'someday': { ...validFixture.progress.dayLogs['2026-07-30'] } },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('accepts the optional gamification bonus gates and rejects malformed ones', () => {
    const withGates = {
      ...validFixture,
      gamification: { ...validFixture.gamification, dailyGoalBonusDate: '2026-07-30', weeklyClearBonusDay: 7 },
    };
    expect(validatePersisted(withGates)).toEqual(withGates);

    const badDate = {
      ...validFixture,
      gamification: { ...validFixture.gamification, dailyGoalBonusDate: 'yesterday' },
    };
    expect(validatePersisted(badDate)).toBeNull();

    const badDay = {
      ...validFixture,
      gamification: { ...validFixture.gamification, weeklyClearBonusDay: 6.5 },
    };
    expect(validatePersisted(badDay)).toBeNull();
  });

  test('drops unknown extra keys instead of smuggling them into the store', () => {
    const withExtras = { ...validFixture, futureField: 'surprise' };
    const result = validatePersisted(withExtras);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('futureField');
  });
});

// --- serialize.ts: exportAsJson ---------------------------------------------------------------

describe('exportAsJson', () => {
  test('returns pretty-printed (2-space) JSON matching selectPersistedState', () => {
    const store = makeStore();
    store.dispatch(solveQuestion(1));

    const json = exportAsJson(store.getState());
    const expected = JSON.stringify(selectPersistedState(store.getState()), null, 2);

    expect(json).toBe(expected);
    expect(JSON.parse(json)).toEqual(selectPersistedState(store.getState()));
  });
});

// --- LocalStorageAdapter -----------------------------------------------------------------------

describe('LocalStorageAdapter', () => {
  test('save() then load() round-trips a valid PersistedStateV1', () => {
    const adapter = new LocalStorageAdapter();
    adapter.save(validFixture);

    expect(adapter.load()).toEqual(validFixture);
  });

  test('save() writes under the "dsa-roadmap:v1" key', () => {
    const adapter = new LocalStorageAdapter();
    adapter.save(validFixture);

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(validFixture);
  });

  test('load() returns null when nothing is stored', () => {
    const adapter = new LocalStorageAdapter();
    expect(adapter.load()).toBeNull();
  });

  test('load() returns null on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const adapter = new LocalStorageAdapter();
    expect(adapter.load()).toBeNull();
  });

  test('load() returns null when stored JSON fails structural validation', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foo: 'bar' }));
    const adapter = new LocalStorageAdapter();
    expect(adapter.load()).toBeNull();
  });

  test('save() never throws even if localStorage.setItem throws (quota/security error)', () => {
    const adapter = new LocalStorageAdapter();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => adapter.save(validFixture)).not.toThrow();

    spy.mockRestore();
  });

  test('load() quarantines an unreadable-but-present payload so a later save cannot destroy it', () => {
    const foreign = JSON.stringify({ version: 2, someFutureShape: true });
    localStorage.setItem(STORAGE_KEY, foreign);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(new LocalStorageAdapter().load()).toBeNull();

    expect(localStorage.getItem('dsa-roadmap:v1:quarantine')).toBe(foreign);
    warn.mockRestore();
  });

  test('quarantine keeps the earliest snapshot — a second failure never clobbers it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, '{"version":2,"first":true}');
    new LocalStorageAdapter().load();

    localStorage.setItem(STORAGE_KEY, '{corrupt-garbage');
    new LocalStorageAdapter().load();

    expect(localStorage.getItem('dsa-roadmap:v1:quarantine')).toBe('{"version":2,"first":true}');
    warn.mockRestore();
  });

  test('load() never throws even if localStorage.getItem throws (security error)', () => {
    const adapter = new LocalStorageAdapter();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => adapter.load()).not.toThrow();
    expect(adapter.load()).toBeNull();

    spy.mockRestore();
  });
});

// --- persistence.ts: createPersistenceMiddleware (debounce) ------------------------------------

describe('createPersistenceMiddleware debounce behavior', () => {
  test('does not save before the debounce window elapses', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1));

    expect(adapter.saved).toHaveLength(0);
  });

  test('saves once after the debounce window elapses following a single dispatch', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1));
    vi.advanceTimersByTime(500);

    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]!.progress.byId[1]!.status).toBe('solved');
  });

  test('two rapid dispatches collapse into a single save (debounced)', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1));
    vi.advanceTimersByTime(100); // well within the debounce window
    store.dispatch(solveQuestion(2));
    vi.advanceTimersByTime(500);

    expect(adapter.saved).toHaveLength(1);
    // the single save reflects the latest state (both solves applied)
    expect(adapter.saved[0]!.progress.byId[1]!.status).toBe('solved');
    expect(adapter.saved[0]!.progress.byId[2]!.status).toBe('solved');
  });

  test('a dispatch after the debounce window schedules a second, independent save', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1));
    vi.advanceTimersByTime(500);
    expect(adapter.saved).toHaveLength(1);

    store.dispatch(solveQuestion(2));
    vi.advanceTimersByTime(500);
    expect(adapter.saved).toHaveLength(2);
  });
});

// --- persistence.ts: immediate flush on stateImported / progressReset --------------------------

describe('createPersistenceMiddleware immediate flush', () => {
  test('stateImported flushes synchronously without waiting for the debounce', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(stateImported(validFixture));

    // No vi.advanceTimersByTime call at all: if this were debounced, saved would still be empty.
    // The saved payload is the store's own state, where the boundary normalizes the optional
    // fields in (bonus gates -> null, dailyCapacityMin -> 180).
    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]).toEqual({
      ...validFixture,
      settings: { ...validFixture.settings, dailyCapacityMin: 180 },
      gamification: { ...validFixture.gamification, dailyGoalBonusDate: null, weeklyClearBonusDay: null },
    });
  });

  test('progressReset flushes synchronously without waiting for the debounce', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1));
    store.dispatch(progressReset());

    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]!.progress.byId).toEqual({});
    expect(adapter.saved[0]!.gamification.xp).toBe(0);
  });

  test('an immediate flush cancels a pending debounced save so it does not fire twice', () => {
    const adapter = new FakeAdapter();
    const store = makeStore(undefined, [createPersistenceMiddleware(adapter, 500)]);

    store.dispatch(solveQuestion(1)); // schedules a debounced save
    store.dispatch(progressReset()); // flushes immediately, should cancel the pending timer

    expect(adapter.saved).toHaveLength(1); // only the immediate flush so far

    vi.advanceTimersByTime(500); // the pending debounce timer, if not cancelled, would fire here

    expect(adapter.saved).toHaveLength(1); // still just one save total
  });
});

// --- persistence.ts: loadInitialState -----------------------------------------------------------

describe('loadInitialState', () => {
  test('returns undefined when the adapter has nothing stored', () => {
    const adapter = new FakeAdapter();
    expect(loadInitialState(adapter)).toBeUndefined();
  });

  test('maps a PersistedStateV1 into RootState slice shapes', () => {
    class LoadedAdapter implements StorageAdapter {
      load(): PersistedStateV1 | null {
        return validFixture;
      }
      save(): void {
        // unused in this test
      }
    }

    const preloaded = loadInitialState(new LoadedAdapter());

    expect(preloaded).toEqual({
      progress: validFixture.progress,
      // Optional fields default at the load boundary (capacity -> 180, bonus gates -> null).
      settings: { ...validFixture.settings, dailyCapacityMin: 180 },
      gamification: { ...validFixture.gamification, dailyGoalBonusDate: null, weeklyClearBonusDay: null },
    });
  });
});

// --- Integration: full round trip through real LocalStorageAdapter + makeStore -----------------

describe('round trip: makeStore -> persist -> reload into a fresh store', () => {
  test('solved count, xp, and settings survive a reload after the debounce flushes', () => {
    const adapter1 = new LocalStorageAdapter();
    const store1 = makeStore(undefined, [createPersistenceMiddleware(adapter1)]);

    store1.dispatch(solveQuestion(1));
    store1.dispatch(solveQuestion(2));
    store1.dispatch(solveQuestion(3));
    store1.dispatch(settingsUpdated({ questionsPerDay: 5 }));

    // Advance past the default 500ms debounce so the last dispatch's scheduled save fires.
    vi.advanceTimersByTime(500);

    const adapter2 = new LocalStorageAdapter(); // simulates a fresh page load / new adapter instance
    const preloaded = loadInitialState(adapter2);
    expect(preloaded).toBeDefined();

    const store2 = makeStore(preloaded);

    const solvedCount = Object.values(store2.getState().progress.byId).filter(
      (p) => p.status === 'solved',
    ).length;
    expect(solvedCount).toBe(3);
    expect(store2.getState().gamification.xp).toBe(store1.getState().gamification.xp);
    expect(store2.getState().settings).toEqual(store1.getState().settings);
    expect(store2.getState().settings.questionsPerDay).toBe(5);
  });
});
