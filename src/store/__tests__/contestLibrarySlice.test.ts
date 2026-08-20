import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '@/store/store';
import { reviseLibraryProblem } from '@/store/actions';
import {
  contestProblemAttempted,
  contestProblemReviewed,
  contestProblemSolved,
} from '@/store/slices/contestLibrarySlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
import { loadInitialState } from '@/services/storage/persistence';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import type { PersistedStateV1 } from '@/types';

const SLUG = 'maximum-subarray-sum-after-multiplier';

function emptyPersisted(): PersistedStateV1 {
  return {
    version: 1,
    progress: { byId: {}, dayLogs: {}, startDate: null },
    settings: { questionsPerDay: 8, revisionEnabled: true, theme: 'dark', notifications: false },
    gamification: { xp: 0, unlocked: {} },
  };
}

describe('contestLibrarySlice', () => {
  it('starts empty and sparse', () => {
    const store = makeStore();
    expect(store.getState().contestLibrary.bySlug).toEqual({});
  });

  it('records an attempt without claiming a solve', () => {
    const store = makeStore();
    store.dispatch(contestProblemAttempted({ slug: SLUG, date: '2026-07-30' }));
    const entry = store.getState().contestLibrary.bySlug[SLUG]!;
    expect(entry.attempts).toBe(1);
    expect(entry.solved).toBe(false);
    expect(entry.nextRevision).toBeNull();
  });

  it('enters the shared ladder on a solve', () => {
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));
    const entry = store.getState().contestLibrary.bySlug[SLUG]!;
    expect(entry.solved).toBe(true);
    expect(entry.solvedOn).toBe('2026-07-30');
    expect(entry.nextRevision).toBe('2026-07-31');
  });

  it('refuses to review a problem that was never solved', () => {
    const store = makeStore();
    store.dispatch(contestProblemAttempted({ slug: SLUG, date: '2026-07-30' }));
    store.dispatch(contestProblemReviewed({ slug: SLUG, date: '2026-07-31', passed: true }));
    // Grading something never solved would schedule a review of work that never happened.
    expect(store.getState().contestLibrary.bySlug[SLUG]!.revisionHistory).toEqual([]);
  });

  it('climbs the ladder on a pass and restarts it on a fail', () => {
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-01' }));
    store.dispatch(contestProblemReviewed({ slug: SLUG, date: '2026-07-02', passed: true }));
    expect(store.getState().contestLibrary.bySlug[SLUG]!.revisionStage).toBe(1);

    store.dispatch(contestProblemReviewed({ slug: SLUG, date: '2026-07-05', passed: false }));
    const entry = store.getState().contestLibrary.bySlug[SLUG]!;
    expect(entry.revisionStage).toBe(0);
    expect(entry.nextRevision).toBe('2026-07-06');
    expect(entry.revisionHistory).toHaveLength(2);
  });

  /**
   * THE COLLISION GUARD.
   *
   * `progress.byId` is keyed by roadmap ids 1-539 and LeetCode's ids run past 4,000. Had contest
   * progress shared that numeric key space, solving a contest problem would have silently
   * overwritten a curriculum question. Keying by slug is what makes that impossible, and this
   * test is what stops anyone "simplifying" it back.
   */
  it('never touches curriculum progress', () => {
    const store = makeStore({
      progress: { byId: { 47: { ...initialProgress(), status: 'solved' } }, dayLogs: {}, startDate: '2026-07-01' },
    });
    store.dispatch(contestProblemSolved({ slug: 'some-contest-problem', date: '2026-07-30' }));
    expect(store.getState().progress.byId[47]!.status).toBe('solved');
    expect(Object.keys(store.getState().progress.byId)).toEqual(['47']);
  });

  it('clears on reset', () => {
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));
    store.dispatch(progressReset());
    expect(store.getState().contestLibrary.bySlug).toEqual({});
  });
});

