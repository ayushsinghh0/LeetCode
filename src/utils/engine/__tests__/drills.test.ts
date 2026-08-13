import { describe, expect, test } from 'vitest';
import { buildDrill } from '@/utils/engine/drills';
import type { ProblemFamily, Question } from '@/types';

const q = (id: number, pattern: string): Question => ({
  id,
  title: `Q${id}`,
  pattern: pattern as Question['pattern'],
  difficulty: 'medium',
  estimatedTime: 25,
});

const fam = (id: string, pattern: string, questionIds: number[]): ProblemFamily => ({
  id,
  pattern: pattern as ProblemFamily['pattern'],
  name: id,
  idea: 'idea',
  signals: ['a', 'b'],
  trap: 'trap',
  members: questionIds.map((questionId, i) => ({
    questionId,
    role: i === 0 ? 'canonical' : 'standard',
  })),
});

const FAMILIES = [
  fam('f-window', 'sliding-window', [1, 2, 3]),
  fam('f-pointer', 'two-pointers', [4, 5]),
  fam('f-graph', 'graphs', [6, 7]),
  fam('f-dp', 'dynamic-programming', [8]),
];
const QUESTIONS = new Map(
  [
    q(1, 'sliding-window'), q(2, 'sliding-window'), q(3, 'sliding-window'),
    q(4, 'two-pointers'), q(5, 'two-pointers'),
    q(6, 'graphs'), q(7, 'graphs'), q(8, 'dynamic-programming'),
  ].map((question) => [question.id, question]),
);

describe('buildDrill', () => {
  test('is deterministic for a given seed and differs across seeds', () => {
    const a = buildDrill(FAMILIES, QUESTIONS, '2026-07-30');
    const b = buildDrill(FAMILIES, QUESTIONS, '2026-07-30');
    const c = buildDrill(FAMILIES, QUESTIONS, '2026-07-31');
    expect(a).toEqual(b);
    expect(a.map((i) => i.questionId)).not.toEqual(c.map((i) => i.questionId));
  });

  test('interleaves: the first round draws at most one question per family', () => {
    const drill = buildDrill(FAMILIES, QUESTIONS, '2026-07-30', 4);
    expect(drill).toHaveLength(4);
    expect(new Set(drill.map((i) => i.familyId)).size).toBe(4);
  });

  test('every item has 4 unique options including the correct pattern', () => {
    for (const item of buildDrill(FAMILIES, QUESTIONS, '2026-07-30', 8)) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      expect(item.options).toContain(item.pattern);
    }
  });

  test('caps at the available pool and never repeats a question', () => {
    const drill = buildDrill(FAMILIES, QUESTIONS, '2026-07-30', 50);
    expect(drill).toHaveLength(8); // pool exhausted
    expect(new Set(drill.map((i) => i.questionId)).size).toBe(8);
  });

  test('excludes cross-pattern members so the graded answer matches the question label', () => {
    const cross = [fam('f-mixed', 'sliding-window', [1, 4, 6])]; // 4 and 6 are other patterns
    const drill = buildDrill(cross, QUESTIONS, '2026-07-30', 8);
    expect(drill.map((i) => i.questionId)).toEqual([1]);
  });

  test('returns empty for no families', () => {
    expect(buildDrill([], QUESTIONS, '2026-07-30')).toEqual([]);
  });
});
