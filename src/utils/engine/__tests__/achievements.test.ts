import * as LucideIcons from 'lucide-react';
import questionsJson from '@/data/questions.json';
import { PATTERNS } from '@/data/patterns';
import type { DayLog, Question, QuestionProgress } from '@/types';
import { addDays } from '@/utils/dates';
import { applyRevision, applySolve, initialProgress } from '@/utils/engine/spacedRepetition';
import { difficultyStats, patternStats } from '@/utils/engine/stats';
import {
  ACHIEVEMENTS, buildAchievementCtx, evaluateAchievements,
  type AchievementCtx,
} from '@/utils/engine/achievements';
import { initialCourseProgress } from '@/utils/engine/aimlCourse';

const questions = questionsJson as Question[];

const mkLog = (date: string, overrides: Partial<DayLog> = {}): DayLog => ({
  date, solvedIds: [], revisionsPassed: [], revisionsFailed: [], xpEarned: 0, focusMinutes: 0,
  ...overrides,
});

// Baseline ctx built from the real (full) dataset with an empty byId: every pattern and
// difficulty has total > 0 but solved === 0, so no "all-X" / "pattern-100-X" check is
// trivially satisfied by a total of 0. Individual fields are overridden per test.
const zeroCtx: AchievementCtx = {
  solvedCount: 0,
  masteredCount: 0,
  streak: { current: 0, longest: 0 },
  patternStats: patternStats(questions, {}),
  difficultyStats: difficultyStats(questions, {}),
  perfectRevisionWeek: false,
  hadComeback: false,
  course: { sessionsDone: 0, weeksDone: 0, extrasDone: 0, doneWeekIds: [] },
};

const fixedIds = [
  'first-solve', 'solved-10', 'solved-50', 'solved-100', 'solved-250', 'solved-500', 'solved-539',
  'streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-50', 'streak-68',
  'all-easy', 'all-medium', 'all-hard', 'perfect-revision-week', 'comeback',
  'first-mastered', 'mastered-100',
];

const courseIds = [
  'course-first-session', 'course-first-week', 'course-transformers', 'course-rag',
  'course-fine-tuning', 'course-agents', 'course-memory', 'course-research',
  'course-halfway', 'course-complete', 'course-extras',
];

test('exactly 59 achievements: 20 fixed + one pattern-100-<id> per PATTERNS entry + 11 course ids, no duplicates', () => {
  const patternIds = PATTERNS.map((p) => `pattern-100-${p.id}`);

  expect(ACHIEVEMENTS).toHaveLength(59);
  const ids = ACHIEVEMENTS.map((a) => a.id);
  expect(new Set(ids).size).toBe(59); // no duplicate ids
  expect(new Set(ids)).toEqual(new Set([...fixedIds, ...patternIds, ...courseIds]));
});

test('pattern-100-<id> defs are titled "100% <Pattern Name>" for every PATTERNS entry', () => {
  PATTERNS.forEach((p) => {
    const def = ACHIEVEMENTS.find((a) => a.id === `pattern-100-${p.id}`);
    expect(def).toBeDefined();
    expect(def!.title).toBe(`100% ${p.name}`);
  });
});

test('every achievement icon is a real lucide-react export', () => {
  const icons = LucideIcons as unknown as Record<string, unknown>;
  ACHIEVEMENTS.forEach((a) => {
    expect(icons[a.icon]).toBeDefined();
  });
});

test('ctx with solvedCount 100 unlocks first-solve + solved-10/50/100 in one call, nothing else', () => {
  const ctx: AchievementCtx = { ...zeroCtx, solvedCount: 100 };
  const earned = evaluateAchievements(ctx, {});
  expect(earned).toEqual(['first-solve', 'solved-10', 'solved-50', 'solved-100']);
});

test('evaluateAchievements excludes ids already present as keys in unlocked', () => {
  const ctx: AchievementCtx = { ...zeroCtx, solvedCount: 100 };
  const earned = evaluateAchievements(ctx, { 'first-solve': '2026-01-01', 'solved-50': '2026-01-02' });
  expect(earned).toEqual(['solved-10', 'solved-100']);
});

test('pattern-100-two-pointers unlocks exactly when two-pointers pct is 100, no other pattern-100 id', () => {
  const fullPatternStats = patternStats(questions, {}).map((s) =>
    s.pattern === 'two-pointers' ? { ...s, solved: s.total, pct: 100 } : s);
  const ctx: AchievementCtx = { ...zeroCtx, patternStats: fullPatternStats };
  const earned = ACHIEVEMENTS.filter((a) => a.id.startsWith('pattern-100-') && a.check(ctx)).map((a) => a.id);
  expect(earned).toEqual(['pattern-100-two-pointers']);
});

test('streak achievements read streak.longest, not streak.current, so a past streak stays earned', () => {
  const ctx: AchievementCtx = { ...zeroCtx, streak: { current: 0, longest: 7 } };
  const earned = ACHIEVEMENTS.filter((a) => a.id.startsWith('streak-') && a.check(ctx)).map((a) => a.id);
  expect(earned).toEqual(['streak-3', 'streak-7']);
});

