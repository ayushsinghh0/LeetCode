import type { DayLog, Question } from '@/types';
import { addDays, diffDays } from '@/utils/dates';

export function totalDays(totalQuestions: number, perDay: number): number {
  return Math.ceil(totalQuestions / perDay);
}

export function daySlice(all: Question[], day: number, perDay: number): Question[] {
  const start = (day - 1) * perDay;
  return all.slice(start, start + perDay);
}

export function dayOfQuestion(id: number, perDay: number): number {
  return Math.ceil(id / perDay);
}

export function currentDay(solvedNewCount: number, perDay: number, totalQuestions: number): number {
  const day = Math.floor(solvedNewCount / perDay) + 1;
  return Math.min(day, totalDays(totalQuestions, perDay));
}

export function isWeeklyRevisionDay(day: number): boolean {
  return day > 0 && day % 7 === 0;
}

export function solvePace(
  dayLogs: Record<string, DayLog>, today: string, windowDays = 14
): number {
  let count = 0;
  for (const log of Object.values(dayLogs)) {
    const delta = diffDays(today, log.date); // today - log.date
    if (delta >= 0 && delta < windowDays) {
      count += log.solvedIds.length;
    }
  }
  return count / windowDays;
}

export function estimatedFinishDate(
  today: string, remaining: number, dayLogs: Record<string, DayLog>, perDay: number
): string {
  const windowDays = 14;
  let activeDays = 0;
  for (const log of Object.values(dayLogs)) {
    const delta = diffDays(today, log.date);
    if (delta >= 0 && delta < windowDays && log.solvedIds.length >= 1) {
      activeDays += 1;
    }
  }
  const pace = activeDays >= 3 ? solvePace(dayLogs, today, windowDays) : perDay;
  const guardedPace = Math.max(pace, 0.5);
  return addDays(today, Math.ceil(remaining / guardedPace));
}
