// Emit `revision-sheet-report.md` from the resolved sheet. Generated, never hand-edited — the
// same rule every other dataset in this repo follows. Re-run after `resolve-revision-sheet.mjs`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { summary, sheet } = JSON.parse(
  readFileSync(join(root, 'scripts', 'data', 'revision-sheet-resolved.json'), 'utf8'),
);

const NUM = new Intl.NumberFormat('en-US');
const out = [];
const w = (s = '') => out.push(s);

const lc = sheet.filter((r) => r.status === 'leetcode');
const bySlug = new Map();
for (const r of lc) if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);

const membership = (r) => {
  const road = r.inRoadmap !== null;
  const lib = r.contestRating !== null;
  if (road && lib) return 'both';
  if (road) return 'roadmap';
  if (lib) return 'library';
  return 'new';
};
const tally = { both: 0, roadmap: 0, library: 0, new: 0 };
for (const r of bySlug.values()) tally[membership(r)]++;

const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const topics = [...new Set(sheet.map((r) => r.topic))];

/* ------------------------------------------------------------------------------------------- */

w('# The Topic-Wise Revision Sheet — resolution report');
w();
w('**Generated** by `scripts/report-revision-sheet.mjs` from `scripts/data/revision-sheet.txt`.');
w('Never hand-edit this file; fix the sheet or the resolver and re-run.');
w();
w('> This is **not** `report.md` (the repository audit). It is a separate document answering one');
w('> question: of the problems on this sheet, which are on LeetCode, what are their IDs and');
w('> links, and which does this repository already have?');
w();
w('## How this was produced, and what it is worth');
w();
w('Every fact below comes from files already committed to this repository — **no network was**');
w('**used**, which is the same rule the app itself lives by:');
w();
w('| Source | What it supplied |');
w('|---|---|');
w('| `scripts/data/leetcode-topics.json` | 4,029 LeetCode problems: frontend id, slug, official difficulty, paid flag, topic tags |');
w('| `scripts/data/leetcode-catalog.json` | the title/slug catalog the 539 curriculum questions resolve against |');
w('| `src/data/questions.json` | the 539-question curriculum — "is this already on my roadmap?" |');
w('| `src/data/contestLibrary.json` | the 2,561 rated contest problems — "is this contest-rated, and at what rating?" |');
w();
w('**Matching is closed-world**, exactly like the question generator: a sheet title resolves only');
w('by exact normalized title match or through a hand-verified alias that was checked against the');
w('snapshot one by one. Nothing is fuzzy-matched and nothing is guessed. A wrong link in a');
w('revision list is worse than a missing one — it sends you to the wrong problem and gives you no');
w('way to notice. Where a title genuinely names more than one problem it is reported as');
w('**ambiguous with its candidates**, not silently resolved.');
w();
w('## The headline');
w();
w('| | |');
w('|---|---|');
w(`| Rows on the sheet | **${NUM.format(summary.rows)}** across ${summary.topics} topics and ${summary.subtopics} sub-topics |`);
w(`| Resolved to LeetCode | ${NUM.format(summary.onLeetCode)} rows → **${NUM.format(summary.uniqueLeetCodeProblems)} unique problems** (rows repeat across sub-topics) |`);
w(`| Not on LeetCode | ${summary.otherPlatform} rows — GeeksforGeeks, CSES, Codeforces, AtCoder, or pure theory |`);
w(`| Unresolved | **${summary.unresolved}** |`);
w(`| Ambiguous | ${summary.ambiguous} (listed in full below) |`);
w(`| Premium-gated | ${summary.premium} |`);
w();
w('### The finding that should shape the plan');
w();
w(`**${NUM.format(tally.both + tally.roadmap + tally.library)} of the ${NUM.format(bySlug.size)} unique LeetCode problems — ${Math.round(((tally.both + tally.roadmap + tally.library) / bySlug.size) * 100)}% — are already in this repository.**`);
w();
w('| Where it already lives | Count | What that means for revision |');
w('|---|---:|---|');
w(`| In **both** the 539 roadmap and the contest library | ${tally.both} | Already tracked; one identity, one record |`);
w(`| In the **539 roadmap** only | ${tally.roadmap} | Already on your roadmap — **must be excluded from new revision draws** |`);
w(`| In the **contest library** only | ${tally.library} | Already practisable at \`/contest-practice\`; rated |`);
w(`| In **neither** | ${tally.new} | Genuinely new — the only problems that need adding |`);
w();
w('So this sheet is not a third question universe. It is **a topic-wise ordering over problems you');
w(`mostly already have**, plus ${tally.new} additions. That is a far smaller and safer change than it looks,`);
w('and it is the whole basis of the integration plan at the end.');
w();
w(`Of the ${NUM.format(bySlug.size)} unique problems, **${NUM.format(summary.alreadyOnRoadmap)}** are on your 539 roadmap. Your rule —`);
w('*revision must not repeat what the roadmap already covers* — is therefore satisfiable by');
w('construction, not by a filter you have to remember to apply.');
w();

