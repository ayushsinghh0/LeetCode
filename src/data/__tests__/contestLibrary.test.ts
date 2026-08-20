import { describe, expect, it } from 'vitest';
import {
  CONTEST_LIBRARY_PROVENANCE,
  CONTEST_PROBLEMS,
  CONTEST_RATING_NOTE,
  contestProblemByCurriculumId,
  contestProblemBySlug,
} from '@/data/contestLibrary';
// Bands live in the engine, not the data module: anything importing `@/data/contestLibrary` also
// downloads the 336 kB dataset, and band arithmetic must stay free of that.
import { RATING_BANDS, ratingBand } from '@/utils/engine/contestLibrary';
import { PATTERNS } from '@/data/patterns';
import questionsData from '@/data/questions.json';
// The engineering-time snapshot, read straight from scripts/data — this is the only test that
// needs the catalog's INTERNAL ids, precisely so it can prove none of them reached the dataset.
import catalogSnapshot from '../../../scripts/data/leetcode-catalog.json';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const PATTERN_IDS = new Set(PATTERNS.map((p) => p.id));

describe('contest library — decoding', () => {
  it('decodes every generated row', () => {
    expect(CONTEST_PROBLEMS.length).toBe(2561);
    expect(contestProblemBySlug.size).toBe(CONTEST_PROBLEMS.length);
  });

  it('derives the canonical URL from the slug, never from the title', () => {
    for (const p of CONTEST_PROBLEMS) {
      expect(p.url).toBe(`https://leetcode.com/problems/${p.slug}/`);
    }
  });

  it('gives every problem a well-formed identity', () => {
    for (const p of CONTEST_PROBLEMS) {
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.title.trim()).not.toBe('');
      expect(Number.isInteger(p.frontendId)).toBe(true);
      expect(['easy', 'medium', 'hard']).toContain(p.officialDifficulty);
    }
  });

  it('keeps ratings inside a plausible band', () => {
    for (const p of CONTEST_PROBLEMS) {
      expect(p.contestRating).toBeGreaterThanOrEqual(800);
      expect(p.contestRating).toBeLessThanOrEqual(4000);
    }
  });

  it('decodes contest type and number from the contest slug', () => {
    for (const p of CONTEST_PROBLEMS) {
      expect(['weekly', 'biweekly', 'unknown']).toContain(p.contest.type);
      if (p.contest.type !== 'unknown') {
        expect(p.contest.slug).toBe(`${p.contest.type}-contest-${p.contest.number}`);
      }
    }
  });

  it('admits a Q5, because Weekly Contest 68 ran five problems', () => {
    // Guards a real correction: the feature spec assumed Q1-Q4 only, which would have hard-failed
    // ingestion on one record. The index is a number precisely so this cannot recur.
    const indices = new Set(CONTEST_PROBLEMS.map((p) => p.contest.index));
    expect([...indices].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(CONTEST_PROBLEMS.filter((p) => p.contest.index === 5)).toHaveLength(1);
  });
});

