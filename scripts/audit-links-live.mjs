// LIVE external-link audit: asks LeetCode's GraphQL API, slug by slug, whether every linked
// question's URL still resolves to the exact problem we claim it is (id must match, title
// reported for eyeballing). Run: npm run audit:links   (needs network — deliberately NOT part
// of the offline test suite or validate:data; see the offline-first rule in CLAUDE.md).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const questions = JSON.parse(readFileSync(join(root, 'src', 'data', 'questions.json'), 'utf8'));
const linked = questions.filter((q) => q.url !== undefined);

const DELAY_MS = 120; // polite pacing — ~1 minute for the full sweep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(slug) {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: 'https://leetcode.com' },
    body: JSON.stringify({
      query: 'query q($slug: String!) { question(titleSlug: $slug) { questionId title isPaidOnly } }',
      variables: { slug },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data?.question ?? null;
}

let ok = 0;
const failures = [];
for (const [i, q] of linked.entries()) {
  const slug = q.url.match(/problems\/([a-z0-9-]+)\//)[1];
  try {
    const live = await lookup(slug);
    if (live === null) {
      failures.push(`#${q.id} ${q.title}: slug "${slug}" no longer exists`);
    } else if (Number(live.questionId) !== q.leetcodeId) {
      failures.push(`#${q.id} ${q.title}: slug "${slug}" now resolves to LC #${live.questionId} "${live.title}"`);
    } else if (Boolean(q.premium) !== live.isPaidOnly) {
      failures.push(`#${q.id} ${q.title}: premium flag drift (dataset ${Boolean(q.premium)}, live ${live.isPaidOnly})`);
    } else {
      ok++;
    }
  } catch (e) {
    failures.push(`#${q.id} ${q.title}: lookup failed (${e.message})`);
  }
  if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${linked.length} checked`);
  await sleep(DELAY_MS);
}

console.log(`\nverified: ${ok}/${linked.length}`);
if (failures.length > 0) {
  console.error(`FAILED — ${failures.length} mapping(s) need attention:`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('OK — every external mapping resolves to its exact claimed problem.');
