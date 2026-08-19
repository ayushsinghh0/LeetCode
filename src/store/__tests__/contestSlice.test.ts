import reducer, {
  contestCleared,
  contestElapsedMin,
  contestFinished,
  contestProblemBlurred,
  contestProblemFocused,
  contestProblemSolved,
  contestStarted,
  type ContestState,
} from '@/store/slices/contestSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import type { PersistedStateV1 } from '@/types';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

const start = () =>
  reducer(
    undefined,
    contestStarted({
      seed: '2026-07-30',
      questionIds: [1, 2, 3],
      targetMinutes: [12, 25, 45],
      durationMin: 90,
      nowMs: T0,
    }),
  );

describe('contestSlice — starting', () => {
  test('seeds an attempt for every problem, all unsolved with no time on them', () => {
    const state = start();

    expect(state.questionIds).toEqual([1, 2, 3]);
    expect(Object.keys(state.attempts)).toHaveLength(3);
    expect(Object.values(state.attempts).every((a) => !a.solved && a.minutesSpent === 0)).toBe(true);
    expect(state.startedAtMs).toBe(T0);
    expect(state.finishedAtMs).toBeNull();
  });

  test('the clock is not attributed to anything until a problem is opened', () => {
    const state = start();
    expect(state.activeQuestionId).toBeNull();
    expect(state.activeSinceMs).toBeNull();
  });
});

describe('contestSlice — time attribution', () => {
  test('time lands on the problem that was open, not on the set as a whole', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 2, nowMs: T0 }));
    state = reducer(state, contestProblemBlurred({ nowMs: T0 + 9 * MIN }));

    expect(state.attempts[2]!.minutesSpent).toBe(9);
    expect(state.attempts[1]!.minutesSpent).toBe(0);
    expect(state.attempts[3]!.minutesSpent).toBe(0);
  });

  test('switching problems settles the previous one rather than losing its time', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 }));
    state = reducer(state, contestProblemFocused({ questionId: 2, nowMs: T0 + 5 * MIN }));
    state = reducer(state, contestProblemFocused({ questionId: 3, nowMs: T0 + 12 * MIN }));

    expect(state.attempts[1]!.minutesSpent).toBe(5);
    expect(state.attempts[2]!.minutesSpent).toBe(7);
    expect(state.activeQuestionId).toBe(3);
  });

  test('coming back to a problem accumulates rather than replacing', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 }));
    state = reducer(state, contestProblemFocused({ questionId: 2, nowMs: T0 + 4 * MIN }));
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 + 6 * MIN }));
    state = reducer(state, contestProblemBlurred({ nowMs: T0 + 9 * MIN }));

    expect(state.attempts[1]!.minutesSpent).toBe(7); // 4 + 3
  });

  test('re-focusing the problem already open does not restart its clock', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 }));
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 + 5 * MIN }));
    state = reducer(state, contestProblemBlurred({ nowMs: T0 + 10 * MIN }));

    expect(state.attempts[1]!.minutesSpent).toBe(10);
  });

  test('focusing a problem outside the set is ignored', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 999, nowMs: T0 }));

    expect(state.activeQuestionId).toBeNull();
    expect(state.attempts[999]).toBeUndefined();
  });

  test('a blur with no problem open is a no-op, not a crash', () => {
    const state = reducer(start(), contestProblemBlurred({ nowMs: T0 + MIN }));
    expect(Object.values(state.attempts).every((a) => a.minutesSpent === 0)).toBe(true);
  });
});

describe('contestSlice — solving and finishing', () => {
  test('solving banks the time spent so far and marks the problem solved', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 }));
    state = reducer(state, contestProblemSolved({ questionId: 1, nowMs: T0 + 8 * MIN }));

    expect(state.attempts[1]!.solved).toBe(true);
    expect(state.attempts[1]!.minutesSpent).toBe(8);
    expect(state.activeQuestionId).toBeNull();
  });

  test('finishing settles whatever was still running', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 3, nowMs: T0 }));
    state = reducer(state, contestFinished({ nowMs: T0 + 20 * MIN }));

    expect(state.attempts[3]!.minutesSpent).toBe(20);
    expect(state.finishedAtMs).toBe(T0 + 20 * MIN);
  });

  test('elapsed stops counting once the contest is finished', () => {
    let state = start();
    state = reducer(state, contestFinished({ nowMs: T0 + 30 * MIN }));

    expect(contestElapsedMin(state, T0 + 30 * MIN)).toBe(30);
    // Ten minutes later the contest is still a 30-minute contest.
    expect(contestElapsedMin(state, T0 + 40 * MIN)).toBe(30);
  });

  test('elapsed is zero before a contest starts', () => {
    const state = reducer(undefined, contestCleared());
    expect(contestElapsedMin(state, T0)).toBe(0);
  });
});

describe('contestSlice — boundaries', () => {
  const empty: ContestState = {
    seed: null,
    questionIds: [],
    targetMinutes: [],
    // V13 slice 5 widened the state with the filtered-sitting snapshot; a Full Contest (and the
    // cleared state) carries null. Fixture completion only — no assertion changed.
    libraryProblems: null,
    durationMin: 0,
    startedAtMs: null,
    finishedAtMs: null,
    attempts: {},
    activeQuestionId: null,
    activeSinceMs: null,
  };

  test('an imported backup never resumes a contest — it is history, not a sitting', () => {
    let state = start();
    state = reducer(state, contestProblemFocused({ questionId: 1, nowMs: T0 }));
    state = reducer(state, stateImported({} as PersistedStateV1));

    expect(state).toEqual(empty);
  });

  test('a progress reset clears the contest', () => {
    const state = reducer(start(), progressReset());
    expect(state).toEqual(empty);
  });

  test('starting a second contest replaces the first entirely', () => {
    let state = start();
    state = reducer(state, contestProblemSolved({ questionId: 1, nowMs: T0 + MIN }));
    state = reducer(
      state,
      contestStarted({
        seed: '2026-07-31',
        questionIds: [7, 8],
        targetMinutes: [12, 25],
        durationMin: 40,
        nowMs: T0 + 100 * MIN,
      }),
    );

    expect(state.seed).toBe('2026-07-31');
    expect(state.questionIds).toEqual([7, 8]);
    expect(state.attempts[1]).toBeUndefined();
    expect(Object.values(state.attempts).every((a) => !a.solved)).toBe(true);
  });
});
