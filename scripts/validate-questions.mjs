// Standing data-quality gate for the generated question dataset. Run: npm run validate:data
// Fully offline — verifies src/data/questions.json against the committed LeetCode catalog
// snapshot. Exit code 1 on any violation, so it can gate CI or a pre-commit flow.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const questions = JSON.parse(readFileSync(join(root, 'src', 'data', 'questions.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'leetcode-catalog.json'), 'utf8'));
const catalogById = new Map(catalog.problems.map((p) => [p.id, p]));

// difficulty -> [min, max] authored estimate. Estimates are written per question, so the gate is
// the band, plus a spread check below — a band collapsed to one value would pass a range test
// while silently reverting to the flat per-difficulty table this replaced.
const MINUTE_BANDS = { easy: [8, 20], medium: [20, 35], hard: [35, 60] };
const MIN_DISTINCT_ESTIMATES = 4;
const VALID_TYPES = new Set([
  'foundation', 'recognition', 'implementation', 'optimization', 'variant', 'design',
]);
const TESTS_WORDS = [8, 45];
const EVIDENCE_TIERS = new Set(['topics', 'categories', 'avoids-puzzles']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PATTERNS = new Set([
  'two-pointers', 'fast-slow-pointers', 'sliding-window', 'intervals', 'linked-list-inplace',
  'two-heaps', 'k-way-merge', 'top-k-elements', 'modified-binary-search', 'subsets', 'greedy',
  'backtracking', 'dynamic-programming', 'cyclic-sort', 'topological-sort', 'sort-search',
  'matrices', 'stacks', 'graphs', 'tree-dfs', 'tree-bfs', 'trie', 'hash-maps', 'tracking',
  'union-find', 'custom-data-structures', 'bitwise-manipulation', 'math-geometry',
]);
const URL_SHAPE = /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/;

const errors = [];
const fail = (msg) => errors.push(msg);

// --- Identity & ordering ---------------------------------------------------------------
if (questions.length !== 539) fail(`expected 539 questions, found ${questions.length}`);
questions.forEach((q, i) => {
  if (q.id !== i + 1) fail(`#${q.id} at index ${i}: ids must be contiguous 1..N in roadmap order`);
});
const titles = new Set();
for (const q of questions) {
  if (typeof q.title !== 'string' || q.title.trim() === '') fail(`#${q.id}: empty title`);
  if (titles.has(q.title)) fail(`#${q.id}: duplicate title "${q.title}"`);
  titles.add(q.title);
}

// --- Metadata --------------------------------------------------------------------------
const estimatesByDifficulty = { easy: new Set(), medium: new Set(), hard: new Set() };
for (const q of questions) {
  if (!(q.difficulty in MINUTE_BANDS)) {
    fail(`#${q.id}: invalid difficulty "${q.difficulty}"`);
  } else {
    const [lo, hi] = MINUTE_BANDS[q.difficulty];
    if (!Number.isInteger(q.estimatedTime) || q.estimatedTime < lo || q.estimatedTime > hi) {
      fail(`#${q.id}: estimatedTime ${q.estimatedTime} outside the ${q.difficulty} band ${lo}..${hi}`);
    } else {
      estimatesByDifficulty[q.difficulty].add(q.estimatedTime);
    }
  }
  if (!VALID_PATTERNS.has(q.pattern)) fail(`#${q.id}: unknown pattern "${q.pattern}"`);

  // --- Question intelligence ---
  if (!VALID_TYPES.has(q.type)) fail(`#${q.id}: invalid question type "${q.type}"`);
  if (typeof q.tests !== 'string' || q.tests.trim() === '') {
    fail(`#${q.id}: missing the "what this tests" sentence`);
  } else {
    const words = q.tests.trim().split(/\s+/).length;
    if (words < TESTS_WORDS[0] || words > TESTS_WORDS[1]) {
      fail(`#${q.id}: tests sentence is ${words} words, outside ${TESTS_WORDS[0]}..${TESTS_WORDS[1]}`);
    }
    if (/^(this (problem|question)|the problem)/i.test(q.tests.trim())) {
      fail(`#${q.id}: tests sentence restates the prompt instead of naming the skill`);
    }
  }
  if (q.complexity !== undefined) {
    for (const axis of ['time', 'space']) {
      const value = q.complexity[axis];
      if (typeof value !== 'string' || !value.startsWith('O(')) {
        fail(`#${q.id}: complexity.${axis} "${value}" is not Big-O form`);
      }
    }
    if (Object.keys(q.complexity).length !== 2) fail(`#${q.id}: complexity must carry exactly time and space`);
  }
}
for (const [difficulty, values] of Object.entries(estimatesByDifficulty)) {
  if (values.size > 0 && values.size < MIN_DISTINCT_ESTIMATES) {
    fail(`${difficulty} estimates collapsed to ${values.size} distinct value(s) — the band carries no information`);
  }
}

// --- External identity -----------------------------------------------------------------
const seenUrls = new Map();
const seenLeetcodeIds = new Map();
let linked = 0;
for (const q of questions) {
  const hasUrl = q.url !== undefined;
  const hasId = q.leetcodeId !== undefined;
  if (hasUrl !== hasId) fail(`#${q.id}: url and leetcodeId must be present together`);
  if (!hasUrl) continue;
  linked++;

  if (!URL_SHAPE.test(q.url)) fail(`#${q.id}: malformed url "${q.url}"`);
  if (seenUrls.has(q.url)) fail(`#${q.id}: url duplicates #${seenUrls.get(q.url)} (${q.url})`);
  seenUrls.set(q.url, q.id);
  if (seenLeetcodeIds.has(q.leetcodeId)) {
    fail(`#${q.id}: leetcodeId ${q.leetcodeId} duplicates #${seenLeetcodeIds.get(q.leetcodeId)}`);
  }
  seenLeetcodeIds.set(q.leetcodeId, q.id);

  // The mapping must point at the exact catalog problem: id exists, and the slug in the URL
  // is that problem's own slug (never a guessed or similar one).
  const problem = catalogById.get(q.leetcodeId);
  if (!problem) {
    fail(`#${q.id}: leetcodeId ${q.leetcodeId} not in the catalog snapshot`);
  } else if (q.url !== `https://leetcode.com/problems/${problem.slug}/`) {
    fail(`#${q.id}: url slug does not match catalog slug "${problem.slug}" for leetcodeId ${q.leetcodeId}`);
  }
}

// --- Curriculum intelligence (families.json / subpatterns.json) ------------------------
const families = JSON.parse(readFileSync(join(root, 'src', 'data', 'families.json'), 'utf8'));
const subpatterns = JSON.parse(readFileSync(join(root, 'src', 'data', 'subpatterns.json'), 'utf8'));
const qById = new Map(questions.map((q) => [q.id, q]));
const FAMILY_ROLES = new Set(['canonical', 'warmup', 'standard', 'variant', 'stretch']);

const familyIds = new Set();
const questionToFamily = new Map();
for (const f of families) {
  if (familyIds.has(f.id)) fail(`family "${f.id}": duplicate id`);
  familyIds.add(f.id);
  if (!VALID_PATTERNS.has(f.pattern)) fail(`family "${f.id}": unknown pattern "${f.pattern}"`);
  if (f.members.length < 3) fail(`family "${f.id}": fewer than 3 members`);
  let canonicals = 0;
  for (const m of f.members) {
    if (!FAMILY_ROLES.has(m.role)) fail(`family "${f.id}": invalid role "${m.role}"`);
    if (m.role === 'canonical') canonicals++;
    const q = qById.get(m.questionId);
    if (!q) fail(`family "${f.id}": member id ${m.questionId} not in questions.json`);
    // Members may live in a sibling pattern (deliberate cross-pattern transfer links),
    // but the back-reference must always hold.
    else if (q.familyId !== f.id) fail(`family "${f.id}": #${q.id} carries familyId "${q.familyId}"`);
    if (questionToFamily.has(m.questionId)) {
      fail(`family "${f.id}": #${m.questionId} already in "${questionToFamily.get(m.questionId)}"`);
    }
    questionToFamily.set(m.questionId, f.id);
  }
  if (canonicals !== 1) fail(`family "${f.id}": needs exactly one canonical, found ${canonicals}`);
}
for (const q of questions) {
  if (q.familyId !== undefined && questionToFamily.get(q.id) !== q.familyId) {
    fail(`#${q.id}: familyId "${q.familyId}" not backed by families.json`);
  }
}

const questionToSubpattern = new Map();
for (const [patternId, groups] of Object.entries(subpatterns)) {
  if (!VALID_PATTERNS.has(patternId)) fail(`subpatterns: unknown pattern "${patternId}"`);
  const ids = new Set();
  for (const g of groups) {
    if (ids.has(g.id)) fail(`subpattern "${patternId}/${g.id}": duplicate id`);
    ids.add(g.id);
    for (const qid of g.questionIds) {
      const q = qById.get(qid);
      if (!q) fail(`subpattern "${patternId}/${g.id}": id ${qid} not in questions.json`);
      else {
        if (q.pattern !== patternId) fail(`subpattern "${patternId}/${g.id}": #${qid} is in pattern "${q.pattern}"`);
        if (q.subpattern !== g.id) fail(`subpattern "${patternId}/${g.id}": #${qid} carries subpattern "${q.subpattern}"`);
      }
      if (questionToSubpattern.has(qid)) fail(`subpattern "${patternId}/${g.id}": #${qid} already grouped`);
      questionToSubpattern.set(qid, g.id);
    }
  }
}
for (const q of questions) {
  if (q.subpattern !== undefined && questionToSubpattern.get(q.id) !== q.subpattern) {
    fail(`#${q.id}: subpattern "${q.subpattern}" not backed by subpatterns.json`);
  }
}

// --- Company evidence (companies.json) -------------------------------------------------
// The gate that matters here is the one preventing over-claiming: pattern-level relevance may
// only exist where the company's own page actually enumerates topics. Everything else is shape.
const companies = JSON.parse(readFileSync(join(root, 'src', 'data', 'companies.json'), 'utf8'));
const companyIds = new Set();
for (const c of companies) {
  const where = `company "${c.id}"`;
  if (companyIds.has(c.id)) fail(`${where}: duplicate id`);
  companyIds.add(c.id);
  if (typeof c.name !== 'string' || c.name.trim() === '') fail(`${where}: empty name`);
  if (typeof c.url !== 'string' || !c.url.startsWith('https://')) fail(`${where}: url must be https`);
  if (!ISO_DATE.test(c.checkedAt ?? '')) fail(`${where}: checkedAt must be yyyy-MM-dd`);
  if (!EVIDENCE_TIERS.has(c.evidence)) fail(`${where}: unknown evidence tier "${c.evidence}"`);
  if (typeof c.quote !== 'string' || c.quote.trim().length < 40) {
    fail(`${where}: quote must be a real verbatim excerpt`);
  }
  if (!Array.isArray(c.patterns)) {
    fail(`${where}: patterns must be an array`);
    continue;
  }
  for (const p of c.patterns) if (!VALID_PATTERNS.has(p)) fail(`${where}: unknown pattern "${p}"`);
  if (new Set(c.patterns).size !== c.patterns.length) fail(`${where}: duplicate pattern`);
  if (c.evidence !== 'topics' && c.patterns.length > 0) {
    fail(`${where}: evidence "${c.evidence}" cannot support ${c.patterns.length} pattern claim(s)`);
  }
  if (c.evidence === 'topics' && c.patterns.length === 0) {
    fail(`${where}: evidence "topics" but no patterns mapped`);
  }
  // The schema must never grow a per-problem field. If one appears, this fails loudly.
  for (const forbidden of ['questions', 'questionIds', 'problems', 'leetcodeIds']) {
    if (forbidden in c) fail(`${where}: per-problem company claims are not supported ("${forbidden}")`);
  }
}

// --- Report ----------------------------------------------------------------------------
const unresolved = questions.filter((q) => q.url === undefined);
console.log(`questions: ${questions.length}, leetcode-linked: ${linked}, unresolved: ${unresolved.length}`);
console.log(
  `intelligence: ${questions.filter((q) => q.tests).length} capability sentences, ` +
    `${questions.filter((q) => q.complexity).length} with stated complexity`,
);
console.log(
  `companies: ${companies.length} first-party sources, ` +
    `${companies.filter((c) => c.evidence === 'topics').length} enumerating topics`,
);
if (unresolved.length > 0) {
  console.log('unresolved (declared not-on-leetcode in the generator):');
  for (const q of unresolved) console.log(`  #${q.id} ${q.title} [${q.pattern}]`);
}

if (errors.length > 0) {
  console.error(`\nFAILED — ${errors.length} violation(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('\nOK — dataset passes all structural and external-identity checks.');
