// Focused coverage for the WEEKLY_CLEAR_BONUS transition logic in the `reviseQuestion` thunk
// (src/store/actions.ts). Before this file, the only assertion anywhere touching the bonus was
// `expect(WEEKLY_CLEAR_BONUS).toBe(50)` (src/utils/engine/__tests__/xp.test.ts) — the thunk
// logic that decides WHEN it fires was completely untested (final-review Important 3), and it is
// exactly what Important 1's queue-termination fix rewrites (due-alone -> full due+top-up
// queue). See .superpowers/sdd/2026-07-30-dsa-roadmap-app/final-review-findings.md.
import questionsData from '@/data/questions.json';
import type { PersistedStateV1, Question, QuestionProgress } from '@/types';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import { revisionXp, WEEKLY_CLEAR_BONUS } from '@/utils/engine/xp';
import { makeStore } from '@/store/store';
import { importProgress, reviseQuestion } from '@/store/actions';
import { selectCurrentDay, selectIsWeeklyDay, selectRevisionQueueIds } from '@/store/selectors';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));
const TODAY = '2026-07-30';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function progressFixture(overrides: Partial<QuestionProgress> = {}): QuestionProgress {
  return { ...initialProgress(), ...overrides };
}

function masteredFixture(): QuestionProgress {
  return progressFixture({ status: 'solved', completedAt: '2026-07-01', revisionStage: 5, nextRevision: null });
}

function importFixture(byId: Record<number, QuestionProgress>): ReturnType<typeof makeStore> {
  const fixture: PersistedStateV1 = {
    version: 1,
    progress: { byId, dayLogs: {}, startDate: null },
    settings: { questionsPerDay: 8, revisionEnabled: true, theme: 'dark', notifications: false },
    gamification: { xp: 0, unlocked: {} },
  };
  const store = makeStore();
  store.dispatch(importProgress(fixture));
  return store;
}

// Builds a store on a weekly-revision day (currentDay % 7 === 0, derived from solved-new count /
// questionsPerDay=8) with a small, tractable due+top-up queue: 43 mastered filler solves (push
// solvedNewCount to the day-7 band [48,55] without entering the due/top-up pool, since mastered
// items are excluded from both) + 2 due items + 3 top-up-eligible (solved, non-mastered,
// non-due) items. Weekly top-up defaults to min=15/max=20, so with only 2 due, target = 13
// (capped by the 3-item pool) -> all 3 pool items are pulled in as extras. Full queue = 2 + 3 = 5.
const DUE_FIXTURE_IDS = [44, 45];
const POOL_FIXTURE_IDS = [46, 47, 48];

function buildWeeklyDayStore(): ReturnType<typeof makeStore> {
  const byId: Record<number, QuestionProgress> = {};
  for (let id = 1; id <= 43; id++) byId[id] = masteredFixture();
  for (const id of DUE_FIXTURE_IDS) {
    byId[id] = progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-20' });
  }
  for (const id of POOL_FIXTURE_IDS) {
    byId[id] = progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-08-15' });
  }
  return importFixture(byId);
}

test('weekly day: draining the full due+top-up queue via revision attempts awards WEEKLY_CLEAR_BONUS exactly once, only on the attempt that empties it', () => {
  const store = buildWeeklyDayStore();
  const state0 = store.getState();

  expect(selectCurrentDay(state0)).toBe(7);
  expect(selectIsWeeklyDay(state0)).toBe(true);

  const queueIds = selectRevisionQueueIds(state0, TODAY);
  expect([...queueIds].sort((a, b) => a - b)).toEqual([...DUE_FIXTURE_IDS, ...POOL_FIXTURE_IDS].sort((a, b) => a - b));
  expect(queueIds).toHaveLength(5);

  // Attempt every queued item exactly once, mixing pass/fail — per the ruling, both drain the
  // queue (a fail reschedules to tomorrow; a pass advances the ladder), so either counts as
  // "cleared" for bonus purposes.
  const passResults: Record<number, boolean> = { 44: true, 45: false, 46: true, 47: false, 48: true };

  queueIds.forEach((id, index) => {
    const xpBefore = store.getState().gamification.xp;
    store.dispatch(reviseQuestion(id, passResults[id]));
    const xpAfter = store.getState().gamification.xp;
    const baseXp = revisionXp(questionById.get(id)!.difficulty);
    const isLastAttempt = index === queueIds.length - 1;

    // Bonus fires only on the attempt that empties the queue — every earlier attempt is a
    // partial drain and must earn exactly its own per-attempt XP, nothing more.
    expect(xpAfter - xpBefore).toBe(isLastAttempt ? baseXp + WEEKLY_CLEAR_BONUS : baseXp);
    expect(selectRevisionQueueIds(store.getState(), TODAY)).toHaveLength(queueIds.length - index - 1);
  });

  expect(selectRevisionQueueIds(store.getState(), TODAY)).toEqual([]); // fully drained
});

test('weekly day: a partial drain (queue not fully cleared) never awards the bonus', () => {
  const store = buildWeeklyDayStore();
  const queueIds = selectRevisionQueueIds(store.getState(), TODAY);
  const allButLast = queueIds.slice(0, -1); // leave exactly one item un-attempted

  const xpBefore = store.getState().gamification.xp;
  for (const id of allButLast) {
    store.dispatch(reviseQuestion(id, true));
  }
  const xpAfter = store.getState().gamification.xp;

  const expectedXp = allButLast.reduce((sum, id) => sum + revisionXp(questionById.get(id)!.difficulty), 0);
  expect(xpAfter - xpBefore).toBe(expectedXp); // no WEEKLY_CLEAR_BONUS anywhere in this partial drain
  expect(selectRevisionQueueIds(store.getState(), TODAY)).toHaveLength(1); // one item still queued
});

test('weekly day: WEEKLY_CLEAR_BONUS is credited into dayLog.xpEarned too, keeping the per-day sum in sync with gamification.xp', () => {
  const store = buildWeeklyDayStore();
  const queueIds = selectRevisionQueueIds(store.getState(), TODAY);

  for (const id of queueIds) {
    store.dispatch(reviseQuestion(id, true));
  }
  const state = store.getState();

  expect(state.gamification.xp).toBeGreaterThan(0);
  expect(state.progress.dayLogs[TODAY].xpEarned).toBe(state.gamification.xp);
});

test('non-weekly day: fully draining the due queue never awards WEEKLY_CLEAR_BONUS', () => {
  const store = importFixture({
    1: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-20' }),
    2: progressFixture({ status: 'solved', completedAt: '2026-07-01', nextRevision: '2026-07-25' }),
  });

  expect(selectCurrentDay(store.getState())).toBe(1); // solvedNewCount=2 -> day 1, not a weekly day
  expect(selectIsWeeklyDay(store.getState())).toBe(false);

  const queueIds = selectRevisionQueueIds(store.getState(), TODAY);
  expect([...queueIds].sort((a, b) => a - b)).toEqual([1, 2]);

  const xpBefore = store.getState().gamification.xp;
  for (const id of queueIds) {
    store.dispatch(reviseQuestion(id, true));
  }
  const xpAfter = store.getState().gamification.xp;

  const expectedXp = queueIds.reduce((sum, id) => sum + revisionXp(questionById.get(id)!.difficulty), 0);
  expect(xpAfter - xpBefore).toBe(expectedXp); // exactly the per-attempt XP, no +50
  expect(selectRevisionQueueIds(store.getState(), TODAY)).toEqual([]); // fully drained anyway
});
