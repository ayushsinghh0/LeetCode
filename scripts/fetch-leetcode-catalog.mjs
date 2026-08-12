// Fetches LeetCode's canonical problem catalog and snapshots the fields the question
// generator needs into scripts/data/leetcode-catalog.json. Run manually (needs network):
//   node scripts/fetch-leetcode-catalog.mjs
// The snapshot is committed so the generator, validator, and tests stay fully offline —
// external verification is an engineering-time process, never a runtime dependency.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const res = await fetch('https://leetcode.com/api/problems/all/');
if (!res.ok) {
  console.error(`Catalog fetch failed: HTTP ${res.status}`);
  process.exit(1);
}
const payload = await res.json();

const LEVEL = { 1: 'easy', 2: 'medium', 3: 'hard' };

const problems = payload.stat_status_pairs
  .map((p) => ({
    id: p.stat.question_id,
    title: p.stat.question__title,
    slug: p.stat.question__title_slug,
    difficulty: LEVEL[p.difficulty.level],
    paid: p.paid_only,
  }))
  .sort((a, b) => a.id - b.id);

const snapshot = {
  source: 'https://leetcode.com/api/problems/all/',
  fetchedAt: new Date().toISOString(),
  total: problems.length,
  problems,
};

mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
writeFileSync(join(root, 'scripts', 'data', 'leetcode-catalog.json'), JSON.stringify(snapshot, null, 1) + '\n');
console.log(`Snapshot written: ${problems.length} problems (fetched ${snapshot.fetchedAt})`);