/* --- Legend ---------------------------------------------------------------------------------- */

w('## Reading the tables');
w();
w('| Column | Meaning |');
w('|---|---|');
w('| **#** | LeetCode\'s **frontend id** — the number LeetCode displays, and the one you can search. |');
w('| **Difficulty** | LeetCode\'s official difficulty. Where the sheet disagrees, the sheet\'s value is shown in brackets and the row is listed again under *Difficulty disagreements*. |');
w('| **Rating** | ZeroTrac\'s estimated contest rating, when the problem was a rated contest problem. An estimate for relative comparison — never an official LeetCode number. |');
w('| **Have it?** | `roadmap #N` = already question N of your 539. `library` = already in the 2,561 contest pool. `NEW` = in neither. |');
w();

/* --- Per-topic tables ------------------------------------------------------------------------ */

w('---');
w();
w('## The sheet, topic by topic');
w();

for (const topic of topics) {
  const rows = sheet.filter((r) => r.topic === topic);
  const uniqueHere = new Set(rows.filter((r) => r.slug).map((r) => r.slug));
  const newHere = rows.filter((r) => r.status === 'leetcode' && membership(r) === 'new').length;
  const roadHere = rows.filter((r) => r.status === 'leetcode' && r.inRoadmap !== null).length;

  w(`### ${topic}`);
  w();
  w(`${rows.length} rows · ${uniqueHere.size} unique LeetCode problems · ${roadHere} already on your roadmap · ${newHere} new`);
  w();

  for (const sub of [...new Set(rows.map((r) => r.sub))]) {
    const subRows = rows.filter((r) => r.sub === sub);
    w(`#### ${sub}`);
    w();
    w('| # | Problem | Difficulty | Rating | Have it? |');
    w('|---:|---|---|---:|---|');
    for (const r of subRows) {
      if (r.status === 'leetcode') {
        const diff =
          r.difficultyMismatch
            ? `${DIFF[r.officialDifficulty]} *(sheet: ${r.difficulty})*`
            : DIFF[r.officialDifficulty] ?? r.difficulty;
        const have =
          r.inRoadmap !== null
            ? `roadmap #${r.inRoadmap}${r.contestRating !== null ? ' + library' : ''}`
            : r.contestRating !== null
              ? 'library'
              : '**NEW**';
        const prem = r.premium ? ' 🔒' : '';
        w(
          `| ${r.frontendId} | [${r.title}](${r.url})${prem} | ${diff} | ${r.contestRating ?? '—'} | ${have} |`,
        );
      } else if (r.status === 'other-platform') {
        w(`| — | ${r.title} | ${r.difficulty} | — | not on LeetCode · ${r.platform} |`);
      } else if (r.status === 'ambiguous') {
        w(`| — | ${r.title} | ${r.difficulty} | — | **ambiguous — see below** |`);
      } else {
        w(`| — | ${r.title} | ${r.difficulty} | — | **unresolved** |`);
      }
    }
    w();
  }
}

/* --- Appendices ------------------------------------------------------------------------------ */

w('---');
w();
w('## Appendix A — the 159 genuinely new problems');
w();
w('These are in neither the 539 nor the contest library. They are the only additions integration');
w('actually requires; everything else the sheet names, this repository already tracks.');
w();
w('| # | Problem | Difficulty | Topic |');
w('|---:|---|---|---|');
for (const r of [...bySlug.values()].filter((x) => membership(x) === 'new').sort((a, b) => a.frontendId - b.frontendId)) {
  w(`| ${r.frontendId} | [${r.title}](${r.url}) | ${DIFF[r.officialDifficulty]} | ${r.topic} |`);
}
w();

