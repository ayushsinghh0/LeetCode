import type { PersistedStateV1 } from '@/types';
import { LocalStorageAdapter } from '@/services/storage/LocalStorageAdapter';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
import { createPersistenceMiddleware, loadInitialState } from '@/services/storage/persistence';
import { makeStore } from '@/store/store';
import { completeCourseSession, saveCourseNotes } from '@/store/actions';

const preCourseFixture = (): PersistedStateV1 => ({
  version: 1,
  progress: { byId: {}, dayLogs: {}, startDate: null },
  settings: { questionsPerDay: 8, revisionEnabled: true, theme: 'dark', notifications: false },
  gamification: { xp: 0, unlocked: {} },
});

// Pre-ladder shape: day fields + notes only — written by the first course release. Must keep
// validating and load with revision fields normalized in.
const legacyCourseFixture = (): PersistedStateV1 => ({
  ...preCourseFixture(),
  course: {
    byWeekId: {
      w00: { day1DoneOn: '2026-07-30', day2DoneOn: null, notes: 'tokenizers!' } as never,
    },
  },
});

const courseFixture = (): PersistedStateV1 => ({
  ...preCourseFixture(),
  course: {
    byWeekId: {
      w00: {
        day1DoneOn: '2026-07-30', day2DoneOn: null, notes: 'tokenizers!',
        revisionStage: 0, nextRevision: null, lastReviewed: null, revisionHistory: [],
      },
    },
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('validatePersisted with the optional course section', () => {
  test('accepts payloads with a well-formed course and payloads without one', () => {
    expect(validatePersisted(courseFixture())).toEqual(courseFixture());
    expect(validatePersisted(preCourseFixture())).toEqual(preCourseFixture());
  });

  test('accepts pre-ladder course entries (no revision fields) and rejects malformed ones', () => {
    expect(validatePersisted(legacyCourseFixture())).toEqual(legacyCourseFixture());

    const bad = {
      ...preCourseFixture(),
      course: {
        byWeekId: {
          w00: { day1DoneOn: null, day2DoneOn: null, notes: '', revisionStage: 'high' },
        },
      },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a course entry with a wrong-typed day stamp', () => {
    const bad = {
      ...preCourseFixture(),
      course: { byWeekId: { w00: { day1DoneOn: 12345, day2DoneOn: null, notes: '' } } },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a course entry missing notes', () => {
    const bad = {
      ...preCourseFixture(),
      course: { byWeekId: { w00: { day1DoneOn: null, day2DoneOn: null } } },
    };
    expect(validatePersisted(bad)).toBeNull();
  });

  test('rejects a course section whose byWeekId is not an object', () => {
    const bad = { ...preCourseFixture(), course: { byWeekId: 'nope' } };
    expect(validatePersisted(bad)).toBeNull();
  });
});

describe('selectPersistedState course projection', () => {
  test('omits the course key entirely while the track is untouched', () => {
    const store = makeStore();
    expect(selectPersistedState(store.getState())).not.toHaveProperty('course');
  });

  test('includes course once any week has progress or notes', () => {
    const store = makeStore();
    store.dispatch(saveCourseNotes('w04', 'kv cache'));

    const persisted = selectPersistedState(store.getState());
    expect(persisted.course?.byWeekId.w04!.notes).toBe('kv cache');
  });
});

describe('loadInitialState course mapping', () => {
  test('maps course into the preloaded slice when present, and omits it when absent', () => {
    class WithCourse {
      load(): PersistedStateV1 | null { return courseFixture(); }
      save(): void {}
    }
    class WithoutCourse {
      load(): PersistedStateV1 | null { return preCourseFixture(); }
      save(): void {}
    }

    expect(loadInitialState(new WithCourse())).toMatchObject({
      course: { byWeekId: { w00: { day1DoneOn: '2026-07-30' } } },
    });
    expect(loadInitialState(new WithoutCourse())).not.toHaveProperty('course');
  });

  test('normalizes pre-ladder entries so loaded state always carries revision fields', () => {
    class LegacyAdapter {
      load(): PersistedStateV1 | null { return legacyCourseFixture(); }
      save(): void {}
    }

    const preloaded = loadInitialState(new LegacyAdapter());
    expect(preloaded?.course?.byWeekId.w00).toEqual({
      day1DoneOn: '2026-07-30', day2DoneOn: null, notes: 'tokenizers!',
      revisionStage: 0, nextRevision: null, lastReviewed: null, revisionHistory: [],
    });
  });
});

describe('round trip: course progress survives a reload', () => {
  test('sessions + notes persist through LocalStorageAdapter into a fresh store', () => {
    const store1 = makeStore(undefined, [createPersistenceMiddleware(new LocalStorageAdapter())]);
    store1.dispatch(completeCourseSession('w00', 1));
    store1.dispatch(saveCourseNotes('w00', 'orientation done'));
    vi.advanceTimersByTime(500); // let the debounced save flush

    const store2 = makeStore(loadInitialState(new LocalStorageAdapter()));

    expect(store2.getState().course.byWeekId.w00!.day1DoneOn).toBe('2026-07-30');
    expect(store2.getState().course.byWeekId.w00!.notes).toBe('orientation done');
    expect(store2.getState().gamification.xp).toBe(store1.getState().gamification.xp);
  });
});
