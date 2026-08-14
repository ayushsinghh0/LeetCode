// The ML implementation tracks as worked ladder rather than reading list: rungs stamp, the
// scratch rung enters the shared 1/3/7/15/30 ladder, rebuilds are graded, and all of it counts as
// activity. The content shipped verified in V6; this is the layer that lets a learner say they
// did it — and lets the product schedule the rebuild.
import { makeStore } from '@/store/store';
import reducer, { mlRungCompleted, mlTrackRebuilt } from '@/store/slices/mlSlice';
import {
  completeMlRung,
  reviseMlTrack,
  shipMlProject,
  startMlProject,
} from '@/store/actions';
import { progressReset } from '@/store/sharedActions';
import {
  ML_LADDER_RUNG,
  ML_RUNG_XP,
  ML_TRACK_CLEAR_BONUS,
  initialMlTrackProgress,
  isTrackClear,
  mlActivityByDate,
  mlStanding,
  rungIdsOf,
} from '@/utils/engine/mlTrack';
import {
  selectMlDueTrackIds,
  selectOtherTrackActiveDates,
  selectRankedWork,
} from '@/store/selectors';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
import { ML_TRACKS, mlTrackById } from '@/data/mlTracks';
import { ML_PROJECTS } from '@/data/mlProjects';

const TODAY = '2026-07-30';
const TRACK = ML_TRACKS[0]!.id;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

/* --- The engine ------------------------------------------------------------------------------ */

describe('mlTrack engine', () => {
  test('every track has the five rungs the ladder assumes', () => {
    for (const track of ML_TRACKS) {
      expect(rungIdsOf(track)).toEqual(['math', 'scratch', 'library', 'experiment', 'failure']);
    }
  });

  test('the ladder is entered at the scratch rung, not at the maths', () => {
    // Deriving is reading. Writing it in numpy is the first moment there is something to forget.
    const derived = reducer(
      undefined,
      mlRungCompleted({ trackId: TRACK, rungId: 'math', date: TODAY }),
    );
    expect(derived.tracksById[TRACK]!.nextRevision).toBeNull();

    const written = reducer(
      derived,
      mlRungCompleted({ trackId: TRACK, rungId: ML_LADDER_RUNG, date: TODAY }),
    );
    expect(written.tracksById[TRACK]!.nextRevision).toBe('2026-07-31');
    expect(written.tracksById[TRACK]!.revisionStage).toBe(0); // stage 0, first rebuild tomorrow
  });

  test('a stamp never moves once written', () => {
    let state = reducer(undefined, mlRungCompleted({ trackId: TRACK, rungId: 'math', date: TODAY }));
    state = reducer(state, mlRungCompleted({ trackId: TRACK, rungId: 'math', date: '2026-08-05' }));

    expect(state.tracksById[TRACK]!.rungs.math).toBe(TODAY);
  });

  test('a rebuild of something never written is not a review of anything', () => {
    const state = reducer(undefined, mlTrackRebuilt({ trackId: TRACK, date: TODAY, passed: true }));
    expect(state.tracksById[TRACK]).toBeUndefined();
  });

  test('activity is derived from the stamps, never logged separately', () => {
    const activity = mlActivityByDate(
      {
        [TRACK]: {
          ...initialMlTrackProgress(),
          rungs: { math: '2026-07-28', scratch: '2026-07-29' },
          revisionHistory: [{ date: '2026-07-29', passed: true }],
        },
      },
      { 'p-1': { startedOn: '2026-07-28', shippedOn: null } },
    );

    expect(activity.get('2026-07-28')).toBe(2); // one rung + one project start
    expect(activity.get('2026-07-29')).toBe(2); // one rung + one graded rebuild
  });

  test('standing counts what has actually been worked', () => {
    const standing = mlStanding(ML_TRACKS, {
      [TRACK]: { ...initialMlTrackProgress(), rungs: { math: TODAY, scratch: TODAY } },
    });

    expect(standing.tracksTouched).toBe(1);
    expect(standing.tracksClear).toBe(0);
    expect(standing.rungsDone).toBe(2);
    expect(standing.rungsTotal).toBe(ML_TRACKS.length * 5);
  });
});

/* --- The thunks ------------------------------------------------------------------------------ */

describe('completeMlRung', () => {
  test('pays once per rung and never again', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, 'math'));
    const afterFirst = store.getState().gamification.xp;
    store.dispatch(completeMlRung(TRACK, 'math'));

    expect(afterFirst).toBe(ML_RUNG_XP);
    expect(store.getState().gamification.xp).toBe(afterFirst);
  });

  test('clearing every rung pays the track bonus, once', () => {
    const store = makeStore();
    for (const rung of rungIdsOf(mlTrackById[TRACK]!)) {
      store.dispatch(completeMlRung(TRACK, rung));
    }

    expect(isTrackClear(mlTrackById[TRACK]!, store.getState().ml.tracksById[TRACK]!)).toBe(true);
    expect(store.getState().gamification.xp).toBe(5 * ML_RUNG_XP + ML_TRACK_CLEAR_BONUS);
  });

  test('an unknown track or rung writes nothing', () => {
    const store = makeStore();
    store.dispatch(completeMlRung('not-a-track', 'math'));
    store.dispatch(completeMlRung(TRACK, 'not-a-rung'));

    expect(store.getState().ml.tracksById).toEqual({});
    expect(store.getState().gamification.xp).toBe(0);
  });
});

