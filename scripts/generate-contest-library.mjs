// Generates src/data/contestLibrary.json from the committed snapshots. Offline — no network.
//   node scripts/generate-contest-library.mjs
//
// Refresh the snapshots first (network, engineering-time only):
//   node scripts/fetch-zerotrac-ratings.mjs
//   node scripts/fetch-leetcode-topics.mjs
//
// NEVER hand-edit src/data/contestLibrary.json. It is generated, dictionary-encoded, and
// validated here; an edit would be silently overwritten and, worse, would be unverifiable.
//
// ── THE ONE RULE THIS FILE EXISTS TO ENFORCE ────────────────────────────────────────────────
// EVERY JOIN IS ON THE SLUG. ZeroTrac's `ID` is LeetCode's FRONTEND question id; the committed
// leetcode-catalog.json stores the INTERNAL `question_id`. Measured 2026-08-19, they differ for
// 2561/2561 records — a numeric join would silently pair every rating with the wrong problem.
// Slug resolution covers 2561/2561. There is no fallback to an id join, deliberately.
//
// ── THE TWO UNIVERSES (directive §6) ────────────────────────────────────────────────────────
// The 539 curated curriculum questions and the contest library stay separate. A contest problem
// that IS a curriculum question carries `curriculumQuestionId` and inherits that question's
// hand-verified AICM pattern and sub-pattern; it does not become a second copy of it. Everything
// else is contest-only and gets its patterns from the hand-verified tag map, or none at all.
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

const zerotrac = read('scripts', 'data', 'zerotrac-ratings.json');
const topicsSnapshot = read('scripts', 'data', 'leetcode-topics.json');
const catalog = read('scripts', 'data', 'leetcode-catalog.json');
const patternMap = read('scripts', 'data', 'contest-pattern-map.json');
const questions = read('src', 'data', 'questions.json');

// PatternId is defined in src/types/index.ts and mirrored by src/data/patterns.ts. Reading the
// ids out of patterns.ts keeps this generator honest without importing TypeScript: a pattern
// renamed there fails the build here rather than shipping a dangling id.
const PATTERN_IDS = new Set(
  [...readFileSync(join(root, 'src', 'data', 'patterns.ts'), 'utf8').matchAll(/id: '([a-z0-9-]+)'/g)].map(
    (m) => m[1],
  ),
);
if (PATTERN_IDS.size !== 28) fail(`Expected 28 AICM patterns from patterns.ts, found ${PATTERN_IDS.size}`);

/* ── Indexes ─────────────────────────────────────────────────────────────────────────────── */

const catalogBySlug = new Map(catalog.problems.map((p) => [p.slug, p]));
const topicsBySlug = new Map(topicsSnapshot.problems.map((p) => [p.slug, p]));

