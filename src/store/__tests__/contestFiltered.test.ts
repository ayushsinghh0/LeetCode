import { makeStore } from '@/store/store';
import {
  blurContestProblem,
  finishContest,
  focusContestProblem,
  solveContestProblem,
  startFilteredContest,
} from '@/store/actions';
import type { FilteredContestProblem } from '@/store/slices/contestSlice';
import { SOLVE_XP } from '@/utils/engine/xp';

// Filtered library sittings through the store (V13 slice 5). The load-bearing claims: a
// library-only solve NEVER touches the curriculum's numeric registers (the ID trap), pays the
// ordinary solve XP exactly once, and a finished sitting banks pattern-level evidence through
// the one existing contests channel — with no per-problem rows, whose questionId space is
// curriculum-only.

const T0 = new Date('2026-07-30T12:00:00');
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

const row = (over: Partial<FilteredContestProblem> = {}): FilteredContestProblem => ({
  id: -1,
  kind: 'library',
  slug: 'lib-a',
  title: 'Library Problem A',
  url: 'https://leetcode.com/problems/lib-a/',
  difficulty: 'medium',
  targetMinutes: 28,
  patterns: ['two-pointers'],
  contestLabel: 'Weekly Contest 100 · Q2',
  contestRating: 1500,
  frontendId: 4001,
  premium: false,
  reasons: ['Two Pointers', 'Contest rating 1500'],
  ...over,
});

describe('startFilteredContest', () => {
  test('snapshots the set: numeric keys for the clock, rows for the rendering', () => {
    const store = makeStore();
    store.dispatch(
      startFilteredContest(
        [row(), row({ id: 1, kind: 'curriculum', slug: 'valid-palindrome', title: 'Valid Palindrome' })],
        'seed-x',
      ),
    );
    const contest = store.getState().contest;
    expect(contest.seed).toBe('seed-x');
    expect(contest.questionIds).toEqual([-1, 1]);
    expect(contest.libraryProblems).toHaveLength(2);
    // Duration is the one pace rule: (28 + 28) × 1.1 ≈ 62.
    expect(contest.durationMin).toBe(62);
  });

  test('refuses to stomp a live sitting — a running clock and its unbanked evidence survive', () => {
    const store = makeStore();
    store.dispatch(startFilteredContest([row()], 'seed-live'));
    store.dispatch(focusContestProblem(-1));

    store.dispatch(startFilteredContest([row({ id: -1, slug: 'lib-other' })], 'seed-stomp'));

    expect(store.getState().contest.seed).toBe('seed-live');
    expect(store.getState().contest.activeQuestionId).toBe(-1);
  });

  test('refuses malformed identities rather than starting a corrupted sitting', () => {
    const store = makeStore();
    store.dispatch(
      startFilteredContest(
        [
          // A library row asserting a positive id would route a solve into progress.byId.
          row({ id: 47, kind: 'library', slug: 'imposter' }),
          // A curriculum row must name a real question.
          row({ id: 100_000, kind: 'curriculum', slug: 'ghost' }),
        ],
        'seed-bad',
      ),
    );
    expect(store.getState().contest.seed).toBeNull();
  });
});

