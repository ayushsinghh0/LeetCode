import type { Difficulty } from '@/types';

export const SOLVE_XP: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 30 };

export const revisionXp = (d: Difficulty): number => SOLVE_XP[d] / 2;

export const DAILY_GOAL_BONUS = 25;
export const WEEKLY_CLEAR_BONUS = 50;

export function levelForXp(xp: number): number {
  let l = 1;
  while (xp >= 50 * l * (l + 1)) l++;
  return l;
}

export function levelProgress(xp: number): { level: number; intoLevel: number; needed: number } {
  const level = levelForXp(xp);
  const intoLevel = xp - 50 * (level - 1) * level;
  const needed = 100 * level;
  return { level, intoLevel, needed };
}
