// Snapshots LeetCode's topic tags (and the canonical metadata beside them) into
// scripts/data/leetcode-topics.json. Run manually (needs network):
//   node scripts/fetch-leetcode-topics.mjs
//
// WHY A SECOND LEETCODE FETCHER. fetch-leetcode-catalog.mjs reads /api/problems/all/, which serves
// id, title, slug, difficulty and paid_only — and no topic tags at all. Tags only exist on the
// GraphQL problemset query, so the contest library's `leetcodeTopics` needs its own snapshot. The
// two are deliberately separate files rather than one merged fetch: the catalog is the identity
// spine the 539-question generator has depended on since v1 and its shape must not move for a
// feature that came later.
//
// This fetcher also captures `questionFrontendId` — the number LeetCode DISPLAYS — which the
// catalog does not carry (it stores the internal `question_id`). Measured 2026-08-19: the frontend
// id agrees with ZeroTrac's `ID` for 2561/2561 records, so this snapshot is the second independent
// source that makes the frontend id trustworthy.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENDPOINT = 'https://leetcode.com/graphql';
const QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { questionFrontendId title titleSlug difficulty isPaidOnly topicTags { name slug } }
  }
}`;

const PAGE = 100;
/** Courtesy delay between pages. This is someone else's server and the whole run is ~41 requests. */
const THROTTLE_MS = 350;
const MAX_ATTEMPTS = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(skip) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        referer: 'https://leetcode.com/problemset/',
      },
      body: JSON.stringify({ query: QUERY, variables: { categorySlug: '', limit: PAGE, skip, filters: {} } }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 200)}`);
      return json.data.problemsetQuestionList;
    }
    // Backs off rather than hammering. A partial snapshot is worse than no snapshot, so the
    // last failed attempt exits non-zero and leaves the committed file untouched.
    console.error(`  skip=${skip}: HTTP ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await sleep(2000 * attempt);
  }
  throw new Error(`Gave up at skip=${skip} after ${MAX_ATTEMPTS} attempts`);
}

const problems = [];
let skip = 0;
let total = Infinity;

try {
  while (skip < total) {
    const page = await fetchPage(skip);
    total = page.total;
    for (const q of page.questions) {
      problems.push({
        frontendId: Number(q.questionFrontendId),
        title: q.title,
        slug: q.titleSlug,
        difficulty: q.difficulty.toLowerCase(),
        paid: q.isPaidOnly,
        topics: q.topicTags.map((t) => t.name),
      });
    }
    skip += PAGE;
    if (skip % 1000 === 0) console.error(`  ${problems.length}/${total}`);
    await sleep(THROTTLE_MS);
  }
} catch (err) {
  console.error(`Topic fetch failed: ${err.message}`);
  console.error('The committed snapshot was NOT modified.');
  process.exit(1);
}

problems.sort((a, b) => a.frontendId - b.frontendId);

const snapshot = {
  source: `${ENDPOINT} (problemsetQuestionList)`,
  note:
    'Topic tags are LeetCode\'s own taxonomy and are kept verbatim. They are NOT AICM patterns — ' +
    'the mapping between them is hand-verified in scripts/data/contest-pattern-map.json.',
  fetchedAt: new Date().toISOString(),
  total: problems.length,
  problems,
};

mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
writeFileSync(
  join(root, 'scripts', 'data', 'leetcode-topics.json'),
  JSON.stringify(snapshot, null, 1) + '\n',
);
const tagged = problems.filter((p) => p.topics.length > 0).length;
console.log(
  `Snapshot written: ${problems.length} problems, ${tagged} with at least one topic tag ` +
    `(fetched ${snapshot.fetchedAt})`,
);