describe('solving inside a filtered sitting — the two registers', () => {
  test('a library-only solve enters the slug register, pays ordinary XP, and never touches progress.byId', () => {
    const store = makeStore();
    store.dispatch(startFilteredContest([row()], 'seed-x'));

    store.dispatch(solveContestProblem(-1));

    const state = store.getState();
    expect(state.contest.attempts[-1]?.solved).toBe(true);
    expect(state.contestLibrary.bySlug['lib-a']?.solved).toBe(true);
    expect(state.contestLibrary.bySlug['lib-a']?.solvedOn).toBe('2026-07-30');
    expect(state.gamification.xp).toBe(SOLVE_XP.medium);
    // The ID trap pin: nothing numeric was written anywhere in the curriculum's registers.
    expect(Object.keys(state.progress.byId)).toHaveLength(0);
    expect(Object.keys(state.progress.dayLogs)).toHaveLength(0);
  });

  test('a bridged row keeps its ONE curriculum identity: the solve is an ordinary solveQuestion', () => {
    const store = makeStore();
    store.dispatch(
      startFilteredContest(
        [row({ id: 1, kind: 'curriculum', slug: 'valid-palindrome', title: 'Valid Palindrome' })],
        'seed-x',
      ),
    );

    store.dispatch(solveContestProblem(1));

    const state = store.getState();
    expect(state.progress.byId[1]?.status).toBe('solved');
    // No second copy in the slug register — one problem, one record.
    expect(state.contestLibrary.bySlug['valid-palindrome']).toBeUndefined();
  });

  test('re-solving an already-solved library problem records the attempt but pays nothing again', () => {
    const store = makeStore();
    store.dispatch(startFilteredContest([row()], 'seed-1'));
    store.dispatch(solveContestProblem(-1));
    const xpAfterFirst = store.getState().gamification.xp;
    const ladderAfterFirst = store.getState().contestLibrary.bySlug['lib-a']!.nextRevision;

    // The first sitting must end before another may start (the stomp refusal below).
    store.dispatch(finishContest());
    store.dispatch(startFilteredContest([row()], 'seed-2'));
    store.dispatch(solveContestProblem(-1));

    const state = store.getState();
    expect(state.gamification.xp).toBe(xpAfterFirst);
    expect(state.contestLibrary.bySlug['lib-a']!.attempts).toBe(2);
    // Practising again never resets the learner's own schedule.
    expect(state.contestLibrary.bySlug['lib-a']!.nextRevision).toBe(ladderAfterFirst);
  });
});

describe('finishing a filtered sitting — evidence through the one channel', () => {
  test('library stalls bank pattern-level evidence with NO per-problem rows, and leave attempts in the register', () => {
    const store = makeStore();
    store.dispatch(
      startFilteredContest(
        [
          row({ id: -1, slug: 'lib-a', patterns: ['two-pointers'] }),
          row({ id: -2, slug: 'lib-b', title: 'Library Problem B', patterns: ['graphs', 'matrices'] }),
        ],
        'seed-x',
      ),
    );

    // Real time into both problems, no solutions: two genuine stalls, a conclusive sitting.
    store.dispatch(focusContestProblem(-1));
    vi.setSystemTime(new Date(T0.getTime() + 20 * MIN));
    store.dispatch(blurContestProblem());
    store.dispatch(focusContestProblem(-2));
    vi.setSystemTime(new Date(T0.getTime() + 35 * MIN));
    store.dispatch(finishContest());

    const record = store.getState().contests.byDate['2026-07-30'];
    expect(record).toBeDefined();
    // The union of the stalled rows' confident mappings, trimmed to `attempted` (2 problems
    // genuinely worked) — the pattern list yields, never the attempted count.
    expect(record!.stalledPatterns).toEqual(['two-pointers', 'graphs']);
    expect(record!.attempted).toBe(2);
    expect(record!.total).toBe(2);
    // Per-problem rows are a curriculum channel; a library sitting must not write them.
    expect(record!.problems).toBeUndefined();

    // The stalls left event-level evidence in the slug register — attempted, never punished.
    expect(store.getState().contestLibrary.bySlug['lib-a']?.attempts).toBe(1);
    expect(store.getState().contestLibrary.bySlug['lib-b']?.attempts).toBe(1);
    expect(store.getState().contestLibrary.bySlug['lib-a']?.solved).toBe(false);
  });

  test('an unattempted filtered sitting is inconclusive and writes nothing anywhere', () => {
    const store = makeStore();
    store.dispatch(startFilteredContest([row(), row({ id: -2, slug: 'lib-b' })], 'seed-x'));
    store.dispatch(finishContest());

    expect(store.getState().contests.byDate['2026-07-30']).toBeUndefined();
    expect(store.getState().contestLibrary.bySlug['lib-a']).toBeUndefined();
  });
});
