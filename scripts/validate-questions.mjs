// Standing data-quality gate for the generated question dataset. Run: npm run validate:data
// Fully offline — verifies src/data/questions.json against the committed LeetCode catalog
// snapshot. Exit code 1 on any violation, so it can gate CI or a pre-commit flow.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const questions = JSON.parse(readFileSync(join(root, 'src', 'data', 'questions.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'leetcode-catalog.json'), 'utf8'));
const catalogBySlug = new Map(catalog.problems.map((p) => [p.slug, p]));
// `leetcodeId` is the FRONTEND id — the number LeetCode displays — and the catalog snapshot does
// not carry it. The topics snapshot does, so the identity check joins both on SLUG. This
// validator previously resolved `leetcodeId` against the catalog's INTERNAL `question_id` and so
// asserted the very mis-identification it was meant to catch.
const topicsSnapshot = JSON.parse(
  readFileSync(join(root, 'scripts', 'data', 'leetcode-topics.json'), 'utf8'),
);
const frontendIdBySlug = new Map(topicsSnapshot.problems.map((p) => [p.slug, p.frontendId]));

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

  // The mapping must point at the exact catalog problem, resolved by SLUG — the URL's slug is
  // the identity, and it must be a slug the catalog actually contains (never a guessed or
  // similar one). Then `leetcodeId` must be that same slug's FRONTEND id.
  const slug = q.url.slice('https://leetcode.com/problems/'.length, -1);
  if (!catalogBySlug.has(slug)) {
    fail(`#${q.id}: url slug "${slug}" is not in the catalog snapshot`);
    continue;
  }
  const frontendId = frontendIdBySlug.get(slug);
  if (frontendId === undefined) {
    fail(`#${q.id}: slug "${slug}" is in the catalog but not in the topics snapshot — the two have drifted`);
  } else if (q.leetcodeId !== frontendId) {
    // The ID trap: the internal question_id and the displayed frontend id diverge past ~1000, so
    // a wrong value here is silent — the links still work, and only the number a learner would
    // recognise is wrong.
    fail(`#${q.id}: leetcodeId ${q.leetcodeId} is not the frontend id ${frontendId} for "${slug}"`);
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

// --- ML implementation tracks & project ladder (mlTracks.json / mlProjects.json) --------
// The two rules worth restating offline are the ones that make a claim about something outside
// these files: a `weekId` must be a real week of the AI/ML course or an explicit null (many are
// null on purpose — the 26-week course has no classical-ML week), and every prereq must resolve
// to a real track with no cycle anywhere in the graph. Everything else here is shape, plus the
// two content gates: five stages with 2+ failure modes, and a baseline that is either a stated
// figure or a null carrying the note that says who must establish it.
const mlTracks = JSON.parse(readFileSync(join(root, 'src', 'data', 'mlTracks.json'), 'utf8'));
const mlProjects = JSON.parse(readFileSync(join(root, 'src', 'data', 'mlProjects.json'), 'utf8'));
const courseSource = readFileSync(join(root, 'src', 'data', 'aimlCourse.ts'), 'utf8');
const weekIds = new Set([...courseSource.matchAll(/\bid: '([^']+)'/g)].map((m) => m[1]));

const ML_STAGES = ['math', 'scratch', 'library', 'experiment', 'failure'];
const ML_TIERS = new Set([
  'beginner', 'intermediate', 'advanced', 'deep-learning', 'nlp', 'modern-ai', 'production',
]);
const MIN_FAILURES = 2;
const MIN_WHY_CHARS = 120;
const MIN_NULL_BASELINE_NOTE = 120;
const stated = (v) => typeof v === 'string' && v.trim() !== '';

const trackIds = new Set();
for (const t of mlTracks) {
  const where = `track "${t.id}"`;
  if (trackIds.has(t.id)) fail(`${where}: duplicate id`);
  trackIds.add(t.id);
  if (!stated(t.title) || !stated(t.tests)) fail(`${where}: missing title or tests sentence`);
  if (!Number.isInteger(t.minutes) || t.minutes <= 0) fail(`${where}: minutes must be a positive integer`);
  if (t.weekId !== null && !weekIds.has(t.weekId)) {
    fail(`${where}: weekId "${t.weekId}" is not a course week (null is the honest value where the course has none)`);
  }
  for (const stage of ML_STAGES) {
    const value = t.stages?.[stage];
    if (value === undefined) fail(`${where}: missing the "${stage}" stage`);
    else if (stage !== 'failure' && !stated(value.summary)) fail(`${where}: ${stage} stage has no summary`);
  }
  const failures = t.stages?.failure ?? [];
  if (!Array.isArray(failures) || failures.length < MIN_FAILURES) {
    fail(`${where}: ${failures.length ?? 0} failure mode(s) — at least ${MIN_FAILURES} are required`);
  } else {
    for (const [i, f] of failures.entries()) {
      if (!stated(f.symptom) || !stated(f.cause) || !stated(f.fix)) {
        fail(`${where}: failure[${i}] needs a symptom, a cause and a fix`);
      }
    }
  }
}
// Prereq resolution and acyclicity, over the emitted graph.
const trackEdges = new Map();
for (const t of mlTracks) {
  const prereqs = Array.isArray(t.prereqs) ? t.prereqs : [];
  for (const p of prereqs) if (!trackIds.has(p)) fail(`track "${t.id}": prereq "${p}" is not a track`);
  trackEdges.set(t.id, prereqs.filter((p) => trackIds.has(p)));
}
{
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    const seen = state.get(id);
    if (seen === 'done') return;
    if (seen === 'open') {
      fail(`ml tracks: prereq cycle ${[...stack.slice(stack.indexOf(id)), id].join(' → ')}`);
      return;
    }
    state.set(id, 'open');
    stack.push(id);
    for (const next of trackEdges.get(id) ?? []) visit(next);
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of trackEdges.keys()) visit(id);
}

const projectIds = new Set();
for (const p of mlProjects) {
  const where = `project "${p.id}"`;
  if (projectIds.has(p.id)) fail(`${where}: duplicate id`);
  projectIds.add(p.id);
  if (!ML_TIERS.has(p.tier)) fail(`${where}: unknown tier "${p.tier}"`);
  if (!Number.isInteger(p.order) || p.order < 1) fail(`${where}: order must be a positive integer`);
  if (!stated(p.title) || !stated(p.objective)) fail(`${where}: missing title or objective`);
  if (!ISO_DATE.test(p.dataset?.checkedAt ?? '')) fail(`${where}: dataset.checkedAt must be yyyy-MM-dd`);
  if (!stated(p.dataset?.source)) fail(`${where}: dataset.source must say where the data comes from`);
  // The baseline is the whole point of the file: a project without one is a tutorial.
  if (!stated(p.baseline?.model)) fail(`${where}: baseline.model must name the dumb model`);
  if (p.baseline?.score === null) {
    if (!stated(p.baseline.note) || p.baseline.note.trim().length < MIN_NULL_BASELINE_NOTE) {
      fail(`${where}: a null baseline.score must carry a note naming who establishes it`);
    }
  } else if (!stated(p.baseline?.score) || !/\d/.test(p.baseline.score)) {
    fail(`${where}: baseline.score must be a figure or an explicit null`);
  }
  if (!stated(p.metric?.name)) fail(`${where}: metric.name is empty`);
  if (!stated(p.metric?.why) || p.metric.why.trim().length < MIN_WHY_CHARS) {
    fail(`${where}: metric.why must argue against the obvious alternative (${MIN_WHY_CHARS}+ chars)`);
  }
  if (!Array.isArray(p.experiments) || p.experiments.length < 2) fail(`${where}: needs 2+ experiments`);
  if (!Array.isArray(p.errorAnalysis) || p.errorAnalysis.length < 3) fail(`${where}: needs 3+ error-analysis prompts`);
  if (!Array.isArray(p.retrospective) || p.retrospective.length < 3) fail(`${where}: needs 3+ retrospective questions`);
  if (p.deployment !== null && !stated(p.deployment)) fail(`${where}: deployment must be a string or an explicit null`);
  if (!Number.isInteger(p.hours) || p.hours <= 0) fail(`${where}: hours must be a positive integer`);
  for (const t of p.prereqTracks ?? []) {
    if (!trackIds.has(t)) fail(`${where}: prereqTrack "${t}" is not a track`);
  }
  if (p.weekId !== null && !weekIds.has(p.weekId)) {
    fail(`${where}: weekId "${p.weekId}" is not a course week`);
  }
  // The schema must never grow an answer key — the retrospective questions are the learner's.
  for (const forbidden of ['solution', 'walkthrough', 'answers']) {
    if (forbidden in p) fail(`${where}: shipped answers are not supported ("${forbidden}")`);
  }
}

// --- Contest library (V13) --------------------------------------------------------------
// Validates the GENERATED artifact, independently of the generator that produced it. The split
// matters: generate-contest-library.mjs validates its SOURCES and fails the ingest, while this
// gate re-checks the committed output, so a hand-edit, a bad merge, or a stale artifact is caught
// by a command anyone can run offline. Same relationship validate:data already has with
// questions.json.
const contestLibrary = JSON.parse(readFileSync(join(root, 'src', 'data', 'contestLibrary.json'), 'utf8'));
const CL_DIFFICULTY = ['easy', 'medium', 'hard'];
const CL_CONFIDENCE = ['unmapped', 'heuristic', 'strong', 'exact'];
const CL_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CL_CONTEST = /^(weekly|biweekly)-contest-\d+$/;

{
  const d = contestLibrary.dictionaries ?? {};
  if (!Array.isArray(contestLibrary.problems)) fail('contest library: `problems` is not an array');
  if (contestLibrary.total !== contestLibrary.problems.length) {
    fail(`contest library: total ${contestLibrary.total} disagrees with ${contestLibrary.problems.length} rows`);
  }
  for (const key of ['topics', 'contests', 'patterns', 'subpatterns']) {
    if (!Array.isArray(d[key])) fail(`contest library: dictionary "${key}" missing`);
  }
  for (const key of ['ratingSource', 'metadataSource', 'generatedAt', 'ratingFetchedAt']) {
    if (!stated(contestLibrary.provenance?.[key])) fail(`contest library: provenance.${key} is missing`);
  }
  // Nothing may present ZeroTrac's estimate as an official LeetCode figure.
  if (!/not an official LeetCode rating/i.test(contestLibrary.provenance?.ratingNote ?? '')) {
    fail('contest library: provenance.ratingNote must state that the rating is not official');
  }
  for (const p of d.patterns ?? []) {
    if (!VALID_PATTERNS.has(p)) fail(`contest library: pattern dictionary holds unknown id "${p}"`);
  }

  const seenSlug = new Set();
  const seenPosition = new Set();
  const questionIds = new Set(questions.map((q) => q.id));
  const questionSlugById = new Map(
    questions.filter((q) => q.url).map((q) => [q.id, q.url.split('/problems/')[1].replace(/\//g, '')]),
  );
  let bridged = 0;
  let filterable = 0;

  for (const row of contestLibrary.problems ?? []) {
    if (!Array.isArray(row) || row.length !== 14) {
      fail(`contest library: malformed row (expected 14 columns, got ${row?.length})`);
      continue;
    }
    const [slug, frontendId, title, diff, rating, contestIdx, index, topics, pats, inferred, subs, conf, premium, currId] = row;
    const where = `contest library ${slug}`;

    if (typeof slug !== 'string' || !CL_SLUG.test(slug)) fail(`${where}: malformed slug`);
    if (seenSlug.has(slug)) fail(`${where}: duplicate slug`);
    seenSlug.add(slug);
    if (!Number.isInteger(frontendId) || frontendId <= 0) fail(`${where}: malformed frontend id`);
    if (!stated(title)) fail(`${where}: missing title`);
    if (CL_DIFFICULTY[diff] === undefined) fail(`${where}: invalid difficulty code ${diff}`);
    if (!Number.isFinite(rating) || rating < 800 || rating > 4000) fail(`${where}: rating ${rating} out of range`);
    if (!Number.isInteger(index) || index < 1 || index > 5) fail(`${where}: impossible problem index ${index}`);

    const contestSlug = d.contests?.[contestIdx];
    if (typeof contestSlug !== 'string' || !CL_CONTEST.test(contestSlug)) {
      fail(`${where}: invalid contest slug "${contestSlug}"`);
    } else {
      const position = `${contestSlug}|${index}`;
      if (seenPosition.has(position)) fail(`${where}: duplicate contest position ${position}`);
      seenPosition.add(position);
    }

    for (const i of topics ?? []) if (d.topics?.[i] === undefined) fail(`${where}: topic index ${i} out of range`);
    for (const i of subs ?? []) if (d.subpatterns?.[i] === undefined) fail(`${where}: subpattern index ${i} out of range`);
    for (const i of [...(pats ?? []), ...(inferred ?? [])]) {
      if (d.patterns?.[i] === undefined) fail(`${where}: pattern index ${i} out of range`);
    }
    if (CL_CONFIDENCE[conf] === undefined) fail(`${where}: invalid confidence code ${conf}`);
    if (premium !== 0 && premium !== 1) fail(`${where}: premium must be 0 or 1`);

    // The honesty invariants, restated here so they hold on the artifact and not merely in the
    // generator that wrote it: unmapped claims nothing, heuristic never becomes filterable, and a
    // pattern is never simultaneously confident and inferred.
    const confidence = CL_CONFIDENCE[conf];
    if (confidence === 'unmapped' && ((pats ?? []).length > 0 || (inferred ?? []).length > 0)) {
      fail(`${where}: marked unmapped but carries patterns`);
    }
    if (confidence === 'heuristic' && (pats ?? []).length > 0) {
      fail(`${where}: heuristic mappings must not enter the filterable set`);
    }
    if ((pats ?? []).length > 0 && !['exact', 'strong'].includes(confidence)) {
      fail(`${where}: filterable patterns require exact or strong confidence`);
    }
    const confidentSet = new Set(pats ?? []);
    for (const i of inferred ?? []) {
      if (confidentSet.has(i)) fail(`${where}: pattern "${d.patterns[i]}" is both confident and inferred`);
    }
    if ((pats ?? []).length > 0) filterable++;

    // The identity bridge must point at a real curriculum question, by matching slug — never by a
    // number. ZeroTrac's id is LeetCode's frontend id; questions.json stores the internal one.
    if (currId !== null) {
      bridged++;
      if (!questionIds.has(currId)) fail(`${where}: bridges to curriculum id ${currId}, which does not exist`);
      else if (questionSlugById.get(currId) !== slug) {
        fail(`${where}: bridges to curriculum #${currId}, whose slug is "${questionSlugById.get(currId)}"`);
      }
    } else if ((subs ?? []).length > 0) {
      fail(`${where}: sub-patterns are only inheritable from a curriculum question`);
    }
  }

  contestLibrary._stats = { bridged, filterable };
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
console.log(
  `ml tracks: ${mlTracks.length} × 5 stages, ` +
    `${mlTracks.reduce((s, t) => s + (t.stages.failure?.length ?? 0), 0)} failure modes, ` +
    `${mlTracks.filter((t) => t.weekId === null).length} with no course week (stated, not guessed)`,
);
console.log(
  `ml projects: ${mlProjects.length} across ${new Set(mlProjects.map((p) => p.tier)).size} tiers, ` +
    `${mlProjects.filter((p) => p.baseline.score !== null).length} baselines stated / ` +
    `${mlProjects.filter((p) => p.baseline.score === null).length} for the learner to establish`,
);
console.log(
  `contest library: ${contestLibrary.total} rated problems, ` +
    `${contestLibrary._stats.filterable} with a filterable AICM pattern, ` +
    `${contestLibrary._stats.bridged} bridged to curriculum questions`,
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
