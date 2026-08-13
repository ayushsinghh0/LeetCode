import { COURSE_RECALL, recallByWeekId } from '@/data/courseRecall';
import { CORE_WEEKS, courseWeekById } from '@/data/aimlCourse';

test('every core course week has 4-6 recall prompts, at least 3 of them core-depth', () => {
  for (const week of CORE_WEEKS) {
    const prompts = recallByWeekId[week.id] ?? [];
    expect(prompts.length, `week ${week.id}`).toBeGreaterThanOrEqual(4);
    expect(prompts.length, `week ${week.id}`).toBeLessThanOrEqual(6);
    expect(prompts.filter((p) => p.depth === 'core').length, `week ${week.id}`).toBeGreaterThanOrEqual(3);
  }
});

test('recall prompts are well-formed: unique ids, valid weeks, non-empty prose, known depths', () => {
  const ids = new Set<string>();
  for (const p of COURSE_RECALL) {
    expect(ids.has(p.id)).toBe(false);
    ids.add(p.id);
    expect(courseWeekById.has(p.weekId)).toBe(true);
    expect(p.id.startsWith(`${p.weekId}-r`)).toBe(true);
    expect(p.prompt.trim()).not.toBe('');
    expect(p.answer.trim()).not.toBe('');
    expect(['core', 'stretch']).toContain(p.depth);
  }
});
