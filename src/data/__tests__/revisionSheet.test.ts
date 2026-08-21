import { describe, expect, it } from 'vitest';
import {
  SHEET_PROVENANCE,
  SHEET_ROWS,
  SHEET_TOPICS,
  SHEET_TOTAL,
  sheetOnlyBySlug,
} from '@/data/revisionSheet';
// Membership is checked against the real universes on purpose: the sheet is a LENS, and the one
// thing a lens must never do is invent a problem that exists elsewhere under another identity.
import { contestProblemBySlug } from '@/data/contestLibrary';
import questionsData from '@/data/questions.json';
import { PATTERNS } from '@/data/patterns';
import type { Question, SheetRow } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));
const PATTERN_IDS = new Set(PATTERNS.map((p) => p.id));

/** The curriculum's slug, derived from its own catalog-built URL — the slug-only join idiom. */
const questionSlug = (q: Question) =>
  q.url ? q.url.split('/problems/')[1]!.replace(/\//g, '') : null;
const curriculumSlugs = new Set(
  questions.map(questionSlug).filter((s): s is string => s !== null),
);

describe('revision sheet — decoding', () => {
  it('decodes the full sheet: 23 topics, 99 sub-topics, 1,210 rows, 159 sheet-only problems', () => {
    expect(SHEET_TOPICS).toHaveLength(23);
    expect(SHEET_TOPICS.flatMap((t) => t.subtopics)).toHaveLength(99);
    expect(SHEET_ROWS).toHaveLength(1210);
    expect(SHEET_TOTAL).toBe(SHEET_ROWS.length);
    expect(sheetOnlyBySlug.size).toBe(159);
  });

  it('keeps the flat and hierarchical views consistent', () => {
    const flatFromTree = SHEET_TOPICS.flatMap((t) => t.subtopics.flatMap((s) => s.rows));
    expect(flatFromTree).toHaveLength(SHEET_ROWS.length);
    // Every flat row appears in the tree exactly once (same object, not a copy).
    const seen = new Set<SheetRow>(flatFromTree);
    expect(seen.size).toBe(SHEET_ROWS.length);
    for (const row of SHEET_ROWS) expect(seen.has(row)).toBe(true);
    // Names resolve through the indices, and `order` is the sub-topic's own 0-based sequence.
    for (const topic of SHEET_TOPICS) {
      for (const sub of topic.subtopics) {
        sub.rows.forEach((row, i) => {
          expect(row.topicIndex).toBe(topic.index);
          expect(row.topic).toBe(topic.name);
          expect(row.subtopicIndex).toBe(sub.index);
          expect(row.subtopic).toBe(sub.name);
          expect(row.order).toBe(i);
        });
      }
    }
  });

  it('starts where the sheet starts: Merge Two 2D Arrays, a library row', () => {
    const first = SHEET_ROWS[0]!;
    expect(first.ref.kind).toBe('library');
    if (first.ref.kind === 'library') {
      expect(first.ref.slug).toBe('merge-two-2d-arrays-by-summing-values');
    }
  });
});

describe('revision sheet — membership (the lens contract)', () => {
  it('resolves every curriculum reference to a real roadmap question', () => {
    for (const row of SHEET_ROWS) {
      if (row.ref.kind !== 'curriculum') continue;
      expect(
        questionById.has(row.ref.questionId),
        `curriculum row "${row.topic} → ${row.subtopic}" #${row.ref.questionId} must exist`,
      ).toBe(true);
    }
  });

  it('resolves every library reference to a real contest-library problem', () => {
    for (const row of SHEET_ROWS) {
      if (row.ref.kind !== 'library') continue;
      expect(
        contestProblemBySlug.has(row.ref.slug),
        `library row ${row.ref.slug} must exist in the contest library`,
      ).toBe(true);
    }
  });

  it('keeps every sheet-only problem OUT of both universes — exclusion by construction', () => {
    for (const [slug] of sheetOnlyBySlug) {
      expect(contestProblemBySlug.has(slug), `${slug} must not be a library problem`).toBe(false);
      expect(curriculumSlugs.has(slug), `${slug} must not be a roadmap question`).toBe(false);
    }
  });

  it('never lets one slug appear under two different kinds', () => {
    const kindBySlug = new Map<string, string>();
    for (const row of SHEET_ROWS) {
      const slug =
        row.ref.kind === 'curriculum'
          ? questionSlug(questionById.get(row.ref.questionId)!)
          : row.ref.kind === 'library'
            ? row.ref.slug
            : row.ref.kind === 'sheet'
              ? row.ref.problem.slug
              : null;
      if (slug === null) continue;
      const prior = kindBySlug.get(slug);
      if (prior !== undefined) {
        expect(prior, `${slug} appears as both ${prior} and ${row.ref.kind}`).toBe(row.ref.kind);
      } else {
        kindBySlug.set(slug, row.ref.kind);
      }
    }
  });
});

describe('revision sheet — the 159 additions', () => {
  it('gives each a well-formed identity and a slug-derived URL', () => {
    for (const [slug, p] of sheetOnlyBySlug) {
      expect(p.slug).toBe(slug);
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.title.trim()).not.toBe('');
      expect(Number.isInteger(p.frontendId)).toBe(true);
      expect(p.frontendId).toBeGreaterThan(0);
      expect(p.url).toBe(`https://leetcode.com/problems/${p.slug}/`);
      expect(['easy', 'medium', 'hard']).toContain(p.officialDifficulty);
    }
  });

  it('is unrated, and stores that absence as absence — no contestRating field at all', () => {
    for (const [, p] of sheetOnlyBySlug) {
      expect('contestRating' in p).toBe(false);
    }
  });

  it('maps patterns with the library\'s honesty rules', () => {
    for (const [, p] of sheetOnlyBySlug) {
      for (const id of [...p.aicmPatterns, ...p.inferredPatterns]) {
        expect(PATTERN_IDS.has(id)).toBe(true);
      }
      if (p.aicmPatterns.length > 0) {
        expect(['exact', 'strong']).toContain(p.mappingConfidence);
      }
      if (p.mappingConfidence === 'unmapped') {
        expect(p.aicmPatterns).toEqual([]);
        expect(p.inferredPatterns).toEqual([]);
      }
      const confident = new Set(p.aicmPatterns);
      for (const inferred of p.inferredPatterns) expect(confident.has(inferred)).toBe(false);
    }
  });
});