w('## Appendix B — on the sheet, but not on LeetCode');
w();
w('Reported by platform rather than dropped. Several are classics worth doing; they simply cannot');
w('carry a LeetCode id or link, and inventing one would be the exact failure this report avoids.');
w();
const other = sheet.filter((r) => r.status === 'other-platform');
const platforms = [...new Set(other.map((r) => r.platform))].sort();
w('| Platform | Count | Problems |');
w('|---|---:|---|');
for (const p of platforms) {
  const names = [...new Set(other.filter((r) => r.platform === p).map((r) => r.title))].sort();
  w(`| ${p} | ${names.length} | ${names.join(' · ')} |`);
}
w();

w('## Appendix C — difficulty disagreements');
w();
w(`On ${summary.difficultyMismatches} rows the sheet\'s difficulty differs from LeetCode\'s official one. Neither is`);
w('necessarily "wrong" — a sheet author often grades by *how hard it is to see the idea* rather');
w('than by LeetCode\'s label — but the disagreement is worth seeing, because it is also how a');
w('mis-resolution would show itself.');
w();
w('| # | Problem | Sheet | LeetCode | Topic |');
w('|---:|---|---|---|---|');
for (const r of lc.filter((x) => x.difficultyMismatch)) {
  w(`| ${r.frontendId} | [${r.title}](${r.url}) | ${r.difficulty} | ${DIFF[r.officialDifficulty]} | ${r.topic} |`);
}
w();

w('## Appendix D — ambiguous');
w();
for (const r of sheet.filter((x) => x.status === 'ambiguous')) {
  w(`- **${r.title}** *(${r.topic} / ${r.sub}, sheet says ${r.difficulty})* — ${r.note}`);
}
w();
w('Left unresolved on purpose. Tell me which one you meant and it becomes a one-line alias.');
w();

w('## Appendix E — transcription note');
w();
w('The sheet was transcribed by hand from the message you sent, into');
w('`scripts/data/revision-sheet.txt`, preserving your spelling and ordering exactly (including');
w('`Robot Collisons` and `Insert Intervals`, which are corrected in the resolver\'s alias table');
w('rather than in the transcript). Two things to know:');
w();
w('- **The paste ended mid-row.** The final entry under *Advance algorithm → Sparse Table* is');
w('  `Maximum Binary Tree` with no difficulty. It resolved to LeetCode 654, but if your sheet has');
w('  more rows after it, they are not here.');
w('- **Rows repeat by design.** 1,210 rows resolve to 1,016 unique problems because the sheet');
w('  deliberately lists some problems under several patterns (Sliding Window Maximum appears under');
w('  both a fixed-size window and a deque, for instance). That repetition is signal, not noise —');
w('  it is exactly what makes a problem worth revising — and the integration plan preserves it.');
w();

w('---');
w();
w('## What to do with this — the integration plan in one page');
w();
w('The full plan is `docs/superpowers/specs/2026-08-20-revision-sheet-design.md`. The short form:');
w();
w('**This sheet does not become a third question universe.** 84% of it is already here, so it');
w('becomes a *lens* — a topic-wise ordering over problems the repo already tracks — plus the 159');
w('additions in Appendix A. No third progress register, no second scheduler, no second scorer.');
w();
w('| | |');
w('|---|---|');
w('| **Where progress lives** | Curriculum rows keep their record in `progress.byId`. Everything else (library rows *and* the 159) uses the existing slug-keyed register, which needs no schema change to accept them. |');
w('| **Your no-repeat rule** | Enforced *by construction*: membership is known when the dataset is generated, so a revision draw excludes roadmap-backed rows by default — visibly and reversibly, never silently. |');
w('| **New surfaces** | A `/sheet` index, and a fifth mode on the existing Revision mode selector. A timed set reuses the contest path that already exists. |');
w('| **Cost** | ~2.5–3 days across four slices, after V13 slice 7. |');
w();
w('Two things are flagged in the plan rather than left to be discovered late: `/sheet` would be');
w('the **17th nav destination**, and 16 is what currently fits a 590px rail — so that gets');
w('resolved before the route is built, not after. And the 134 non-LeetCode rows get **listed with');
w('their platform named and nothing linked**, because a fabricated link is precisely the failure');
w('this report exists to prevent.');
w();
w('Three questions in the plan need your answer before slice S1 — XP for sheet-only solves, what');
w('to do with the non-LeetCode rows, and the one ambiguous title.');
w();

writeFileSync(join(root, 'revision-sheet-report.md'), out.join('\n'));
console.log(`revision-sheet-report.md written — ${out.length} lines`);
