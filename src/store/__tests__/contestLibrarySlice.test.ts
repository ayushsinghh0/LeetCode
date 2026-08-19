import { describe, expect, it } from 'vitest';
import { makeStore } from '@/store/store';
import {
  contestProblemAttempted,
  contestProblemReviewed,
  contestProblemSolved,
} from '@/store/slices/contestLibrarySlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
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