const slugOfQuestion = (q) =>
  typeof q.url === 'string' && q.url.includes('/problems/')
    ? q.url.split('/problems/')[1].replace(/\//g, '')
    : null;
const curriculumBySlug = new Map();
for (const q of questions) {
  const slug = slugOfQuestion(q);
  if (slug !== null) curriculumBySlug.set(slug, q);
}

/* ── Validate the hand-authored map before trusting it ───────────────────────────────────── */

// Validation and resolution both live in scripts/lib/pattern-map.mjs, shared with the
// revision-sheet generator — one mapper, so the two datasets can never classify a tag set
// differently.
const knownTags = new Set(topicsSnapshot.problems.flatMap((p) => p.topics));
validatePatternMap(patternMap, { knownTags, patternIds: PATTERN_IDS, fail, warn });

/* ── Pattern resolution ──────────────────────────────────────────────────────────────────── */

const RANK = CONFIDENCE_RANK;
const resolveFromTags = makeTagResolver(patternMap);

/* ── Build ───────────────────────────────────────────────────────────────────────────────── */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONTEST_RE = /^(weekly|biweekly)-contest-(\d+)$/;
const INDEX_RE = /^Q([1-9])$/;
const RATING_MIN = 800;
const RATING_MAX = 4000;

const seenSlug = new Set();
const seenPosition = new Set();
const records = [];

const stats = {
  ratingRecords: zerotrac.ratings.length,
  catalogMatched: 0,
  topicsMatched: 0,
  withTopicTags: 0,
  mapping: { exact: 0, strong: 0, heuristic: 0, unmapped: 0 },
  curriculumOverlap: 0,
  contestOnly: 0,
  premium: 0,
  byIndex: {},
  byType: {},
};

for (const r of zerotrac.ratings) {
  const where = `#${r.frontendId} ${r.slug}`;

  if (!SLUG_RE.test(r.slug)) fail(`${where}: malformed slug`);
  if (seenSlug.has(r.slug)) fail(`${where}: duplicate slug`);
  seenSlug.add(r.slug);

  if (typeof r.title !== 'string' || r.title.trim() === '') fail(`${where}: missing title`);
  if (typeof r.rating !== 'number' || !Number.isFinite(r.rating)) fail(`${where}: malformed rating`);
  else if (r.rating < RATING_MIN || r.rating > RATING_MAX) fail(`${where}: rating ${r.rating} outside ${RATING_MIN}-${RATING_MAX}`);

  const contestMatch = CONTEST_RE.exec(r.contestSlug);
  if (!contestMatch) fail(`${where}: unrecognised contest slug "${r.contestSlug}"`);
  const indexMatch = INDEX_RE.exec(r.problemIndex);
  if (!indexMatch) fail(`${where}: impossible problem index "${r.problemIndex}"`);

  const position = `${r.contestSlug}|${r.problemIndex}`;
  if (seenPosition.has(position)) fail(`${where}: duplicate contest position ${position}`);
  seenPosition.add(position);

  const cat = catalogBySlug.get(r.slug);
  if (!cat) {
    // Closed-world, exactly like the question generator: an unresolvable title is a build
    // failure, never a silently dropped record (directive §37).
    fail(`${where}: slug not present in the committed LeetCode catalog`);
    continue;
  }
  stats.catalogMatched++;

  const meta = topicsBySlug.get(r.slug);
  if (!meta) {
    fail(`${where}: slug not present in the committed topic snapshot`);
    continue;
  }
  stats.topicsMatched++;

  if (meta.frontendId !== r.frontendId) {
    fail(`${where}: frontend id disagrees between ZeroTrac (${r.frontendId}) and LeetCode (${meta.frontendId})`);
  }
  if (meta.difficulty !== cat.difficulty) {
    fail(`${where}: difficulty disagrees between catalog (${cat.difficulty}) and topic snapshot (${meta.difficulty})`);
  }

  const topics = meta.topics;
  if (topics.length === 0) warn(`${where}: no topic tags (usually premium-gated)`);
  else stats.withTopicTags++;

  const curriculum = curriculumBySlug.get(r.slug) ?? null;

  /** @type {Map<string, string>} */
  let patternConfidence;
  let subpatterns = [];
  if (curriculum) {
    // The 207. Their AICM classification is already hand-verified in the 539 — inference would
    // be strictly worse than the answer the curriculum already holds.
    if (!PATTERN_IDS.has(curriculum.pattern)) fail(`${where}: curriculum question #${curriculum.id} has unknown pattern`);
    if (curriculum.title !== r.title && curriculum.title.trim() !== r.title.trim()) {
      // Not fatal: LeetCode has renamed problems before and the curriculum title is the
      // authored one. Worth surfacing because it is how an identity drift would first show.
      warn(`${where}: title differs from curriculum #${curriculum.id} ("${curriculum.title}")`);
    }
    patternConfidence = new Map([[curriculum.pattern, 'exact']]);
    if (curriculum.subpattern) subpatterns = [curriculum.subpattern];
    stats.curriculumOverlap++;
  } else {
    patternConfidence = resolveFromTags(topics);
    stats.contestOnly++;
  }

  const confident = [];
  const inferred = [];
  for (const [pattern, confidence] of patternConfidence) {
    (confidence === 'heuristic' ? inferred : confident).push(pattern);
  }
  confident.sort();
  inferred.sort();

  const best =
    patternConfidence.size === 0
      ? 'unmapped'
      : [...patternConfidence.values()].reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
  stats.mapping[best]++;

  if (cat.paid) stats.premium++;
  stats.byIndex[r.problemIndex] = (stats.byIndex[r.problemIndex] ?? 0) + 1;
  const type = contestMatch ? contestMatch[1] : 'unknown';
  stats.byType[type] = (stats.byType[type] ?? 0) + 1;

  records.push({
    slug: r.slug,
    frontendId: r.frontendId,
    title: r.title,
    difficulty: cat.difficulty,
    contestRating: Math.round(r.rating),
    contestSlug: r.contestSlug,
    contestType: type,
    contestNumber: contestMatch ? Number(contestMatch[2]) : null,
    problemIndex: Number(indexMatch ? indexMatch[1] : 0),
    topics,
    patterns: confident,
    inferredPatterns: inferred,
    subpatterns,
    mappingConfidence: best,
    premium: !!cat.paid,
    curriculumQuestionId: curriculum ? curriculum.id : null,
  });
}

// The curriculum must come out the other side untouched (directive §60). This does not modify
// questions.json — it proves nothing here could have.
const overlapIds = new Set(records.filter((r) => r.curriculumQuestionId !== null).map((r) => r.curriculumQuestionId));
for (const id of overlapIds) {
  if (!questions.some((q) => q.id === id)) fail(`Bridged curriculum id ${id} does not exist in questions.json`);
}

if (errors.length > 0) {
  console.error(`\nFAILED — ${errors.length} error${errors.length === 1 ? '' : 's'}:\n`);
  for (const e of errors.slice(0, 40)) console.error(`  ${e}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}

/* ── Encode ──────────────────────────────────────────────────────────────────────────────── */

// Dictionary-encoded columnar. Measured: the naive object form is 1,232.9 kB, this is 322.1 kB
// (-74%). That difference decides whether the dataset can ship at all — the app chunk has ~20 kB
// of headroom and data-curriculum is 386 kB, so a 1.2 MB sibling was never an option.
// `url`, contest type and contest number are derivable from the slug and contest slug, so they
// are computed at load in src/data/contestLibrary.ts rather than stored 2,561 times.
const dict = (values) => {
  const list = [...new Set(values)];
  return [list, new Map(list.map((v, i) => [v, i]))];
};
const [topicDict, topicIdx] = dict(records.flatMap((r) => r.topics));
const [contestDict, contestIdx] = dict(records.map((r) => r.contestSlug));
const [patternDict, patternIdx] = dict(records.flatMap((r) => [...r.patterns, ...r.inferredPatterns]));
const [subpatternDict, subpatternIdx] = dict(records.flatMap((r) => r.subpatterns));

const CONFIDENCE_CODE = { unmapped: 0, heuristic: 1, strong: 2, exact: 3 };
const DIFFICULTY_CODE = { easy: 0, medium: 1, hard: 2 };

const rows = records.map((r) => [
  r.slug,
  r.frontendId,
  r.title,
  DIFFICULTY_CODE[r.difficulty],
  r.contestRating,
  contestIdx.get(r.contestSlug),
  r.problemIndex,
  r.topics.map((t) => topicIdx.get(t)),
  r.patterns.map((p) => patternIdx.get(p)),
  r.inferredPatterns.map((p) => patternIdx.get(p)),
  r.subpatterns.map((s) => subpatternIdx.get(s)),
  CONFIDENCE_CODE[r.mappingConfidence],
  r.premium ? 1 : 0,
  r.curriculumQuestionId,
]);

const out = {
  _readme:
    'GENERATED by scripts/generate-contest-library.mjs — never hand-edit. Dictionary-encoded to ' +
    'keep the chunk shippable. Row layout: [slug, frontendId, title, difficultyCode(0=easy,1=medium,' +
    '2=hard), contestRating, contestIdx, problemIndex, topicIdxs, patternIdxs, inferredPatternIdxs, ' +
    'subpatternIdxs, confidenceCode(0=unmapped,1=heuristic,2=strong,3=exact), premium, ' +
    'curriculumQuestionId|null]. Decode via src/data/contestLibrary.ts.',
  provenance: {
    ratingSource: 'zerotrac',
    ratingSourceUrl: zerotrac.source,
    ratingFetchedAt: zerotrac.fetchedAt,
    metadataSource: 'leetcode',
    metadataFetchedAt: topicsSnapshot.fetchedAt,
    catalogFetchedAt: catalog.fetchedAt,
    generatedAt: new Date().toISOString(),
    ratingNote:
      'Estimated contest difficulty from ZeroTrac. Useful for relative comparison; not an official LeetCode rating.',
  },
  dictionaries: {
    topics: topicDict,
    contests: contestDict,
    patterns: patternDict,
    subpatterns: subpatternDict,
  },
  total: rows.length,
  problems: rows,
};

writeFileSync(join(root, 'src', 'data', 'contestLibrary.json'), JSON.stringify(out) + '\n');

/* ── Audit report (directive §37) ────────────────────────────────────────────────────────── */

const bytes = JSON.stringify(out).length;
console.log('\nContest ingestion complete');
console.log(`  zerotrac fetched ${zerotrac.fetchedAt}`);
console.log(`  leetcode fetched ${topicsSnapshot.fetchedAt}\n`);
console.log(`Problems discovered:      ${stats.ratingRecords.toLocaleString()}`);
console.log(`Rating records:           ${stats.ratingRecords.toLocaleString()}`);
console.log(`Catalog matched by slug:  ${stats.catalogMatched.toLocaleString()}   unmatched: ${stats.ratingRecords - stats.catalogMatched}`);
console.log(`Topic metadata matched:   ${stats.topicsMatched.toLocaleString()}   with tags: ${stats.withTopicTags.toLocaleString()}`);
console.log('');
console.log('AICM mappings:');
for (const k of ['exact', 'strong', 'heuristic', 'unmapped']) {
  const n = stats.mapping[k];
  console.log(`  ${k.padEnd(10)} ${String(n).padStart(5)}  (${((n / rows.length) * 100).toFixed(1)}%)`);
}
console.log('');
console.log('Curriculum overlap:');
console.log(`  existing     ${String(stats.curriculumOverlap).padStart(5)}  (inherit the hand-verified pattern)`);
console.log(`  contest-only ${String(stats.contestOnly).padStart(5)}  (classified from tags)`);
console.log('');
console.log(`Contest types:  ${Object.entries(stats.byType).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`Problem index:  ${Object.entries(stats.byIndex).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`Premium:        ${stats.premium}`);
console.log('');
console.log(`Encoded size:   ${(bytes / 1024).toFixed(1)} kB`);
console.log(`Invalid records: 0`);
if (warnings.length > 0) {
  console.log(`\nWarnings: ${warnings.length}`);
  for (const w of warnings.slice(0, 12)) console.log(`  ${w}`);
  if (warnings.length > 12) console.log(`  ... and ${warnings.length - 12} more`);
}
