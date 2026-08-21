import revisionSheetJson from '@/data/revisionSheet.json';
import type {
  Difficulty,
  MappingConfidence,
  PatternId,
  SheetOnlyProblem,
  SheetRow,
  SheetRowRef,
  SheetSubtopic,
  SheetTopic,
} from '@/types';

// The topic-wise revision sheet — 1,210 rows decoded from the generated dictionary-encoded
// dataset (scripts/generate-revision-sheet.mjs). Never hand-edit the JSON.
//
// THE SHEET IS A LENS, NOT A THIRD UNIVERSE. Each row references the universe that owns its
// problem: kind 0 points at a roadmap question by id, kind 1 at a contest-library problem by
// slug, and only kind 2 carries its own metadata — the 159 problems that exist in neither.
// Kinds 3 (external platforms) and 4 (the one ambiguous title) are display-only rows with no
// identity at all: no slug, no URL, nothing tracked. A fabricated link is the failure this
// pipeline exists to avoid.
//
// WHY THIS MODULE IS THE ONLY DOOR — the contestLibrary.ts rule, applied again. The dataset
// lives in its own `data-sheet` chunk (vite.config.ts) so a learner who never opens the sheet
// never downloads it. This module deliberately imports NO other dataset: decoding resolves only
// against its own dictionaries, so consuming it can never chain `data-curriculum` or
// `data-contests` into a chunk that didn't already pay for them. Cross-universe resolution
// (question ids → Questions, slugs → library problems) happens at the consuming surface, which
// already owns those imports. `store/selectors.ts` and `store/actions.ts` must never import
// this file.

interface EncodedSheet {
  provenance: { resolvedFrom: string; metadataFetchedAt: string; generatedAt: string };
  dictionaries: {
    topics: string[];
    /** `[topicIdx, name]` — parent by index, sheet order. */
    subtopics: [number, string][];
    platforms: string[];
    tags: string[];
    patterns: string[];
  };
  /** The 159 additions, unique by slug, first-appearance order. */
  sheetProblems: EncodedSheetProblem[];
  total: number;
  rows: EncodedRow[];
}

/** Positional row. The order is fixed by the generator and documented in the JSON's `_readme`. */
type EncodedSheetProblem = [
  slug: string,
  frontendId: number,
  title: string,
  difficultyCode: number,
  premium: number,
  tagIdxs: number[],
  patternIdxs: number[],
  inferredPatternIdxs: number[],
  confidenceCode: number,
];

/**
 * `[subIdx, kind, ...rest]` where the tail depends on the kind:
 * 0 curriculum `[questionId]` · 1 library `[slug]` · 2 sheet-only `[sheetProblemIdx]` ·
 * 3 external `[title, diffCode|null, platformIdx, verifiedUrl?]` (the optional 6th column is a
 * hand-verified https link from scripts/data/external-links.json — unlisted rows stay unlinked) ·
 * 4 ambiguous `[title, diffCode|null, note]`.
 */
type EncodedRow = [subIdx: number, kind: number, ...rest: (string | number | null)[]];

const encoded = revisionSheetJson as unknown as EncodedSheet;

const DIFFICULTY: Difficulty[] = ['easy', 'medium', 'hard'];
const CONFIDENCE = ['unmapped', 'heuristic', 'strong', 'exact'] as const;

/** diffCode 0/1/2 = easy/medium/hard, 3 = theory (external rows only), null = unstated. */
function rowDifficulty(code: number | null): Difficulty | 'theory' | null {
  if (code === null) return null;
  return code === 3 ? 'theory' : DIFFICULTY[code]!;
}

export const SHEET_PROVENANCE = encoded.provenance;

function decodeSheetProblem(row: EncodedSheetProblem): SheetOnlyProblem {
  return {
    slug: row[0],
    frontendId: row[1],
    title: row[2],
    // Derived, not stored — the contestLibrary.ts rule.
    url: `https://leetcode.com/problems/${row[0]}/`,
    officialDifficulty: DIFFICULTY[row[3]]!,
    premium: row[4] === 1,
    leetcodeTopics: row[5].map((i) => encoded.dictionaries.tags[i]!),
    aicmPatterns: row[6].map((i) => encoded.dictionaries.patterns[i]! as PatternId),
    inferredPatterns: row[7].map((i) => encoded.dictionaries.patterns[i]! as PatternId),
    mappingConfidence: CONFIDENCE[row[8]]! as MappingConfidence,
  };
}

const sheetProblems = encoded.sheetProblems.map(decodeSheetProblem);

/** The 159 sheet-only problems by slug. */
export const sheetOnlyBySlug: Map<string, SheetOnlyProblem> = new Map(
  sheetProblems.map((p) => [p.slug, p]),
);

function decodeRef(row: EncodedRow): SheetRowRef {
  switch (row[1]) {
    case 0:
      return { kind: 'curriculum', questionId: row[2] as number };
    case 1:
      return { kind: 'library', slug: row[2] as string };
    case 2:
      return { kind: 'sheet', problem: sheetProblems[row[2] as number]! };
    case 3:
      return {
        kind: 'external',
        title: row[2] as string,
        difficulty: rowDifficulty(row[3] as number | null),
        platform: encoded.dictionaries.platforms[row[4] as number]!,
        url: (row[5] as string | undefined) ?? null,
      };
    default:
      return {
        kind: 'ambiguous',
        title: row[2] as string,
        difficulty: rowDifficulty(row[3] as number | null),
        note: row[4] as string,
      };
  }
}

// One flat pass in sheet order, tracking each sub-topic's own running position so `order` is
// the sheet's teaching order within the sub-topic whatever the global interleaving.
const orderWithin = new Map<number, number>();

/** Every row, flat, in sheet order. */
export const SHEET_ROWS: SheetRow[] = encoded.rows.map((row) => {
  const subtopicIndex = row[0];
  const [topicIndex, subtopicName] = encoded.dictionaries.subtopics[subtopicIndex]!;
  const order = orderWithin.get(subtopicIndex) ?? 0;
  orderWithin.set(subtopicIndex, order + 1);
  return {
    topicIndex,
    topic: encoded.dictionaries.topics[topicIndex]!,
    subtopicIndex,
    subtopic: subtopicName,
    order,
    ref: decodeRef(row),
  };
});

/** The 23 topics with their sub-topics — the same row objects, grouped. */
export const SHEET_TOPICS: SheetTopic[] = (() => {
  const topics: SheetTopic[] = encoded.dictionaries.topics.map((name, index) => ({
    index,
    name,
    subtopics: [],
  }));
  const subtopics: SheetSubtopic[] = encoded.dictionaries.subtopics.map(([topicIdx, name], index) => {
    const sub: SheetSubtopic = { index, name, rows: [] };
    topics[topicIdx]!.subtopics.push(sub);
    return sub;
  });
  for (const row of SHEET_ROWS) subtopics[row.subtopicIndex]!.rows.push(row);
  return topics;
})();

export const SHEET_TOTAL: number = SHEET_ROWS.length;
