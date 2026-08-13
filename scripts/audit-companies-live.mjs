// LIVE company-evidence audit: fetches every first-party source and checks that the page still
// says what this dataset claims it says. Run: npm run audit:companies (needs network —
// deliberately NOT part of the offline suite or validate:data, exactly like audit:links).
//
// Why this exists. Every external claim in this repo had an automated way to be re-checked except
// company evidence, which carried a `checkedAt` date asserting a fetch that nothing could verify
// or repeat. That asymmetry is the whole point of this script: a dated claim with no audit path
// is a claim that quietly rots, and the two entries this dataset already lost were lost to
// exactly the failure mode a verbatim check catches.
//
// What it verifies, per company:
//   1. the URL still resolves (and where it redirects to, since a silent redirect to a generic
//      careers page is how a source dies in practice — that is how Google's Tech Dev Guide went)
//   2. the `quote` still appears VERBATIM in the page's own text
//   3. which `namedTopics` can still be found on the page
//   4. how stale `checkedAt` has become
//
// Outcomes are three-valued on purpose. PASS and FAIL are obvious; UNVERIFIABLE is for sources
// that refuse scripted fetches (403/anti-bot) — a bot block is not evidence a page has changed,
// and recording it as a failure would train whoever runs this to ignore real failures.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'companies.json'), 'utf8'));
const companies = source.companies;

const DELAY_MS = 400; // polite pacing — these are real marketing sites, not an API
const STALE_DAYS = 180;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fold the typographic variants that make a byte-comparison of web prose useless: smart quotes,
 * the three dash widths, non-breaking spaces, and runs of whitespace introduced by HTML layout.
 * Everything else — wording, order, capitalisation — is left alone, because those are precisely
 * the differences a paraphrase check must not forgive.
 */
function normalize(text) {
  return text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“',
  '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
};

function htmlToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Hex before decimal before named: several of these pages emit &#x27; for an apostrophe, and
    // leaving it undecoded silently breaks every quote containing one.
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ');
}

/**
 * Below this much extractable prose, the response is a JavaScript shell rather than a document —
 * Google's careers page ships 819 KB of markup carrying 1.7 KB of text, all of it navigation.
 *
 * This is applied ONLY after a quote has failed to match, never before. A page whose quote is
 * found is verified however short it is; a page whose quote is missing is only called a failure
 * if the page actually contained enough prose to have held it. Getting that order wrong would
 * turn every client-rendered source into a permanent false failure, and a check that cries wolf
 * is worse than no check.
 */
const MIN_PROSE_CHARS = 3000;

/**
 * A quote may elide with "…", which is a legitimate quoting convention rather than a stitch — so
 * long as every fragment is itself verbatim and the fragments appear in the order written. Each
 * fragment is checked independently and in sequence; a quote that only matches out of order has
 * been assembled, not excerpted.
 */
function findQuote(pageText, quote) {
  const fragments = quote.split(/\s*(?:…|\.\.\.)\s*/).filter((f) => f.trim().length > 0);
  const missing = [];
  let cursor = 0;
  for (const fragment of fragments) {
    const needle = normalize(fragment);
    const at = pageText.indexOf(needle, cursor);
    if (at === -1) missing.push(fragment);
    else cursor = at + needle.length;
  }
  return { ok: missing.length === 0, fragments: fragments.length, missing };
}

function daysBetween(isoA, isoB) {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86_400_000);
}

async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      // These pages serve different markup (or nothing at all) to a bare fetch. A browser-shaped
      // request is not evasion here — it is asking for the same document a learner would see.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const body = await res.text();
  return { status: res.status, finalUrl: res.url, text: normalize(htmlToText(body)) };
}

const today = new Date().toISOString().slice(0, 10);
const pass = [];
const fail = [];
const unverifiable = [];
const warn = [];

console.log(`auditing ${companies.length} company sources...\n`);

