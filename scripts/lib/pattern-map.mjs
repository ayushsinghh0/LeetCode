// The ONE tag→pattern mapper, shared by generate-contest-library.mjs and
// generate-revision-sheet.mjs. Extracted verbatim from the contest generator so the two datasets
// can never disagree about what a LeetCode tag set implies — a second copy of these rules would
// be a second classification system wearing the first one's name.
//
// The map itself is scripts/data/contest-pattern-map.json: hand-verified, auditable, never
// inferred at build or run time. Three mechanisms apply in order — combination rules (most
// specific first), then single-tag direct rules, with container tags never contributing alone.

const CONFIDENCES = new Set(['exact', 'strong', 'heuristic']);
const RANK = { exact: 3, strong: 2, heuristic: 1 };

/**
 * Validate the hand-authored map before trusting it. `fail` receives structural defects that
 * must stop the build; `warn` receives dead weight worth surfacing (rules matching nothing).
 */
export function validatePatternMap(patternMap, { knownTags, patternIds, fail, warn }) {
  const containerTags = new Set(patternMap.containerTags);

  for (const tag of patternMap.containerTags) {
    if (!knownTags.has(tag)) warn(`containerTags lists "${tag}", which no LeetCode problem carries`);
  }
  for (const [tag, rule] of Object.entries(patternMap.direct)) {
    if (containerTags.has(tag)) fail(`"${tag}" is both a containerTag and a direct rule — pick one`);
    if (!CONFIDENCES.has(rule.confidence)) fail(`direct["${tag}"] has invalid confidence "${rule.confidence}"`);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) fail(`direct["${tag}"] has no patterns`);
    for (const p of rule.patterns ?? []) {
      if (!patternIds.has(p)) fail(`direct["${tag}"] maps to unknown pattern "${p}"`);
    }
    // A rule for a tag nothing carries is dead weight that will rot silently.
    if (!knownTags.has(tag)) warn(`direct rule for "${tag}" matches no problem in the topic snapshot`);
  }
  for (const [i, combo] of patternMap.combinations.entries()) {
    if (!Array.isArray(combo.when) || combo.when.length < 2) fail(`combinations[${i}] needs at least two tags`);
    if (!CONFIDENCES.has(combo.confidence)) fail(`combinations[${i}] has invalid confidence`);
    for (const p of combo.patterns ?? []) {
      if (!patternIds.has(p)) fail(`combinations[${i}] maps to unknown pattern "${p}"`);
    }
    for (const t of combo.when ?? []) {
      if (!knownTags.has(t)) warn(`combinations[${i}] references unknown tag "${t}"`);
    }
  }
  for (const tag of patternMap._unmappableTags.tags) {
    if (patternMap.direct[tag]) fail(`"${tag}" is listed as unmappable but also has a direct rule`);
  }
}

/**
 * Build the resolver over a validated map.
 *
 * Combination rules run first and in authored order (most specific first) so DFS-over-a-tree and
 * DFS-over-a-grid stop being the same claim. Container tags never contribute on their own. A
 * pattern claimed at two confidences keeps the higher one — the stronger rule is the reason the
 * claim is being made at all.
 *
 * @returns {(tags: string[]) => Map<string, 'exact'|'strong'|'heuristic'>}
 */
export function makeTagResolver(patternMap) {
  const containerTags = new Set(patternMap.containerTags);

  return function resolveFromTags(tags) {
    const tagSet = new Set(tags);
    /** @type {Map<string, 'exact'|'strong'|'heuristic'>} */
    const found = new Map();
    const record = (pattern, confidence) => {
      const existing = found.get(pattern);
      if (existing === undefined || RANK[confidence] > RANK[existing]) found.set(pattern, confidence);
    };

    const consumed = new Set();
    for (const combo of patternMap.combinations) {
      if (combo.when.every((t) => tagSet.has(t))) {
        for (const p of combo.patterns) record(p, combo.confidence);
        for (const t of combo.when) consumed.add(t);
      }
    }

    for (const tag of tags) {
      if (containerTags.has(tag)) continue;
      // A tag already used by a combination rule does not also fire its (weaker, ambiguous)
      // direct rule — that is the whole point of the combination existing.
      if (consumed.has(tag)) continue;
      const rule = patternMap.direct[tag];
      if (rule) for (const p of rule.patterns) record(p, rule.confidence);
    }

    return found;
  };
}

/** The confidence order shared by both generators. */
export const CONFIDENCE_RANK = RANK;
