// The interview→evidence loop. The live sitting stays unpersisted (an interview is a performance,
// and a restored one is a fiction); what survives is the derived record `finishInterview` banks.
// Until this channel existed the debrief promised a comparison with "your next sitting" that
// storage could not deliver — the numbers died with the tab.
//
// This file is also the interviewSlice's first unit-test home: the slice shipped with page tests
// only, which is how a write-after-finish guard went missing for a whole release.
import questionsData from '@/data/questions.json';
import type { PersistedStateV1, Question } from '@/types';
import { makeStore } from '@/store/store';
import reducer, {
  MAX_INTERVIEW_SITTINGS,
  interviewSittingAmended,
  interviewSittingRecorded,
} from '@/store/slices/interviewsSlice';
import interviewReducer, {
  interviewStarted,
  interviewFinished,
  stageOutcomeSet,
  selfAssessmentSet,
} from '@/store/slices/interviewSlice';
import { progressReset, stateImported } from '@/store/sharedActions';
import { finishInterview, rateInterview } from '@/store/actions';
import { selectPreviousInterviewSitting } from '@/store/selectors';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';
import { STAGES } from '@/utils/engine/interview';

const questions = questionsData as Question[];
const TODAY = '2026-07-30';

const sitting = (date: string, questionId: number, overrides = {}) => ({
  date,
  questionId,
  stageReached: 4,
  outcomes: { understand: 'solid' },
  assessment: { clarity: 3 },
  minutes: 22,
  hintsTaken: 1,
  hintsAvailable: 3,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

/* --- The live slice's guards ---------------------------------------------------------------- */

describe('interviewSlice: a finished sitting is closed to further writes', () => {
  const start = () =>
    interviewReducer(
      undefined,
      interviewStarted({ questionId: 1, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );

  test('a stage rating cannot be changed after the sitting ends', () => {
    // The debrief reads these back as "your own call at the time". Editable afterwards, the record
    // could be rewritten to say the sitting went better than it did.
    let state = start();
    state = interviewReducer(state, stageOutcomeSet({ stage: 'understand', outcome: 'stuck' }));
    state = interviewReducer(state, interviewFinished({ date: TODAY, nowMs: Date.now() }));
    state = interviewReducer(state, stageOutcomeSet({ stage: 'understand', outcome: 'solid' }));

    expect(state.stageOutcomes.understand).toBe('stuck');
  });

  test('the self-assessment stays writable after the sitting ends — it is asked at the debrief', () => {
    let state = start();
    state = interviewReducer(state, interviewFinished({ date: TODAY, nowMs: Date.now() }));
    state = interviewReducer(state, selfAssessmentSet({ id: 'clarity', value: 4 }));

    expect(state.selfAssessment.clarity).toBe(4);
  });
});

/* --- The record slice ------------------------------------------------------------------------ */

describe('interviewsSlice', () => {
  test('keeps sittings in order, most recent last', () => {
    let state = reducer(undefined, interviewSittingRecorded(sitting('2026-07-28', 1)));
    state = reducer(state, interviewSittingRecorded(sitting('2026-07-30', 2)));

    expect(state.sittings.map((s) => s.questionId)).toEqual([1, 2]);
  });

  test('caps the history rather than growing without bound', () => {
    let state = reducer(undefined, interviewSittingRecorded(sitting('2026-07-01', 1)));
    for (let i = 0; i < MAX_INTERVIEW_SITTINGS + 5; i += 1) {
      state = reducer(state, interviewSittingRecorded(sitting('2026-07-30', i + 100)));
    }

    expect(state.sittings).toHaveLength(MAX_INTERVIEW_SITTINGS);
    // The oldest went, not the newest.
    expect(state.sittings.some((s) => s.questionId === 1)).toBe(false);
  });

  test('an amendment only ever touches the sitting it names', () => {
    let state = reducer(undefined, interviewSittingRecorded(sitting('2026-07-28', 1)));
    state = reducer(state, interviewSittingRecorded(sitting('2026-07-30', 2)));

    // A stale dispatch naming the older sitting must not rewrite the newer one's numbers.
    state = reducer(
      state,
      interviewSittingAmended({
        questionId: 1,
        date: '2026-07-28',
        patch: { assessment: { clarity: 5 } },
      }),
    );
    expect(state.sittings[1]!.assessment).toEqual({ clarity: 3 });

    state = reducer(
      state,
      interviewSittingAmended({
        questionId: 2,
        date: '2026-07-30',
        patch: { assessment: { clarity: 5 } },
      }),
    );
    expect(state.sittings[1]!.assessment).toEqual({ clarity: 5 });
  });

  test('an imported backup replaces the history; a reset clears it', () => {
    const seeded = reducer(undefined, interviewSittingRecorded(sitting(TODAY, 1)));
    const imported = reducer(
      seeded,
      stateImported({
        interviews: { sittings: [sitting('2026-06-01', 9)] },
      } as unknown as PersistedStateV1),
    );
    expect(imported.sittings.map((s) => s.questionId)).toEqual([9]);

    expect(reducer(seeded, progressReset()).sittings).toEqual([]);
  });
});

/* --- finishInterview: the closing line ------------------------------------------------------- */

describe('finishInterview banks the sitting', () => {
  const startSitting = (store: ReturnType<typeof makeStore>, questionId: number) => {
    store.dispatch(
      interviewStarted({ questionId, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );
  };

  test('records what the sitting cost and how far it got', () => {
    const store = makeStore();
    startSitting(store, questions[0]!.id);
    store.dispatch(stageOutcomeSet({ stage: 'understand', outcome: 'shaky' }));
    vi.setSystemTime(new Date(Date.now() + 18 * 60_000));
    store.dispatch(finishInterview());

    const banked = store.getState().interviews.sittings;
    expect(banked).toHaveLength(1);
    expect(banked[0]!.questionId).toBe(questions[0]!.id);
    expect(banked[0]!.date).toBe(TODAY);
    expect(banked[0]!.minutes).toBe(18);
    expect(banked[0]!.stageReached).toBe(1);
    expect(banked[0]!.outcomes).toEqual({ understand: 'shaky' });
    // Nothing is earned by sitting one. A record is evidence; a reward would make starting
    // interviews worth more than performing in them.
    expect(store.getState().gamification.xp).toBe(0);
  });

  test('the self-assessment answered afterwards lands on the same record', () => {
    const store = makeStore();
    startSitting(store, questions[0]!.id);
    store.dispatch(finishInterview());
    store.dispatch(rateInterview('clarity', 4));
    store.dispatch(rateInterview('complexity', 2));

    expect(store.getState().interviews.sittings[0]!.assessment).toEqual({
      clarity: 4,
      complexity: 2,
    });
    // And it is never totalled into anything.
    expect(store.getState().interviews.sittings[0]).not.toHaveProperty('score');
  });

  test('finishing twice banks one record', () => {
    const store = makeStore();
    startSitting(store, questions[0]!.id);
    store.dispatch(finishInterview());
    store.dispatch(finishInterview());

    expect(store.getState().interviews.sittings).toHaveLength(1);
  });

  test('finishing with no sitting running is a no-op', () => {
    const store = makeStore();
    store.dispatch(finishInterview());
    expect(store.getState().interviews.sittings).toEqual([]);
  });

  test('a sitting that runs past midnight belongs to the evening it began', () => {
    const store = makeStore();
    startSitting(store, questions[0]!.id);
    vi.setSystemTime(new Date('2026-07-31T00:20:00'));
    store.dispatch(finishInterview());

    expect(store.getState().interviews.sittings[0]!.date).toBe(TODAY);
  });

  test('the banked record cannot quarantine the learner’s state', () => {
    const store = makeStore();
    startSitting(store, questions[0]!.id);
    store.dispatch(finishInterview());
    store.dispatch(rateInterview('clarity', 5));

    const persisted = validatePersisted(
      JSON.parse(JSON.stringify(selectPersistedState(store.getState()))),
    );
    expect(persisted).not.toBeNull();
    expect(persisted!.interviews!.sittings).toEqual(store.getState().interviews.sittings);
  });

  test('a learner who has never sat an interview produces an interview-free payload', () => {
    const store = makeStore();
    expect(selectPersistedState(store.getState()).interviews).toBeUndefined();
  });
});

/* --- The debrief's comparison ---------------------------------------------------------------- */

describe('selectPreviousInterviewSitting', () => {
  test('is null on a first sitting — there is nothing to compare against', () => {
    const store = makeStore();
    store.dispatch(
      interviewStarted({ questionId: questions[0]!.id, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );
    store.dispatch(finishInterview());

    expect(selectPreviousInterviewSitting(store.getState())).toBeNull();
  });

  test('names the sitting before this one, never this one', () => {
    const store = makeStore();
    store.dispatch(
      interviewStarted({ questionId: questions[0]!.id, date: '2026-07-28', nowMs: Date.now(), hintsAtStart: 0 }),
    );
    store.dispatch(finishInterview());
    store.dispatch(
      interviewStarted({ questionId: questions[1]!.id, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );
    store.dispatch(finishInterview());

    const previous = selectPreviousInterviewSitting(store.getState());
    expect(previous!.questionId).toBe(questions[0]!.id);
  });

  test('every recorded stage index resolves to a real stage', () => {
    // The debrief renders STAGES[stageReached - 1]; an off-by-one here would read the wrong label
    // back at the learner, or crash the page on the highest stage.
    const store = makeStore();
    store.dispatch(
      interviewStarted({ questionId: questions[0]!.id, date: TODAY, nowMs: Date.now(), hintsAtStart: 0 }),
    );
    store.dispatch(finishInterview());

    const { stageReached } = store.getState().interviews.sittings[0]!;
    expect(STAGES[stageReached - 1]).toBeDefined();
  });
});
