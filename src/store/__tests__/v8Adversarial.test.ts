// V8's adversarial pass, kept as tests rather than as a checklist somebody read once.
//
// Each of these is a question from the directive's final review — can a learner game the
// interview, farm the contest, inflate mastery, corrupt V7 data — asked of the shipped code.
import { makeStore } from '@/store/store';
import {
  completeMlRung,
  finishContest,
  finishInterview,
  focusContestProblem,
  logContestWrongSubmit,
  rateInterview,
  reviseMlTrack,
  setAsideContestProblem,
  setTargetCompany,
  startContest,
} from '@/store/actions';
import { interviewStarted } from '@/store/slices/interviewSlice';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
import { ML_LADDER_RUNG } from '@/utils/engine/mlTrack';
import { ML_TRACK_IDS } from '@/data/mlTrackIndex';
import questionsData from '@/data/questions.json';
import type { PersistedStateV1, Question } from '@/types';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';
const TRACK = ML_TRACK_IDS[0]!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('performance evidence cannot be farmed', () => {
  test('sitting interviews pays nothing, however many you sit', () => {
    const store = makeStore();
    for (let i = 0; i < 5; i += 1) {
      store.dispatch(
        interviewStarted({ questionId: questions[i]!.id, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
      );
      store.dispatch(finishInterview());
      store.dispatch(rateInterview('clarity', 5));
    }

    expect(store.getState().interviews.sittings).toHaveLength(5);
    expect(store.getState().gamification.xp).toBe(0);
  });

  test('opening and finishing contests pays nothing on its own', () => {
    const store = makeStore();
    store.dispatch(startContest());
    store.dispatch(finishContest());

    expect(store.getState().gamification.xp).toBe(0);
  });

  test('tapping "didn\'t pass" is free and changes no schedule', () => {
    const store = makeStore();
    store.dispatch(startContest());
    const id = store.getState().contest.questionIds[0]!;
    for (let i = 0; i < 20; i += 1) store.dispatch(logContestWrongSubmit(id));

    expect(store.getState().contest.attempts[id]!.wrongSubmits).toBe(20);
    expect(store.getState().gamification.xp).toBe(0);
    expect(store.getState().progress.byId[id]).toBeUndefined();
  });

  test('an ML rung pays once no matter how often it is pressed', () => {
    const store = makeStore();
    for (let i = 0; i < 10; i += 1) store.dispatch(completeMlRung(TRACK, 'math'));
    expect(store.getState().gamification.xp).toBe(15);
  });

  test('rebuilds cannot be ground out in one sitting', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, ML_LADDER_RUNG));
    const armed = store.getState().gamification.xp;
    for (let i = 0; i < 10; i += 1) store.dispatch(reviseMlTrack(TRACK, true));

    expect(store.getState().ml.tracksById[TRACK]!.revisionHistory).toHaveLength(1);
    expect(store.getState().gamification.xp).toBe(armed + 10);
  });

  test('a same-day second contest cannot overwrite the first sitting\'s record', () => {
    const store = makeStore();
    store.dispatch(startContest());
    const ids = store.getState().contest.questionIds;
    store.dispatch(focusContestProblem(ids[0]!));
    vi.setSystemTime(new Date(Date.now() + 30 * 60_000));
    store.dispatch(focusContestProblem(ids[1]!));
    vi.setSystemTime(new Date(Date.now() + 30 * 60_000));
    store.dispatch(finishContest());
    const first = store.getState().contests.byDate[TODAY];

    store.dispatch(startContest());
    store.dispatch(finishContest());

    expect(store.getState().contests.byDate[TODAY]).toEqual(first);
  });
});

describe('no surface invents a claim it cannot support', () => {
  test('setting a problem aside does not erase the minutes behind it', () => {
    const store = makeStore();
    store.dispatch(startContest());
    const ids = store.getState().contest.questionIds;
    store.dispatch(focusContestProblem(ids[0]!));
    vi.setSystemTime(new Date(Date.now() + 40 * 60_000));
    store.dispatch(setAsideContestProblem(ids[0]!));
    store.dispatch(focusContestProblem(ids[1]!));
    vi.setSystemTime(new Date(Date.now() + 40 * 60_000));
    store.dispatch(finishContest());

    const banked = store.getState().contests.byDate[TODAY]!;
    expect(banked.problems![0]!.outcome).toBe('set-aside');
    expect(banked.problems![0]!.minutesSpent).toBe(40);
    expect(banked.stalledPatterns.length).toBeGreaterThan(0);
  });

  test('a company with no topic evidence cannot become a target', () => {
    const store = makeStore();
    store.dispatch(setTargetCompany('netflix')); // avoids-puzzles tier
    store.dispatch(setTargetCompany('not-a-company'));
    expect(store.getState().settings.targetCompanyId).toBeUndefined();
  });
});

describe('V7 and earlier data cannot be corrupted by V8', () => {
  test('a pre-V8 payload loads unchanged — every new channel is optional', () => {
    const legacy = {
      version: 1,
      progress: { byId: {}, dayLogs: {}, startDate: '2026-07-01' },
      settings: {
        questionsPerDay: 8,
        revisionEnabled: true,
        theme: 'dark',
        notifications: false,
        dailyCapacityMin: 180,
      },
      gamification: { xp: 420, unlocked: {} },
      contests: { byDate: { '2026-07-20': { stalledPatterns: ['graphs'], attempted: 3, total: 4 } } },
    };

    const validated = validatePersisted(legacy);
    expect(validated).not.toBeNull();
    // Untouched: no `problems`, no `interviews`, no `ml`, no `targetCompanyId` invented.
    expect(validated!.contests!.byDate['2026-07-20']).toEqual({
      stalledPatterns: ['graphs'],
      attempted: 3,
      total: 4,
    });
    expect(validated!.interviews).toBeUndefined();
    expect(validated!.ml).toBeUndefined();
    expect(validated!.settings.targetCompanyId).toBeUndefined();
  });

  test('a learner who touched nothing V8 added writes a payload with none of its keys', () => {
    const store = makeStore();
    const payload = selectPersistedState(store.getState());

    expect(payload.interviews).toBeUndefined();
    expect(payload.ml).toBeUndefined();
    expect(payload.settings.targetCompanyId).toBeUndefined();
  });

  test('every V8 channel round-trips through the real validator', () => {
    const store = makeStore();
    store.dispatch(completeMlRung(TRACK, ML_LADDER_RUNG));
    store.dispatch(setTargetCompany('google'));
    store.dispatch(
      interviewStarted({ questionId: questions[0]!.id, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );
    store.dispatch(finishInterview());
    store.dispatch(rateInterview('clarity', 4));
    store.dispatch(startContest());
    const ids = store.getState().contest.questionIds;
    store.dispatch(focusContestProblem(ids[0]!));
    vi.setSystemTime(new Date(Date.now() + 45 * 60_000));
    store.dispatch(focusContestProblem(ids[1]!));
    vi.setSystemTime(new Date(Date.now() + 45 * 60_000));
    store.dispatch(finishContest());

    const raw = JSON.parse(JSON.stringify(selectPersistedState(store.getState())));
    const validated = validatePersisted(raw) as PersistedStateV1 | null;
    expect(validated).not.toBeNull();
    expect(validated!.ml!.tracksById[TRACK]).toBeDefined();
    expect(validated!.interviews!.sittings).toHaveLength(1);
    expect(validated!.contests!.byDate[TODAY]!.problems).toBeDefined();
    expect(validated!.settings.targetCompanyId).toBe('google');
  });
});