test('buildAchievementCtx: solvedCount/masteredCount/streak/pattern & difficulty stats reflect the real engines', () => {
  const qs: Question[] = [
    { id: 1, title: 'Q1', pattern: 'two-pointers', difficulty: 'easy', estimatedTime: 15 },
    { id: 2, title: 'Q2', pattern: 'two-pointers', difficulty: 'medium', estimatedTime: 25 },
  ];
  const today = '2026-07-30';

  const p1 = applySolve(initialProgress(), today); // solved, never revised -> not mastered
  let p2 = applySolve(initialProgress(), today);
  let day = p2.nextRevision!;
  for (let i = 0; i < 5; i++) { // 5 consecutive passes -> mastered
    p2 = applyRevision(p2, day, true);
    if (p2.nextRevision) day = p2.nextRevision;
  }
  const byId: Record<number, QuestionProgress> = { 1: p1, 2: p2 };
  const dayLogs: Record<string, DayLog> = { [today]: mkLog(today, { solvedIds: [1, 2] }) };

  const ctx = buildAchievementCtx(qs, byId, dayLogs, today);
  expect(ctx.solvedCount).toBe(2);
  expect(ctx.masteredCount).toBe(1); // only p2
  expect(ctx.streak).toEqual({ current: 1, longest: 1 });
  expect(ctx.patternStats.find((s) => s.pattern === 'two-pointers')?.solved).toBe(2);
  expect(ctx.difficultyStats.find((s) => s.difficulty === 'easy')?.solved).toBe(1);
});

test('buildAchievementCtx.perfectRevisionWeek: true only when all 7 trailing days (incl. today) have >=1 revision attempt and zero fails', () => {
  const today = '2026-07-30';

  const allPassDays: Record<string, DayLog> = {};
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, -i);
    allPassDays[date] = mkLog(date, { revisionsPassed: [i + 1] });
  }
  expect(buildAchievementCtx([], {}, allPassDays, today).perfectRevisionWeek).toBe(true);

  // Negative: one of the 7 days has no log at all -> zero attempts that day.
  const missingDay = { ...allPassDays };
  delete missingDay[addDays(today, -3)];
  expect(buildAchievementCtx([], {}, missingDay, today).perfectRevisionWeek).toBe(false);

  // Negative: one failed revision anywhere in the window breaks the "zero fails" rule,
  // even though every day still has an attempt.
  const withAFail: Record<string, DayLog> = {
    ...allPassDays,
    [today]: mkLog(today, { revisionsPassed: [1], revisionsFailed: [99] }),
  };
  expect(buildAchievementCtx([], {}, withAFail, today).perfectRevisionWeek).toBe(false);
});

test('course achievements: counters and specific-week arcs check the right ctx fields', () => {
  const withCourse = (course: AchievementCtx['course']): AchievementCtx => ({ ...zeroCtx, course });
  const earnedFor = (course: AchievementCtx['course']): string[] =>
    ACHIEVEMENTS.filter((a) => a.id.startsWith('course-') && a.check(withCourse(course))).map((a) => a.id);

  expect(earnedFor(zeroCtx.course)).toEqual([]);

  expect(earnedFor({ sessionsDone: 1, weeksDone: 0, extrasDone: 0, doneWeekIds: [] })).toEqual([
    'course-first-session',
  ]);

  // Transformer Master needs BOTH transformer weeks — one alone is not enough.
  expect(earnedFor({ sessionsDone: 2, weeksDone: 1, extrasDone: 0, doneWeekIds: ['w03'] })).toEqual([
    'course-first-session', 'course-first-week',
  ]);
  expect(
    earnedFor({ sessionsDone: 4, weeksDone: 2, extrasDone: 0, doneWeekIds: ['w03', 'w04'] }),
  ).toContain('course-transformers');

  expect(earnedFor({ sessionsDone: 26, weeksDone: 13, extrasDone: 0, doneWeekIds: [] })).toContain(
    'course-halfway',
  );
  expect(earnedFor({ sessionsDone: 52, weeksDone: 26, extrasDone: 0, doneWeekIds: [] })).toContain(
    'course-complete',
  );
  expect(earnedFor({ sessionsDone: 0, weeksDone: 0, extrasDone: 5, doneWeekIds: [] })).toEqual([
    'course-extras',
  ]);
});

test('buildAchievementCtx computes course stats from byWeekId, and defaults to zeros when omitted', () => {
  const doneWeek = { ...initialCourseProgress(), day1DoneOn: '2026-07-01', day2DoneOn: '2026-07-02' };
  const ctx = buildAchievementCtx([], {}, {}, '2026-07-30', {
    w03: doneWeek,
    w04: doneWeek,
    w09: { ...doneWeek, day2DoneOn: null }, // half-done week: sessions count, week doesn't
    'x-memory-1': { ...doneWeek, day2DoneOn: null }, // extras are single-session
  });
  expect(ctx.course.sessionsDone).toBe(5);
  expect(ctx.course.weeksDone).toBe(2);
  expect(ctx.course.extrasDone).toBe(1);
  expect(ctx.course.doneWeekIds.sort()).toEqual(['w03', 'w04', 'x-memory-1']);

  const bare = buildAchievementCtx([], {}, {}, '2026-07-30');
  expect(bare.course).toEqual({ sessionsDone: 0, weeksDone: 0, extrasDone: 0, doneWeekIds: [] });
});

test('buildAchievementCtx.hadComeback: true when two active days are >=4 days apart, false for a 3-day gap', () => {
  const today = '2026-07-30';

  const gap4: Record<string, DayLog> = {
    [addDays(today, -20)]: mkLog(addDays(today, -20), { solvedIds: [1] }),
    [addDays(today, -16)]: mkLog(addDays(today, -16), { solvedIds: [2] }), // gap of exactly 4
  };
  expect(buildAchievementCtx([], {}, gap4, today).hadComeback).toBe(true);

  const gap3: Record<string, DayLog> = {
    [addDays(today, -20)]: mkLog(addDays(today, -20), { solvedIds: [1] }),
    [addDays(today, -17)]: mkLog(addDays(today, -17), { solvedIds: [2] }), // gap of only 3
  };
  expect(buildAchievementCtx([], {}, gap3, today).hadComeback).toBe(false);

  expect(buildAchievementCtx([], {}, {}, today).hadComeback).toBe(false); // no activity at all
});
