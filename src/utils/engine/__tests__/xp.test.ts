import { DAILY_GOAL_BONUS, levelForXp, levelProgress, revisionXp, SOLVE_XP, WEEKLY_CLEAR_BONUS } from '@/utils/engine/xp';

test('xp constants per spec', () => {
  expect(SOLVE_XP).toEqual({ easy: 10, medium: 20, hard: 30 });
  expect(revisionXp('easy')).toBe(5);
  expect(revisionXp('hard')).toBe(15);
  expect(DAILY_GOAL_BONUS).toBe(25);
  expect(WEEKLY_CLEAR_BONUS).toBe(50);
});

test('quadratic level curve: thresholds 100, 300, 600, 1000', () => {
  expect(levelForXp(0)).toBe(1);
  expect(levelForXp(99)).toBe(1);
  expect(levelForXp(100)).toBe(2);
  expect(levelForXp(299)).toBe(2);
  expect(levelForXp(300)).toBe(3);
  expect(levelForXp(1000)).toBe(5);
});

test('levelProgress reports xp into current level and its cost', () => {
  expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, needed: 100 });
  expect(levelProgress(150)).toEqual({ level: 2, intoLevel: 50, needed: 200 });
  expect(levelProgress(300)).toEqual({ level: 3, intoLevel: 0, needed: 300 });
});
