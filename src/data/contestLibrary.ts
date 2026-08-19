import contestLibraryJson from '@/data/contestLibrary.json';
import type { ContestLibraryProblem, Difficulty, PatternId } from '@/types';

// The contest library — 2,561 rated contest problems, decoded from the generated
// dictionary-encoded dataset (scripts/generate-contest-library.mjs). Never hand-edit the JSON.
//
// WHY THIS MODULE IS THE ONLY DOOR. The dataset lives in its own `data-contests` bundle chunk
// (vite.config.ts) precisely so a learner who never opens Contest Practice never downloads it.
// Importing this module from `store/selectors.ts` or `store/actions.ts` would undo that with no
// error and no test failure — only a bigger app chunk. The same trap `mlTrackIndex.ts` exists to
// avoid, and `contestLibraryIndex.ts` is the equivalent escape hatch here: anything the STORE
// needs about contest problems must come from there, not from this file.
//
// Decoding happens once at module load. It is a flat pass over 2,561 rows building plain objects
// — measured well under a frame — and it buys every downstream reader ordinary object access
// instead of index arithmetic against a positional row.

interface EncodedLibrary {
  provenance: {
    ratingSource: string;
    ratingSourceUrl: string;
    ratingFetchedAt: string;
    metadataSource: string;
    metadataFetchedAt: string;
    catalogFetchedAt: string;
    generatedAt: string;
    ratingNote: string;
  };
  dictionaries: {
    topics: string[];
    contests: string[];
    patterns: string[];
    subpatterns: string[];
  };
  total: number;
  problems: EncodedRow[];
}

/** Positional row. The order is fixed by the generator and documented in the JSON's `_readme`. */
type EncodedRow = [
  slug: string,
  frontendId: number,
  title: string,
  difficultyCode: number,
  contestRating: number,
  contestIdx: number,
  problemIndex: number,
  topicIdxs: number[],
  patternIdxs: number[],
  inferredPatternIdxs: number[],
  subpatternIdxs: number[],
  confidenceCode: number,
  premium: number,
  curriculumQuestionId: number | null,
];

const encoded = contestLibraryJson as unknown as EncodedLibrary;

const DIFFICULTY: Difficulty[] = ['easy', 'medium', 'hard'];
const CONFIDENCE = ['unmapped', 'heuristic', 'strong', 'exact'] as const;

const CONTEST_RE = /^(weekly|biweekly)-contest-(\d+)$/;

/** Provenance for the maintainer and the audit script — never rendered wholesale in the UI. */
export const CONTEST_LIBRARY_PROVENANCE = encoded.provenance;

/**
 * The sentence every surface showing a rating must be able to reach. ZeroTrac's number is an
 * *estimate* derived from contest performance, not something LeetCode publishes; the claim
 * carries its own basis. Defined in the ENGINE (dataset-free) so the contest run surface — which
 * must never import this 336 kB chunk — can reach it too; re-exported here for convenience.
 */
export { CONTEST_RATING_NOTE } from '@/utils/engine/contestLibrary';

function decode(row: EncodedRow): ContestLibraryProblem {
  const contestSlug = encoded.dictionaries.contests[row[5]]!;
  const match = CONTEST_RE.exec(contestSlug);
  return {
    slug: row[0],
    frontendId: row[1],
    title: row[2],
    // Derived, not stored: 2,561 copies of the same prefix is 90 kB of nothing.
    url: `https://leetcode.com/problems/${row[0]}/`,
    officialDifficulty: DIFFICULTY[row[3]]!,
    contestRating: row[4],
    contest: {
      slug: contestSlug,
      type: (match ? match[1] : 'unknown') as 'weekly' | 'biweekly' | 'unknown',
      number: match ? Number(match[2]) : null,
      index: row[6],
    },
    leetcodeTopics: row[7].map((i) => encoded.dictionaries.topics[i]!),
    aicmPatterns: row[8].map((i) => encoded.dictionaries.patterns[i]! as PatternId),
    inferredPatterns: row[9].map((i) => encoded.dictionaries.patterns[i]! as PatternId),
    aicmSubpatterns: row[10].map((i) => encoded.dictionaries.subpatterns[i]!),
    mappingConfidence: CONFIDENCE[row[11]]!,
    premium: row[12] === 1,
    curriculumQuestionId: row[13],
  };
}

export const CONTEST_PROBLEMS: ContestLibraryProblem[] = encoded.problems.map(decode);

export const contestProblemBySlug: Map<string, ContestLibraryProblem> = new Map(
  CONTEST_PROBLEMS.map((p) => [p.slug, p]),
);

/**
 * Contest problems that are also curriculum questions, by curriculum id.
 *
 * This is the identity bridge (directive §5), and it is bigger than it sounds: 207 of the 539
 * are rated contest problems, so the curriculum's own question sheets can show a contest rating
 * with no content authored for it. One problem, one identity — never a second copy.
 */
export const contestProblemByCurriculumId: Map<number, ContestLibraryProblem> = new Map(
  CONTEST_PROBLEMS.filter((p) => p.curriculumQuestionId !== null).map((p) => [
    p.curriculumQuestionId as number,
    p,
  ]),
);

// Rating bands are pure logic and live in `@/utils/engine/contestLibrary`, not here — a module
// that imports this file also downloads the 336 kB dataset, and the bands are needed by callers
// that have no business paying for it.
