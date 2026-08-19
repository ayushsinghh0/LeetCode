// Snapshots the ZeroTrac contest-rating dataset into scripts/data/zerotrac-ratings.json.
// Run manually (needs network):
//   node scripts/fetch-zerotrac-ratings.mjs
//
// The snapshot is committed so the contest-library generator, the validator and the tests stay
// fully offline — external verification is an engineering-time process, never a runtime
// dependency (the same rule fetch-leetcode-catalog.mjs follows).
//
// WHAT THIS SOURCE IS, precisely: ZeroTrac's rating is an ESTIMATED contest difficulty derived
// from contest performance data. It is not an official LeetCode number and nothing downstream may
// present it as one — the field is `contestRating` everywhere, never `officialRating`.
//
// The `ID` column is LeetCode's FRONTEND question id (the number a user sees on the problem page),
// which is NOT the internal `question_id` that leetcode-catalog.json stores. Measured 2026-08-19:
// they differ for 2561/2561 records. Nothing downstream may join these two sources on a number —
// the join key is the slug, and slug resolution covers 2561/2561.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The repository's own generated dataset, preferred over scraping the rendered page (directive
// §3). The GitHub Pages site fetches this exact file.
const SOURCE = 'https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/data.json';

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`ZeroTrac fetch failed: HTTP ${res.status}`);
  process.exit(1);
}
const payload = await res.json();

if (!Array.isArray(payload) || payload.length === 0) {
  console.error('ZeroTrac payload is not a non-empty array — refusing to write a snapshot.');
  process.exit(1);
}

// Fields kept are exactly the ones the generator consumes. `TitleZH`/`ContestID_zh` are dropped:
// the app is English-only and an unused 300 kB of Chinese titles in a committed snapshot is
// noise a reviewer has to scroll past.
const REQUIRED = ['Rating', 'ID', 'Title', 'TitleSlug', 'ContestSlug', 'ProblemIndex'];
const ratings = payload.map((r, i) => {
  for (const field of REQUIRED) {
    if (r[field] === undefined || r[field] === null) {
      console.error(`Record ${i} is missing "${field}" — source shape changed, refusing to write.`);
      process.exit(1);
    }
  }
  return {
    rating: r.Rating,
    frontendId: r.ID,
    title: r.Title,
    slug: r.TitleSlug,
    contestSlug: r.ContestSlug,
    problemIndex: r.ProblemIndex,
    // The source's own human-readable contest name. Kept so contest-name normalization has a
    // source rather than being reconstructed from the slug.
    contestName: r.ContestID_en ?? null,
  };
});

const snapshot = {
  source: SOURCE,
  note:
    'Estimated contest difficulty from ZeroTrac; not an official LeetCode rating. ' +
    '`frontendId` is LeetCode\'s displayed question id, NOT leetcode-catalog.json\'s internal id.',
  fetchedAt: new Date().toISOString(),
  total: ratings.length,
  ratings,
};

mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
writeFileSync(
  join(root, 'scripts', 'data', 'zerotrac-ratings.json'),
  JSON.stringify(snapshot, null, 1) + '\n',
);
console.log(`Snapshot written: ${ratings.length} rated problems (fetched ${snapshot.fetchedAt})`);