for (const company of companies) {
  const label = `${company.name} (${company.id})`;
  let page;
  try {
    page = await fetchPage(company.url);
  } catch (e) {
    unverifiable.push(`${label}: fetch threw — ${e.message}`);
    await sleep(DELAY_MS);
    continue;
  }

  // 400 belongs here too: Meta answers a scripted fetch with a 400 error page, which is a block,
  // not a dead URL.
  if (page.status === 400 || page.status === 403 || page.status === 429) {
    unverifiable.push(
      `${label}: HTTP ${page.status} (blocked to scripted fetches). Needs a real browser to re-verify — not evidence the page changed.`,
    );
    await sleep(DELAY_MS);
    continue;
  }
  if (page.status >= 400) {
    fail.push(`${label}: HTTP ${page.status} at ${company.url}`);
    await sleep(DELAY_MS);
    continue;
  }

  // A redirect away from the declared URL is worth surfacing even when the quote still matches —
  // it is the first symptom of a source being retired into a generic landing page.
  if (page.finalUrl && normalize(page.finalUrl) !== normalize(company.url)) {
    warn.push(`${label}: redirects to ${page.finalUrl}`);
  }

  const quote = findQuote(page.text, company.quote);
  if (!quote.ok) {
    if (page.text.length < MIN_PROSE_CHARS) {
      unverifiable.push(
        `${label}: server HTML carries only ${page.text.length} chars of prose — the page is ` +
          `client-rendered, so the quote cannot be checked without a browser.`,
      );
    } else {
      fail.push(
        `${label}: quote no longer found verbatim on a page carrying ${page.text.length} chars of prose.\n` +
          quote.missing.map((m) => `      missing fragment: "${m}"`).join('\n'),
      );
    }
    await sleep(DELAY_MS);
    continue;
  }

  const topicsFound = (company.namedTopics ?? []).filter((t) =>
    page.text.toLowerCase().includes(normalize(t).toLowerCase()),
  );
  const topicsTotal = (company.namedTopics ?? []).length;
  // Soft signal only: namedTopics is drawn from the whole page and is allowed to compress the
  // page's own phrasing ("hash sets / maps / tables"), so a miss here is a prompt to re-read,
  // never a failure.
  if (topicsTotal > 0 && topicsFound.length < topicsTotal) {
    warn.push(
      `${label}: ${topicsFound.length}/${topicsTotal} namedTopics found literally on the page (compression is allowed; re-read if this drops sharply)`,
    );
  }

  const age = daysBetween(company.checkedAt, today);
  if (age > STALE_DAYS) {
    warn.push(`${label}: checkedAt is ${age} days old — re-date it after this run`);
  }

  pass.push(`${label}: quote verified${quote.fragments > 1 ? ` (${quote.fragments} fragments)` : ''}, ${topicsFound.length}/${topicsTotal} topics found`);
  await sleep(DELAY_MS);
}

console.log(`verified:     ${pass.length}/${companies.length}`);
for (const p of pass) console.log('  OK   ' + p);

if (warn.length > 0) {
  console.log(`\nwarnings (${warn.length}) — not failures, but read them:`);
  for (const w of warn) console.log('  WARN ' + w);
}

if (unverifiable.length > 0) {
  console.log(`\nunverifiable (${unverifiable.length}) — the source blocks scripted fetches:`);
  for (const u of unverifiable) console.log('  ??   ' + u);
  console.log('  These need a browser. They are NOT counted as passes.');
}

if (fail.length > 0) {
  console.error(`\nFAILED — ${fail.length} source(s) no longer support their claim:`);
  for (const f of fail) console.error('  FAIL ' + f);
  console.error('\nFix the dataset, not the check: re-quote from the live page, or remove the entry.');
  process.exit(1);
}

console.log('\nOK — every reachable source still carries its quoted sentence verbatim.');
if (unverifiable.length > 0) {
  console.log(`(${unverifiable.length} source(s) could not be checked automatically — see above.)`);
}
