// Generates src/data/revisionSheet.json from the resolved topic-wise revision sheet. Offline —
// no network. Run the resolver first (or via `npm run generate:revision-sheet`):
//   node scripts/resolve-revision-sheet.mjs
//   node scripts/generate-revision-sheet.mjs
//
// NEVER hand-edit src/data/revisionSheet.json. It is generated, dictionary-encoded, and
// validated here; an edit would be silently overwritten and, worse, would be unverifiable.
//
// ── WHAT THIS DATASET IS ────────────────────────────────────────────────────────────────────
// A LENS, not a third question universe. 84% of the sheet's problems already live in this
// repository, so a row carries a REFERENCE to the universe that owns it — a curriculum question
// id, or a contest-library slug — and no duplicated metadata that could drift out of step.
// Only the 159 problems in NEITHER universe carry their own metadata here, because nothing
// else holds it. The 134 non-LeetCode rows are listed with their platform named and nothing
// linked; the one ambiguous title stays ambiguous (a wrong link is worse than a missing one).
//
// ── THE ONE RULE, AGAIN ─────────────────────────────────────────────────────────────────────
// EVERY JOIN IS ON THE SLUG. And the exclusion the product depends on is enforced HERE, by
// construction: a slug that resolves to the roadmap is emitted as kind `curriculum` and can
// never be a "new revision problem"; a sheet-only slug found in either universe fails the build.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTagResolver, validatePatternMap, CONFIDENCE_RANK } from './lib/pattern-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ── Sources ─────────────────────────────────────────────────────────────────────────────── */

const resolved = read('scripts', 'data', 'revision-sheet-resolved.json');
const questions = read('src', 'data', 'questions.json');
const library = read('src', 'data', 'contestLibrary.json');
const topicsSnapshot = read('scripts', 'data', 'leetcode-topics.json');
const catalog = read('scripts', 'data', 'leetcode-catalog.json');
const patternMap = read('scripts', 'data', 'contest-pattern-map.json');

// PatternId is defined in src/types/index.ts and mirrored by src/data/patterns.ts — same
// honesty device the contest generator uses: a renamed pattern fails the build here.
const PATTERN_IDS = new Set(
  [...readFileSync(join(root, 'src', 'data', 'patterns.ts'), 'utf8').matchAll(/id: '([a-z0-9-]+)'/g)].map(
    (m) => m[1],
  ),
);
if (PATTERN_IDS.size !== 28) fail(`Expected 28 AICM patterns from patterns.ts, found ${PATTERN_IDS.size}`);

/* ── Indexes ─────────────────────────────────────────────────────────────────────────────── */