describe('contest library persistence', () => {
  it('writes nothing for a learner who never opened Contest Practice', () => {
    const store = makeStore();
    // A pre-V13 payload and an untouched V13 one must be byte-identical.
    expect(selectPersistedState(store.getState()).contestLibrary).toBeUndefined();
  });

  it('round-trips every state the UI can actually produce', () => {
    const store = makeStore();
    store.dispatch(contestProblemAttempted({ slug: 'a-problem', date: '2026-07-28' }));
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-29' }));
    store.dispatch(contestProblemReviewed({ slug: SLUG, date: '2026-07-30', passed: true }));
    store.dispatch(contestProblemReviewed({ slug: SLUG, date: '2026-07-31', passed: false }));

    const persisted = selectPersistedState(store.getState());
    // A validator stricter than its own write path is a data-loss bug — everything the reducers
    // can write must survive validation, or the next load quarantines the learner's whole state.
    const validated = validatePersisted(JSON.parse(JSON.stringify(persisted)));
    expect(validated).not.toBeNull();
    expect(validated!.contestLibrary!.bySlug[SLUG]).toEqual(persisted.contestLibrary!.bySlug[SLUG]);

    const restored = makeStore();
    restored.dispatch(stateImported(validated!));
    expect(restored.getState().contestLibrary.bySlug).toEqual(store.getState().contestLibrary.bySlug);
  });

  it('loads a payload that predates the contest library', () => {
    expect(validatePersisted(emptyPersisted())).not.toBeNull();
    const store = makeStore();
    store.dispatch(stateImported(emptyPersisted()));
    expect(store.getState().contestLibrary.bySlug).toEqual({});
  });

  it('accepts an unrecognised slug rather than quarantining the whole payload', () => {
    // A problem retired from the generated library must make its record inert, never destroy the
    // learner's state. Readers that cannot resolve a slug simply show nothing for it.
    const payload = emptyPersisted();
    payload.contestLibrary = {
      bySlug: {
        'a-problem-that-no-longer-exists': {
          solved: true,
          attempts: 1,
          lastAttemptedOn: '2026-07-01',
          solvedOn: '2026-07-01',
          revisionStage: 2,
          nextRevision: '2026-07-08',
          lastReviewed: '2026-07-04',
          revisionHistory: [{ date: '2026-07-04', passed: true }],
        },
      },
    };
    expect(validatePersisted(JSON.parse(JSON.stringify(payload)))).not.toBeNull();
  });

  it('rejects a structurally corrupt record', () => {
    const payload = emptyPersisted();
    // revisionStage outside 0..5 cannot be produced by any write path, so it means corruption.
    payload.contestLibrary = {
      bySlug: {
        broken: {
          solved: true,
          attempts: 1,
          lastAttemptedOn: null,
          solvedOn: null,
          revisionStage: 9,
          nextRevision: null,
          lastReviewed: null,
          revisionHistory: [],
        },
      },
    };
    expect(validatePersisted(JSON.parse(JSON.stringify(payload)))).toBeNull();
  });
});

/**
 * The thunk is the public mutation API (repo law: UI never dispatches slice actions), and it
 * carries the guards the reducer deliberately does not: the once-per-day gate and the XP.
 */
