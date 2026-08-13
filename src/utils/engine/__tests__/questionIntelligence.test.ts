import { hintsFor, hintUse, MAX_HINT_LEVEL } from '@/utils/engine/hints';
import { isUnaidedMastery, MASTERY_LABEL, masteryState } from '@/utils/engine/mastery';
import { estimateFor, MIN_SAMPLES, paceSamples, plannedMinutes } from '@/utils/engine/timeEstimate';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import type { ProblemFamily, Question, QuestionProgress } from '@/types';
import { QF } from '@/test/questionFixture';

const family: ProblemFamily = {
  id: 'f1',
  pattern: 'two-pointers',
  name: 'Converging pointers',
  idea: 'Walk inward from both ends, maintaining the mirror relationship.',
  signals: ['asks whether a string reads the same backwards', 'positions i and n-1-i are compared'],
  trap: 'Building a reversed copy when one inward walk answers it.',
  members: [{ questionId: 1, role: 'canonical' }],
};

const q = (id: number, estimatedTime: number, overrides: Partial<Question> = {}): Question => ({
  id, title: `Q${id}`, pattern: 'two-pointers', difficulty: 'medium', estimatedTime, ...QF, ...overrides,
});

const solvedWith = (timeSpentMin: number): QuestionProgress => ({
  ...applySolve(initialProgress(), '2026-07-30'),
  timeSpentMin,
});

describe('hint ladder', () => {
  test('derives three rungs from the family, escalating notice -> technique -> trap', () => {
    const hints = hintsFor(family);

    expect(hints.map((h) => h.level)).toEqual([1, 2, 3]);
    expect(hints.map((h) => h.label)).toEqual(['What to notice', 'The technique', 'The trap']);
    expect(hints[0]!.lines).toEqual(family.signals);
    expect(hints[1]!.lines).toEqual([family.idea]);
    expect(hints[2]!.lines).toEqual([family.trap]);
    expect(hints).toHaveLength(MAX_HINT_LEVEL);
  });

  test('a question outside the family map gets no ladder rather than invented guidance', () => {
    expect(hintsFor(undefined)).toEqual([]);
  });

  test('hint use is reported without any penalty semantics', () => {
    expect(hintUse(undefined)).toBe('unaided');
    expect(hintUse(0)).toBe('unaided');
    expect(hintUse(1)).toBe('nudged');
    expect(hintUse(2)).toBe('guided');
    expect(hintUse(3)).toBe('walked-through');
  });
});

describe('mastery states', () => {
  test('separates solved-once from survived-the-ladder', () => {
    let p = initialProgress();
    expect(masteryState(p)).toBe('unseen');

    p = { ...p, status: 'in_progress' };
    expect(masteryState(p)).toBe('attempted');

    p = applySolve(initialProgress(), '2026-07-30');
    expect(masteryState(p)).toBe('solved');

    p = applyRevision(p, '2026-07-31', true); // stage 1
    expect(masteryState(p)).toBe('reviewing');

    p = applyRevision(p, '2026-08-03', true); // stage 2
    expect(masteryState(p)).toBe('reviewing');

    p = applyRevision(p, '2026-08-10', true); // stage 3 — past the 7-day gap
    expect(masteryState(p)).toBe('retained');

    p = applyRevision(p, '2026-08-25', true); // stage 4
    expect(masteryState(p)).toBe('retained');

    p = applyRevision(p, '2026-09-24', true); // stage 5
    expect(masteryState(p)).toBe('mastered');
  });

  test('a failed recall drops the reading back to reviewing, matching the ladder reset', () => {
    let p = applySolve(initialProgress(), '2026-07-30');
    p = applyRevision(p, '2026-07-31', true);
    p = applyRevision(p, '2026-08-03', true);
    p = applyRevision(p, '2026-08-10', true);
    expect(masteryState(p)).toBe('retained');

    p = applyRevision(p, '2026-08-25', false);
    expect(masteryState(p)).toBe('reviewing');
  });

  test('skipped is its own state, not a flavour of unseen', () => {
    expect(masteryState({ ...initialProgress(), status: 'skipped' })).toBe('skipped');
    expect(MASTERY_LABEL.skipped).toBe('Skipped');
  });

  test('hint use qualifies mastery without ever blocking it', () => {
    let p = applySolve(initialProgress(), '2026-07-30');
    for (const date of ['2026-07-31', '2026-08-03', '2026-08-10', '2026-08-25', '2026-09-24']) {
      p = applyRevision(p, date, true);
    }

    expect(masteryState(p)).toBe('mastered');
    expect(isUnaidedMastery(p)).toBe(true);

    // Having taken a hint does NOT prevent reaching mastered — it is reported alongside it.
    const guided = { ...p, hintLevelUsed: 2 };
    expect(masteryState(guided)).toBe('mastered');
    expect(isUnaidedMastery(guided)).toBe(false);
  });
});

describe('personalized time estimates', () => {
  const all = Array.from({ length: 8 }, (_, i) => q(i + 1, 20));

  test('stays silent until there are enough comparable measurements', () => {
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i < MIN_SAMPLES; i++) byId[i] = solvedWith(10);

    const estimate = estimateFor(all[0]!, paceSamples(all, byId));

    expect(estimate.personal).toBeNull();
    expect(estimate.basis).toBeNull();
    expect(estimate.typical).toBe(20);
    // The plan falls back to the dataset figure rather than inventing one.
    expect(plannedMinutes(estimate)).toBe(20);
  });

  test('projects from the median pace ratio once the evidence is there, and says what it used', () => {
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= MIN_SAMPLES; i++) byId[i] = solvedWith(10); // half the book estimate

    const estimate = estimateFor(all[0]!, paceSamples(all, byId));

    expect(estimate.personal).toBe(10);
    expect(estimate.basis).toBe('pattern');
    expect(estimate.sampleSize).toBe(MIN_SAMPLES);
    expect(plannedMinutes(estimate)).toBe(10);
  });

  test('an unmeasured solve is not counted as a measurement of zero', () => {
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= MIN_SAMPLES; i++) byId[i] = solvedWith(0); // solved, never timed

    expect(paceSamples(all, byId)).toEqual([]);
    expect(estimateFor(all[0]!, paceSamples(all, byId)).personal).toBeNull();
  });

  test('an implausible sample (a timer left running) is discarded, not averaged in', () => {
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= MIN_SAMPLES; i++) byId[i] = solvedWith(20);
    byId[6] = solvedWith(20 * 60); // six hours on a 20-minute question

    const samples = paceSamples(all, byId);
    expect(samples).toHaveLength(MIN_SAMPLES);
    expect(estimateFor(all[0]!, samples).personal).toBe(20);
  });

  test('falls back to a same-difficulty comparison when the pattern pool is too thin', () => {
    const mixed = [
      ...Array.from({ length: 6 }, (_, i) => q(i + 1, 20, { pattern: 'graphs' })),
      q(99, 20, { pattern: 'trie' }),
    ];
    const byId: Record<number, QuestionProgress> = {};
    for (let i = 1; i <= 6; i++) byId[i] = solvedWith(30); // 1.5x the book estimate

    const estimate = estimateFor(mixed[6]!, paceSamples(mixed, byId));

    expect(estimate.basis).toBe('difficulty');
    expect(estimate.personal).toBe(30);
  });
});