const slugOfQuestion = (q) =>
  typeof q.url === 'string' && q.url.includes('/problems/')
    ? q.url.split('/problems/')[1].replace(/\//g, '')
    : null;
const curriculumBySlug = new Map();
for (const q of questions) {
  const slug = slugOfQuestion(q);
  if (slug !== null) curriculumBySlug.set(slug, q);
}
const questionIds = new Set(questions.map((q) => q.id));

// Membership in the contest library is the slug column of the encoded dataset — the dataset
// itself, not a proxy like "has a contest label".
const librarySlugs = new Set(library.problems.map((row) => row[0]));

const topicsBySlug = new Map(topicsSnapshot.problems.map((p) => [p.slug, p]));
const catalogBySlug = new Map(catalog.problems.map((p) => [p.slug, p]));

const knownTags = new Set(topicsSnapshot.problems.flatMap((p) => p.topics));
validatePatternMap(patternMap, { knownTags, patternIds: PATTERN_IDS, fail, warn });
const resolveFromTags = makeTagResolver(patternMap);

/* ── Dictionaries, interned in sheet order ───────────────────────────────────────────────── */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIFFICULTY_CODE = { easy: 0, medium: 1, hard: 2 };
const SHEET_DIFFICULTY_CODE = { Easy: 0, Medium: 1, Hard: 2, Theory: 3 };
const CONFIDENCE_CODE = { unmapped: 0, heuristic: 1, strong: 2, exact: 3 };

const topics = [];
const topicIdxByName = new Map();
const subtopics = []; // [topicIdx, name]
const subIdxByKey = new Map(); // `${topicIdx}|${name}` -> idx
const platforms = [];
const platformIdx = new Map();
const tags = [];
const tagIdx = new Map();
const patterns = [];
const patternIdx = new Map();

const intern = (list, map, value) => {
  let idx = map.get(value);
  if (idx === undefined) {
    idx = list.length;
    list.push(value);
    map.set(value, idx);
  }
  return idx;
};

/* ── Walk the sheet ──────────────────────────────────────────────────────────────────────── */

// The 159, unique by slug, first-appearance order. A problem the sheet lists under two
// sub-topics is stored once and referenced twice — one identity, and no second copy to drift.
const sheetProblems = [];
const sheetProblemIdxBySlug = new Map();

// A slug must arrive at ONE kind everywhere it appears; two kinds would be two identities.
const kindBySlug = new Map();

const rows = [];
const stats = {
  rows: 0,
  curriculumRows: 0,
  libraryRows: 0,
  sheetRows: 0,
  externalRows: 0,
  ambiguousRows: 0,
  mapping: { exact: 0, strong: 0, heuristic: 0, unmapped: 0 },
};

for (const r of resolved.sheet) {
  const where = `"${r.title}" (${r.topic} → ${r.sub})`;
  const topicIdx = intern(topics, topicIdxByName, r.topic);
  const subKey = `${topicIdx}|${r.sub}`;
  let subIdx = subIdxByKey.get(subKey);
  if (subIdx === undefined) {
    subIdx = subtopics.length;
    subtopics.push([topicIdx, r.sub]);
    subIdxByKey.set(subKey, subIdx);
  }
  stats.rows++;

  if (r.status === 'leetcode') {
    if (typeof r.slug !== 'string' || !SLUG_RE.test(r.slug)) {
      fail(`${where}: malformed slug "${r.slug}"`);
      continue;
    }

    const curriculum = curriculumBySlug.get(r.slug);
    const inLibrary = librarySlugs.has(r.slug);

    if (curriculum) {
      // Roadmap wins over library: one problem, one identity, one record in progress.byId.
      // The resolver's own roadmap id must agree — a disagreement is an identity drift.
      if (r.inRoadmap !== null && r.inRoadmap !== curriculum.id) {
        fail(`${where}: resolver says roadmap #${r.inRoadmap}, questions.json says #${curriculum.id}`);
      }
      const prior = kindBySlug.get(r.slug);
      if (prior !== undefined && prior !== 0) fail(`${where}: slug resolves to two kinds`);
      kindBySlug.set(r.slug, 0);
      rows.push([subIdx, 0, curriculum.id]);
      stats.curriculumRows++;
    } else if (inLibrary) {
      if (r.inRoadmap !== null) fail(`${where}: resolver claims roadmap #${r.inRoadmap} but slug is not on it`);
      const prior = kindBySlug.get(r.slug);
      if (prior !== undefined && prior !== 1) fail(`${where}: slug resolves to two kinds`);
      kindBySlug.set(r.slug, 1);
      rows.push([subIdx, 1, r.slug]);
      stats.libraryRows++;
    } else {
      // One of the 159 — the only rows that carry their own metadata, because nothing else
      // holds it. Closed world: the slug must exist in BOTH committed snapshots.
      const prior = kindBySlug.get(r.slug);
      if (prior !== undefined && prior !== 2) fail(`${where}: slug resolves to two kinds`);
      kindBySlug.set(r.slug, 2);

      let idx = sheetProblemIdxBySlug.get(r.slug);
      if (idx === undefined) {
        const meta = topicsBySlug.get(r.slug);
        const cat = catalogBySlug.get(r.slug);
        if (!meta) {
          fail(`${where}: slug not present in the committed topic snapshot`);
          continue;
        }
        if (!cat) {
          fail(`${where}: slug not present in the committed LeetCode catalog`);
          continue;
        }
        if (meta.frontendId !== r.frontendId) {
          fail(`${where}: frontend id disagrees between resolver (${r.frontendId}) and snapshot (${meta.frontendId})`);
        }
        if (!Number.isInteger(r.frontendId) || r.frontendId < 1) fail(`${where}: impossible frontend id`);
        if (DIFFICULTY_CODE[r.officialDifficulty] === undefined) {
          fail(`${where}: unknown official difficulty "${r.officialDifficulty}"`);
          continue;
        }

        // AICM patterns from the ONE shared mapper. Same discipline as the contest library:
        // confident (exact/strong) patterns are claims, heuristic ones are shown as inferred
        // and stay evidentially inert, and no pattern at all is a shipped, honest state.
        const found = resolveFromTags(meta.topics);
        const confident = [];
        const inferred = [];
        for (const [pattern, confidence] of found) {
          (confidence === 'heuristic' ? inferred : confident).push(pattern);
        }
        confident.sort();
        inferred.sort();
        const best =
          found.size === 0
            ? 'unmapped'
            : [...found.values()].reduce((a, b) => (CONFIDENCE_RANK[b] > CONFIDENCE_RANK[a] ? b : a));
        stats.mapping[best]++;

        idx = sheetProblems.length;
        sheetProblems.push([
          r.slug,
          r.frontendId,
          r.title,
          DIFFICULTY_CODE[r.officialDifficulty],
          r.premium ? 1 : 0,
          meta.topics.map((t) => intern(tags, tagIdx, t)),
          confident.map((p) => intern(patterns, patternIdx, p)),
          inferred.map((p) => intern(patterns, patternIdx, p)),
          CONFIDENCE_CODE[best],
        ]);
        sheetProblemIdxBySlug.set(r.slug, idx);
      }
      rows.push([subIdx, 2, idx]);
      stats.sheetRows++;
    }
  } else if (r.status === 'other-platform') {
    // Named, never linked. A fabricated URL is the failure this pipeline exists to avoid.
    if (typeof r.platform !== 'string' || r.platform.trim() === '') {
      fail(`${where}: external row with no platform`);
      continue;
    }
    if (typeof r.title !== 'string' || r.title.trim() === '') fail(`${where}: blank title`);
    const diffCode = SHEET_DIFFICULTY_CODE[r.difficulty] ?? null;
    rows.push([subIdx, 3, r.title, diffCode, intern(platforms, platformIdx, r.platform)]);
    stats.externalRows++;
  } else if (r.status === 'ambiguous') {
    // Reported with its candidates, not silently resolved (spec §3). One word from the user
    // turns this into an alias in resolve-revision-sheet.mjs.
    if (typeof r.note !== 'string' || r.note.trim() === '') fail(`${where}: ambiguous row with no note`);
    const diffCode = SHEET_DIFFICULTY_CODE[r.difficulty] ?? null;
    rows.push([subIdx, 4, r.title, diffCode, r.note]);
    stats.ambiguousRows++;
  } else {
    fail(`${where}: unknown status "${r.status}"`);
  }
}

/* ── Cross-checks against the resolver's own summary ─────────────────────────────────────── */

const summary = resolved.summary;
if (rows.length !== summary.rows) fail(`Emitted ${rows.length} rows; resolver counted ${summary.rows}`);
if (topics.length !== summary.topics) fail(`Emitted ${topics.length} topics; resolver counted ${summary.topics}`);
if (subtopics.length !== summary.subtopics) fail(`Emitted ${subtopics.length} subtopics; resolver counted ${summary.subtopics}`);
if (sheetProblems.length !== summary.newAndUnrated) {
  fail(`Emitted ${sheetProblems.length} sheet-only problems; resolver counted ${summary.newAndUnrated}`);
}
if (stats.externalRows !== summary.otherPlatform) {
  fail(`Emitted ${stats.externalRows} external rows; resolver counted ${summary.otherPlatform}`);
}
if (stats.ambiguousRows !== summary.ambiguous) {
  fail(`Emitted ${stats.ambiguousRows} ambiguous rows; resolver counted ${summary.ambiguous}`);
}

const uniqueCurriculum = new Set(rows.filter((r) => r[1] === 0).map((r) => r[2])).size;
const uniqueLibrary = new Set(rows.filter((r) => r[1] === 1).map((r) => r[2])).size;
if (uniqueCurriculum !== summary.alreadyOnRoadmap) {
  fail(`${uniqueCurriculum} unique roadmap problems; resolver counted ${summary.alreadyOnRoadmap}`);
}
if (uniqueLibrary !== summary.newAndRated) {
  fail(`${uniqueLibrary} unique library problems; resolver counted ${summary.newAndRated}`);
}

// The exclusion the whole feature rests on, restated as a build gate: no sheet-only problem is
// in either universe. (Construction already guarantees it; this is the tripwire for a future
// regeneration where questions.json or the library grew.)
for (const [slug] of sheetProblemIdxBySlug) {
  if (curriculumBySlug.has(slug)) fail(`Sheet-only "${slug}" is on the roadmap — must be kind curriculum`);
  if (librarySlugs.has(slug)) fail(`Sheet-only "${slug}" is in the contest library — must be kind library`);
}

// The curriculum must come out the other side untouched — this generator never writes it.
for (const id of new Set(rows.filter((r) => r[1] === 0).map((r) => r[2]))) {
  if (!questionIds.has(id)) fail(`Curriculum row references unknown question id ${id}`);
}

if (errors.length > 0) {
  console.error(`\nFAILED — ${errors.length} error${errors.length === 1 ? '' : 's'}:\n`);
  for (const e of errors.slice(0, 40)) console.error(`  ${e}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}

/* ── Emit ────────────────────────────────────────────────────────────────────────────────── */

const out = {
  _readme:
    'GENERATED by scripts/generate-revision-sheet.mjs — never hand-edit. A LENS over the two ' +
    'question universes: rows reference the universe that owns each problem. Row layout: ' +
    '[subIdx, kind, ...] where kind 0=curriculum [.., questionId], 1=library [.., slug], ' +
    '2=sheet-only [.., sheetProblemIdx], 3=external [.., title, diffCode|null, platformIdx], ' +
    '4=ambiguous [.., title, diffCode|null, note]. diffCode 0=easy 1=medium 2=hard 3=theory. ' +
    'sheetProblems rows: [slug, frontendId, title, diffCode, premium, tagIdxs, patternIdxs, ' +
    'inferredPatternIdxs, confidenceCode(0=unmapped,1=heuristic,2=strong,3=exact)]. Sheet-only ' +
    'problems carry NO contest rating — they are unrated, and absence is stored as absence. ' +
    'Decode via src/data/revisionSheet.ts.',
  provenance: {
    resolvedFrom: 'scripts/data/revision-sheet.txt',
    metadataFetchedAt: topicsSnapshot.fetchedAt,
    generatedAt: new Date().toISOString(),
  },
  dictionaries: {
    topics,
    subtopics,
    platforms,
    tags,
    patterns,
  },
  sheetProblems,
  total: rows.length,
  rows,
};

writeFileSync(join(root, 'src', 'data', 'revisionSheet.json'), JSON.stringify(out) + '\n');

/* ── Audit report ────────────────────────────────────────────────────────────────────────── */

const bytes = JSON.stringify(out).length;
console.log('\nRevision-sheet ingestion complete');
console.log(`  resolved from ${resolved.summary.rows} transcript rows`);
console.log(`  leetcode metadata fetched ${topicsSnapshot.fetchedAt}\n`);
console.log(`Rows:                  ${rows.length.toLocaleString()} across ${topics.length} topics / ${subtopics.length} sub-topics`);
console.log(`  curriculum rows      ${String(stats.curriculumRows).padStart(5)}  (${uniqueCurriculum} unique roadmap questions — reference only)`);
console.log(`  library rows         ${String(stats.libraryRows).padStart(5)}  (${uniqueLibrary} unique contest-library problems)`);
console.log(`  sheet-only rows      ${String(stats.sheetRows).padStart(5)}  (${sheetProblems.length} unique problems in NEITHER universe)`);
console.log(`  external rows        ${String(stats.externalRows).padStart(5)}  (platform named, nothing linked)`);
console.log(`  ambiguous rows       ${String(stats.ambiguousRows).padStart(5)}  (reported, never silently resolved)`);
console.log('');
console.log('AICM mappings for the sheet-only problems:');
for (const k of ['exact', 'strong', 'heuristic', 'unmapped']) {
  const n = stats.mapping[k];
  console.log(`  ${k.padEnd(10)} ${String(n).padStart(5)}  (${((n / Math.max(sheetProblems.length, 1)) * 100).toFixed(1)}%)`);
}
console.log('');
console.log(`Encoded size:   ${(bytes / 1024).toFixed(1)} kB`);
if (warnings.length > 0) {
  console.log(`\nWarnings: ${warnings.length}`);
  for (const w of warnings.slice(0, 12)) console.log(`  ${w}`);
  if (warnings.length > 12) console.log(`  ... and ${warnings.length - 12} more`);
}