describe('reviseLibraryProblem — the ladder guards live in the thunk', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${iso}T12:00:00`));
  }

  it('pays revisionXp on a pass AND on a fail — the ladder is what a miss changes, not the reward', () => {
    at('2026-07-31');
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));

    store.dispatch(reviseLibraryProblem(SLUG, 'medium', false));
    expect(store.getState().gamification.xp).toBe(10); // revisionXp('medium')
    expect(store.getState().contestLibrary.bySlug[SLUG]!.revisionStage).toBe(0);
    expect(store.getState().contestLibrary.bySlug[SLUG]!.nextRevision).toBe('2026-08-01');
  });

  it('takes one grade per calendar day', () => {
    at('2026-07-31');
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));

    store.dispatch(reviseLibraryProblem(SLUG, 'easy', true));
    store.dispatch(reviseLibraryProblem(SLUG, 'easy', true));

    // A second same-day grade would double-move the 1/3/7/15/30 ladder and double-pay the XP.
    expect(store.getState().contestLibrary.bySlug[SLUG]!.revisionHistory).toHaveLength(1);
    expect(store.getState().gamification.xp).toBe(5);
  });

  it('refuses a problem that was never solved, and one already mastered', () => {
    at('2026-07-31');
    const unsolved = makeStore();
    unsolved.dispatch(contestProblemAttempted({ slug: SLUG, date: '2026-07-30' }));
    unsolved.dispatch(reviseLibraryProblem(SLUG, 'hard', true));
    expect(unsolved.getState().contestLibrary.bySlug[SLUG]!.revisionHistory).toEqual([]);
    expect(unsolved.getState().gamification.xp).toBe(0);

    // Mastered problems have left the ladder (nextRevision null); grading one would put it back.
    const mastered = makeStore();
    mastered.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-01-01' }));
    for (const date of ['2026-01-02', '2026-01-05', '2026-01-12', '2026-01-27', '2026-02-26']) {
      mastered.dispatch(contestProblemReviewed({ slug: SLUG, date, passed: true }));
    }
    expect(mastered.getState().contestLibrary.bySlug[SLUG]!.revisionStage).toBe(5);
    const xpBefore = mastered.getState().gamification.xp;
    mastered.dispatch(reviseLibraryProblem(SLUG, 'hard', true));
    expect(mastered.getState().contestLibrary.bySlug[SLUG]!.revisionHistory).toHaveLength(5);
    expect(mastered.getState().gamification.xp).toBe(xpBefore);
  });

  it('writes no day log — DayLog is the curriculum ledger', () => {
    at('2026-07-31');
    const store = makeStore();
    store.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));
    store.dispatch(reviseLibraryProblem(SLUG, 'medium', true));

    expect(store.getState().progress.dayLogs['2026-07-31']).toBeUndefined();
  });
});

/**
 * THE BOOT PATH, which is not the import path — and the distinction cost this feature three
 * slices of silent data loss.
 *
 * A persisted channel is read twice: `stateImported` restores a payload the learner uploaded, and
 * `loadInitialState` maps localStorage into `makeStore`'s preloadedState on every page load.
 * Between slices 3 and 6 the contest library was wired into the write path and into
 * `stateImported` but NOT into `loadInitialState`, so every contest solve was saved correctly and
 * then discarded the next time the app started. The tests above — the ones that look like the
 * persistence tests — all exercise the import path and stayed green throughout.
 */
describe('contest library survives a reload, not just an import', () => {
  it('maps the channel into preloaded state, and omits it when the payload predates V13', () => {
    const payload = emptyPersisted();
    payload.contestLibrary = {
      bySlug: {
        [SLUG]: {
          solved: true,
          attempts: 2,
          lastAttemptedOn: '2026-07-30',
          solvedOn: '2026-07-30',
          revisionStage: 1,
          nextRevision: '2026-08-02',
          lastReviewed: '2026-07-31',
          revisionHistory: [{ date: '2026-07-31', passed: true }],
        },
      },
    };

    const withLibrary = loadInitialState({ load: () => payload, save: () => {} });
    expect(withLibrary?.contestLibrary?.bySlug[SLUG]?.nextRevision).toBe('2026-08-02');

    // Absent in a pre-V13 payload: omit the key so the slice's own initialState applies.
    const without = loadInitialState({ load: () => emptyPersisted(), save: () => {} });
    expect(without).not.toHaveProperty('contestLibrary');
  });

  it('round-trips a solve through save and boot into a fresh store', () => {
    const written = makeStore();
    written.dispatch(contestProblemSolved({ slug: SLUG, date: '2026-07-30' }));
    const payload = JSON.parse(JSON.stringify(selectPersistedState(written.getState())));

    const booted = makeStore(loadInitialState({ load: () => validatePersisted(payload), save: () => {} }));
    expect(booted.getState().contestLibrary.bySlug[SLUG]).toEqual(
      written.getState().contestLibrary.bySlug[SLUG],
    );
  });
});