describe('revision sheet — untracked rows never gain an identity', () => {
  it('externals carry a named platform and no slug or url anywhere', () => {
    const externals = SHEET_ROWS.filter((r) => r.ref.kind === 'external');
    expect(externals.length).toBeGreaterThan(100);
    for (const row of externals) {
      if (row.ref.kind !== 'external') continue;
      expect(row.ref.platform.trim()).not.toBe('');
      expect(row.ref.title.trim()).not.toBe('');
      expect('slug' in row.ref).toBe(false);
      expect('url' in row.ref).toBe(false);
    }
  });

  it('the ambiguous row states its candidates and links nothing', () => {
    const ambiguous = SHEET_ROWS.filter((r) => r.ref.kind === 'ambiguous');
    expect(ambiguous).toHaveLength(1);
    const row = ambiguous[0]!;
    if (row.ref.kind === 'ambiguous') {
      expect(row.ref.title).toBe('Beautiful Numbers');
      expect(row.ref.note).not.toBe('');
      expect('slug' in row.ref).toBe(false);
      expect('url' in row.ref).toBe(false);
    }
  });
});

describe('revision sheet — spot checks against the source sheet', () => {
  it('Two Sum is a sheet-only addition under 2 Pointers → Two Pointer on Arrays', () => {
    const twoSum = sheetOnlyBySlug.get('two-sum');
    expect(twoSum).toBeDefined();
    expect(twoSum!.frontendId).toBe(1);
    const row = SHEET_ROWS.find(
      (r) => r.ref.kind === 'sheet' && r.ref.problem.slug === 'two-sum',
    );
    expect(row).toBeDefined();
    expect(row!.topic).toBe('2 Pointers');
    expect(row!.subtopic).toBe('Two Pointer on Arrays');
  });

  it('Merge Sorted Array is a curriculum reference (question 105), never a copy', () => {
    const row = SHEET_ROWS.find(
      (r) => r.ref.kind === 'curriculum' && r.ref.questionId === 105,
    );
    expect(row).toBeDefined();
    const q = questionById.get(105)!;
    expect(questionSlug(q)).toBe('merge-sorted-array');
  });

  it('Pongal Bunk is external, platform Codeforces', () => {
    const row = SHEET_ROWS.find(
      (r) => r.ref.kind === 'external' && r.ref.title === 'Pongal Bunk',
    );
    expect(row).toBeDefined();
    if (row!.ref.kind === 'external') expect(row!.ref.platform).toBe('Codeforces');
  });
});

describe('revision sheet — provenance', () => {
  it('names its source and stamps its generation', () => {
    expect(SHEET_PROVENANCE.resolvedFrom).toBe('scripts/data/revision-sheet.txt');
    expect(SHEET_PROVENANCE.metadataFetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(SHEET_PROVENANCE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