describe('contest library — identity', () => {
  it('has no duplicate slugs and no duplicate contest positions', () => {
    const slugs = new Set(CONTEST_PROBLEMS.map((p) => p.slug));
    expect(slugs.size).toBe(CONTEST_PROBLEMS.length);
    const positions = new Set(CONTEST_PROBLEMS.map((p) => `${p.contest.slug}|${p.contest.index}`));
    expect(positions.size).toBe(CONTEST_PROBLEMS.length);
  });

  /**
   * THE ID TRAP, pinned — from the other side now.
   *
   * ZeroTrac's `ID` is LeetCode's FRONTEND question id; leetcode-catalog.json stores the INTERNAL
   * `question_id`, and they differ for 2561/2561 records. Until the §10.1 correction,
   * `Question.leetcodeId` held the internal id, so this test asserted that the two universes
   * DISAGREED numerically — a true statement about a bug, guarding the slug join.
   *
   * They now agree, because both sides carry the frontend id. That is the correction's whole
   * point: "LeetCode ID" means one thing across the repo. The guard is inverted rather than
   * deleted, because the thing worth pinning was never the disagreement itself — it was that
   * nothing may resolve a problem through the catalog's internal number.
   */
  it('agrees with curriculum leetcodeId on every bridged problem — one meaning of "LeetCode ID"', () => {
    const bridged = CONTEST_PROBLEMS.filter((p) => p.curriculumQuestionId !== null);
    expect(bridged.length).toBeGreaterThan(100);

    const byId = new Map(questions.map((q) => [q.id, q]));
    const disagreements: string[] = [];
    for (const p of bridged) {
      const q = byId.get(p.curriculumQuestionId as number)!;
      if (q.leetcodeId !== p.frontendId) {
        disagreements.push(`${p.title}: question ${q.leetcodeId} vs library ${p.frontendId}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  /**
   * The half of the trap that is still live: the CATALOG's internal id must never be what
   * `leetcodeId` holds. A regeneration that reverts to `problem.id` would make the test above fail
   * too, but this one names the actual mistake, and it fails with the internal id in the message.
   */
  it('never stores the catalog\'s internal question_id as leetcodeId', () => {
    const internalById = new Map(
      (catalogSnapshot.problems as { id: number; slug: string }[]).map((p) => [p.slug, p.id]),
    );
    const wrong: string[] = [];
    for (const p of CONTEST_PROBLEMS) {
      if (p.curriculumQuestionId === null) continue;
      const q = questions.find((x) => x.id === p.curriculumQuestionId)!;
      const internal = internalById.get(p.slug);
      // Below ~1000 the two ids coincide legitimately, so only a divergent pair is evidence.
      if (internal !== undefined && internal !== p.frontendId && q.leetcodeId === internal) {
        wrong.push(`${p.title}: leetcodeId ${q.leetcodeId} is the internal question_id`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('bridges only to curriculum questions that exist, and by matching slug', () => {
    const questionSlug = (q: Question) =>
      q.url ? q.url.split('/problems/')[1]!.replace(/\//g, '') : null;
    const byId = new Map(questions.map((q) => [q.id, q]));

    for (const p of CONTEST_PROBLEMS) {
      if (p.curriculumQuestionId === null) continue;
      const q = byId.get(p.curriculumQuestionId);
      expect(q, `curriculum id ${p.curriculumQuestionId} must exist`).toBeDefined();
      expect(questionSlug(q!)).toBe(p.slug);
    }
  });

  it('exposes the bridge by curriculum id without duplicating the question', () => {
    expect(contestProblemByCurriculumId.size).toBeGreaterThan(100);
    for (const [id, p] of contestProblemByCurriculumId) {
      expect(p.curriculumQuestionId).toBe(id);
    }
  });
});

describe('contest library — pattern mapping honesty', () => {
  it('only ever emits real AICM pattern ids', () => {
    for (const p of CONTEST_PROBLEMS) {
      for (const id of [...p.aicmPatterns, ...p.inferredPatterns]) {
        expect(PATTERN_IDS.has(id)).toBe(true);
      }
    }
  });

  it('reports unmapped rather than guessing, and that state is genuinely populated', () => {
    const unmapped = CONTEST_PROBLEMS.filter((p) => p.mappingConfidence === 'unmapped');
    expect(unmapped.length).toBeGreaterThan(0);
    // The whole point: an unmapped problem claims nothing at all.
    for (const p of unmapped) {
      expect(p.aicmPatterns).toEqual([]);
      expect(p.inferredPatterns).toEqual([]);
    }
  });

  it('keeps heuristic mappings out of the filterable set', () => {
    for (const p of CONTEST_PROBLEMS) {
      if (p.mappingConfidence === 'heuristic') expect(p.aicmPatterns).toEqual([]);
      if (p.aicmPatterns.length > 0) expect(['exact', 'strong']).toContain(p.mappingConfidence);
    }
  });

  it('never assigns the same pattern to both the confident and the inferred list', () => {
    for (const p of CONTEST_PROBLEMS) {
      const confident = new Set(p.aicmPatterns);
      for (const inferred of p.inferredPatterns) expect(confident.has(inferred)).toBe(false);
    }
  });

  it('gives bridged curriculum problems their hand-verified pattern, not an inferred one', () => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const p of CONTEST_PROBLEMS) {
      if (p.curriculumQuestionId === null) continue;
      const q = byId.get(p.curriculumQuestionId)!;
      expect(p.mappingConfidence).toBe('exact');
      expect(p.aicmPatterns).toEqual([q.pattern]);
    }
  });

  it('only carries sub-patterns where the curriculum authored one', () => {
    // Tags cannot imply a sub-pattern — nothing in LeetCode's taxonomy is that fine-grained.
    for (const p of CONTEST_PROBLEMS) {
      if (p.aicmSubpatterns.length > 0) expect(p.curriculumQuestionId).not.toBeNull();
    }
  });

  it('classifies most of the library confidently enough to filter on', () => {
    const filterable = CONTEST_PROBLEMS.filter((p) => p.aicmPatterns.length > 0);
    expect(filterable.length / CONTEST_PROBLEMS.length).toBeGreaterThan(0.75);
  });
});

describe('contest library — rating bands', () => {
  it('covers every rating in the library with exactly one band', () => {
    for (const p of CONTEST_PROBLEMS) {
      const matches = RATING_BANDS.filter(
        (b: { min: number; max: number }) => p.contestRating >= b.min && p.contestRating <= b.max,
      );
      expect(matches).toHaveLength(1);
      expect(ratingBand(p.contestRating)).toBe(matches[0]);
    }
  });

  it('has contiguous, non-overlapping bands', () => {
    for (let i = 1; i < RATING_BANDS.length; i++) {
      expect(RATING_BANDS[i]!.min).toBe(RATING_BANDS[i - 1]!.max + 1);
    }
  });
});

describe('contest library — provenance', () => {
  it('names its sources so the claim can be re-checked', () => {
    expect(CONTEST_LIBRARY_PROVENANCE.ratingSource).toBe('zerotrac');
    expect(CONTEST_LIBRARY_PROVENANCE.metadataSource).toBe('leetcode');
    expect(CONTEST_LIBRARY_PROVENANCE.ratingFetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(CONTEST_LIBRARY_PROVENANCE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never calls the ZeroTrac number an official rating', () => {
    expect(CONTEST_RATING_NOTE).toContain('not an official LeetCode rating');
    expect(CONTEST_RATING_NOTE.toLowerCase()).not.toContain('official rating from');
  });
});
