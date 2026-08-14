// The contest→weakness loop: a finished sitting's genuine stalls persist as dated evidence
// (the `contests` channel), while the live contest slice stays unpersisted — a restored stopped
// clock lies. `finishContest` is the single line that closes the loop.
import questionsData from '@/data/questions.json';
import type { ContestsState, PersistedStateV1, Question } from '@/types';
import { makeStore } from '@/store/store';
import reducer, { contestStallsRecorded } from '@/store/slices/contestsSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { finishContest, focusContestProblem, startContest } from '@/store/actions';
import { selectAllPatternWeakness } from '@/store/selectors';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

const empty: ContestsState = { byDate: {} };

const record = (date: string, stalled: string[], attempted = 4, total = 4) =>
  contestStallsRecorded({ date, stalledPatterns: stalled, attempted, total });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

/* --- Slice ---------------------------------------------------------------------------------- */

describe('contestsSlice', () => {
  test('records a sitting with its stalls, dated by the payload', () => {
    const state = reducer(empty, record(TODAY, ['graphs', 'stacks'], 3, 4));
    expect(state.byDate[TODAY]).toEqual({
      stalledPatterns: ['graphs', 'stacks'],
      attempted: 3,
      total: 4,
    });
  });

  test('the first sitting of a date is the signal — a same-day rerun replays a seen set', () => {
    const first = reducer(empty, record(TODAY, ['graphs'], 2, 4));
    const rerun = reducer(first, record(TODAY, [], 4, 4));
    expect(rerun.byDate[TODAY]).toEqual({ stalledPatterns: ['graphs'], attempted: 2, total: 4 });
  });

  test('stateImported replaces the history wholesale, defaulting when the payload predates it', () => {
    const seeded = reducer(empty, record(TODAY, ['graphs']));
    const payload = { version: 1 } as PersistedStateV1; // no contests field
    expect(reducer(seeded, stateImported(payload))).toEqual(empty);

    const withContests = {
      version: 1,
      contests: { byDate: { '2026-07-01': { stalledPatterns: ['stacks'], attempted: 3, total: 4 } } },
    } as unknown as PersistedStateV1;
    const imported = reducer(seeded, stateImported(withContests));
    expect(imported.byDate['2026-07-01']).toEqual({ stalledPatterns: ['stacks'], attempted: 3, total: 4 });
    expect(imported.byDate[TODAY]).toBeUndefined();
  });

  test('progressReset clears the stall history', () => {
    const seeded = reducer(empty, record(TODAY, ['graphs']));
    expect(reducer(seeded, progressReset())).toEqual(empty);
  });
});

/* --- finishContest: the single closing line ------------------------------------------------- */

describe('finishContest banks stall evidence', () => {
  const MIN = 60_000;
  const advanceMinutes = (min: number) => {
    vi.setSystemTime(new Date(Date.now() + min * MIN));
  };
  const patternOf = (id: number) => questions.find((q) => q.id === id)!.pattern;

  test('a conclusive sitting writes one dated record with the stalled patterns', () => {
    const store = makeStore();
    store.dispatch(startContest());
    const ids = store.getState().contest.questionIds;
    expect(ids.length).toBeGreaterThanOrEqual(2);

    // Real time into two problems, no solutions: two genuine stalls, sitting conclusive.
    store.dispatch(focusContestProblem(ids[0]!));
    advanceMinutes(20);
    store.dispatch(focusContestProblem(ids[1]!));
    advanceMinutes(20);
    store.dispatch(finishContest());

    const expected = Array.from(new Set([patternOf(ids[0]!), patternOf(ids[1]!)]));
    expect(store.getState().contests.byDate[TODAY]).toEqual({
      stalledPatterns: expected,
      attempted: 2,
      total: ids.length,
    });
    // The live sitting itself is over, not re-recorded: finishing twice cannot double-book.
    store.dispatch(finishContest());
    expect(Object.keys(store.getState().contests.byDate)).toEqual([TODAY]);
    expect(store.getState().contests.byDate[TODAY]!.attempted).toBe(2);
  });

  test('an inconclusive sitting writes nothing — analyzeContest owns that decision', () => {
    const store = makeStore();
    store.dispatch(startContest());
    // Finished with nothing genuinely attempted: the contest measured availability, not ability.
    store.dispatch(finishContest());

    expect(store.getState().contests.byDate).toEqual({});
  });

  test('finishing when no contest is running is a no-op', () => {
    const store = makeStore();
    store.dispatch(finishContest());
    expect(store.getState().contests.byDate).toEqual({});
  });

  test('cannot write a payload that would quarantine state', () => {
    const store = makeStore();
    store.dispatch(startContest());
    const ids = store.getState().contest.questionIds;
    store.dispatch(focusContestProblem(ids[0]!));
    advanceMinutes(20);
    store.dispatch(focusContestProblem(ids[1]!));
    advanceMinutes(20);
    store.dispatch(finishContest());

    const persisted = validatePersisted(JSON.parse(JSON.stringify(selectPersistedState(store.getState()))));
    expect(persisted).not.toBeNull();
    expect(persisted!.contests!.byDate[TODAY]).toEqual(store.getState().contests.byDate[TODAY]);
  });
});

/* --- The loop closes: persisted stalls reach the one weakness model ------------------------- */

describe('stall records feed the shared weakness signal', () => {
  test('two sittings stalling on a pattern surface it through selectAllPatternWeakness', () => {
    const store = makeStore({
      contests: {
        byDate: {
          '2026-07-29': { stalledPatterns: ['graphs'], attempted: 3, total: 4 },
          '2026-07-26': { stalledPatterns: ['graphs'], attempted: 4, total: 4 },
        },
      },
    });

    const weakness = selectAllPatternWeakness(store.getState(), TODAY);
    const graphs = weakness.find((w) => w.id === 'graphs');
    expect(graphs).toBeDefined();
    expect(graphs!.signals.map((s) => s.id)).toEqual(['contest']);
    expect(graphs!.signals[0]!.detail).toBe(
      'Stalled on 2 problems in timed contests, most recently yesterday.',
    );
  });

  test('a single stall stays silent everywhere — one sitting nominates nothing', () => {
    const store = makeStore({
      contests: { byDate: { '2026-07-29': { stalledPatterns: ['graphs'], attempted: 4, total: 4 } } },
    });

    expect(selectAllPatternWeakness(store.getState(), TODAY)).toEqual([]);
  });
});