describe('reviseMlTrack', () => {
  const arm = (store: ReturnType<typeof makeStore>) => {
    store.dispatch(completeMlRung(TRACK, ML_LADDER_RUNG));
  };

  test('grades one rebuild per track per calendar date — a rerun is practice', () => {
    const store = makeStore();
    arm(store);
    const xpAfterArming = store.getState().gamification.xp;

    store.dispatch(reviseMlTrack(TRACK, true));
    const afterFirst = store.getState().ml.tracksById[TRACK]!;
    store.dispatch(reviseMlTrack(TRACK, true));

    expect(afterFirst.revisionHistory).toHaveLength(1);
    expect(store.getState().ml.tracksById[TRACK]!.revisionHistory).toHaveLength(1);
    expect(store.getState().gamification.xp).toBe(xpAfterArming + 10);
  });

  test('a failed rebuild restarts the ladder and pays nothing', () => {
    const store = makeStore();
    arm(store);
    const xpAfterArming = store.getState().gamification.xp;

    store.dispatch(reviseMlTrack(TRACK, false));

    const progress = store.getState().ml.tracksById[TRACK]!;
    expect(progress.revisionStage).toBe(0);
    expect(progress.nextRevision).toBe('2026-07-31');
    expect(store.getState().gamification.xp).toBe(xpAfterArming);
  });

  test('a track that was never written cannot be reviewed', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, 'math'));
    store.dispatch(reviseMlTrack(TRACK, true));

    expect(store.getState().ml.tracksById[TRACK]!.revisionHistory).toEqual([]);
  });
});

describe('projects are marked, not graded', () => {
  test('starting earns nothing; shipping pays the same bonus a cleared track does', () => {
    const store = makeStore();
    const project = ML_PROJECTS[0]!.id;

    store.dispatch(startMlProject(project));
    expect(store.getState().gamification.xp).toBe(0);
    expect(store.getState().ml.projectsById[project]!.startedOn).toBe(TODAY);

    store.dispatch(shipMlProject(project));
    expect(store.getState().gamification.xp).toBe(ML_TRACK_CLEAR_BONUS);

    // Shipping twice is one event.
    store.dispatch(shipMlProject(project));
    expect(store.getState().gamification.xp).toBe(ML_TRACK_CLEAR_BONUS);
  });
});

/* --- Reaching the rest of the product -------------------------------------------------------- */

describe('the tracks reach the day plan and the activity system', () => {
  test('a due rebuild is ranked beside the other retention work, above new questions', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, ML_LADDER_RUNG));
    vi.setSystemTime(new Date('2026-08-02T12:00:00'));

    const due = selectMlDueTrackIds(store.getState(), '2026-08-02');
    expect(due).toContain(TRACK);

    const work = selectRankedWork(store.getState(), '2026-08-02');
    const rebuild = work.findIndex((item) => item.kind === 'ml-review');
    const newQuestion = work.findIndex((item) => item.kind === 'new-question');
    expect(rebuild).toBeGreaterThanOrEqual(0);
    // Retention outranks acquisition — the spine's ordering rule, applied to the third ladder.
    expect(rebuild).toBeLessThan(newQuestion);
    expect(work[rebuild]!.why).toMatch(/blank file/i);
  });

  test('rung progression itself is never pushed into the day plan', () => {
    // Working a new track is self-paced elective work. Proposing "derive the transformer" beside a
    // due revision would put a two-hour block on a list the learner is meant to be able to finish.
    const store = makeStore();
    const work = selectRankedWork(store.getState(), TODAY);
    expect(work.some((item) => item.kind === 'ml-review')).toBe(false);
  });

  test('an evening spent only on a track still counts as an active day', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, 'math'));

    // DayLog stays the DSA ledger it has always been: the XP double-entry lands there, the WORK
    // does not — no solve is invented, and no revision is logged.
    expect(store.getState().progress.dayLogs[TODAY]!.solvedIds).toEqual([]);
    expect(store.getState().progress.dayLogs[TODAY]!.revisionsPassed).toEqual([]);

    // The activity the streak reads is derived from the stamps instead.
    const state = store.getState();
    const activity = mlActivityByDate(state.ml.tracksById, state.ml.projectsById);
    expect(activity.get(TODAY)).toBe(1);
    expect(selectOtherTrackActiveDates(state).has(TODAY)).toBe(true);
  });

  test('the channel round-trips, and an untouched learner writes no ml key at all', () => {
    const empty = makeStore();
    expect(selectPersistedState(empty.getState()).ml).toBeUndefined();

    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, ML_LADDER_RUNG));
    store.dispatch(reviseMlTrack(TRACK, true));
    store.dispatch(startMlProject(ML_PROJECTS[0]!.id));

    const persisted = validatePersisted(
      JSON.parse(JSON.stringify(selectPersistedState(store.getState()))),
    );
    expect(persisted).not.toBeNull();
    expect(persisted!.ml!.tracksById[TRACK]).toEqual(store.getState().ml.tracksById[TRACK]);
    expect(persisted!.ml!.projectsById).toEqual(store.getState().ml.projectsById);
  });

  test('a rung id this build has never heard of loads rather than quarantining', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, 'math'));
    const payload = JSON.parse(JSON.stringify(selectPersistedState(store.getState())));
    payload.ml.tracksById[TRACK].rungs['visualise-in-v9'] = TODAY;

    expect(validatePersisted(payload)).not.toBeNull();
  });

  test('a reset clears the track record with everything else', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, 'math'));
    store.dispatch(progressReset());

    expect(store.getState().ml.tracksById).toEqual({});
  });
});
