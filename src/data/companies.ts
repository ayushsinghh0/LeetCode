import companiesJson from '@/data/companies.json';
import type { PatternId } from '@/types';

/**
 * Company interview evidence — generated from scripts/data/companies.json, never hand-edited.
 *
 * The type has no per-problem field, and that absence is the design. See the source file's
 * `_readme` and the generator's `validateCompanies` for the full reasoning; the short version is
 * that no company publishes the problems it asks, and the only large per-problem dataset in
 * circulation is paywalled, self-reported survey data that its own publisher does not vouch for.
 */
export type CompanyEvidence =
  /** The company's page enumerates specific structures/algorithms. Only this tier maps patterns. */
  | 'topics'
  /** The page names "data structures and algorithms" as an area but enumerates nothing. */
  | 'categories'
  /** The page explicitly says it does not ask algorithm-puzzle questions. */
  | 'avoids-puzzles';

export interface Company {
  id: string;
  name: string;
  /** The specific page being quoted — a citation, not a brand. */
  sourceLabel: string;
  /** First-party page, fetched and quoted on `checkedAt`. Re-checkable via `audit:companies`. */
  url: string;
  checkedAt: string;
  evidence: CompanyEvidence;
  /** Verbatim excerpt from that page. An ellipsis marks elision; the audit checks each fragment. */
  quote: string;
  /** The topics the page literally names, in its own words. */
  namedTopics: string[];
  /** OUR mapping of THEIR named topics onto this roadmap's patterns. Empty unless 'topics'. */
  patterns: PatternId[];
  /**
   * Problems a first-party page names, VERBATIM as that page phrases them — never mapped to a
   * question in this roadmap, and never presented as "what they ask". Exactly one company in a
   * seventeen-company sweep had anything here, which is itself the finding.
   */
  namedProblems?: string[];
  /** Mandatory whenever `namedProblems` is populated: the scope and limits of that claim. */
  namedProblemsNote?: string;
  note?: string;
}

export const COMPANIES = companiesJson as Company[];

export const companyById: Record<string, Company> = Object.fromEntries(
  COMPANIES.map((c) => [c.id, c]),
);

export const EVIDENCE_LABEL: Record<CompanyEvidence, string> = {
  topics: 'Names specific topics',
  categories: 'Names the area only',
  'avoids-puzzles': 'Does not ask puzzles',
};

export const EVIDENCE_MEANING: Record<CompanyEvidence, string> = {
  topics:
    'Their own prep page lists specific data structures and algorithms. The patterns below are this app mapping those named topics onto its roadmap.',
  categories:
    'Their own prep page names data structures and algorithms as an area but does not say which ones. There is nothing here to map to patterns, so nothing is.',
  'avoids-puzzles':
    'Their own engineering writing states they deliberately do not ask algorithm-puzzle questions. Worth knowing before you prepare for one.',
};

/**
 * Companies whose own published topics touch a given pattern.
 *
 * The `evidence === 'topics'` check is load-bearing and is stated here rather than inherited. It
 * was previously absent, and the function was correct only by accident: the generator and
 * `validate:data` guarantee that `patterns` is non-empty ONLY at the topics tier, so a
 * pattern-only filter happened to return the same rows. That is a guarantee held one layer away
 * from the code that depends on it — a dataset regression, or a categories-tier company gaining a
 * stray pattern, would have put a company's name on a sentence its own page does not support.
 *
 * Every function whose output becomes a sentence with a company name in it re-checks this, so the
 * failure direction is silence rather than a fabricated claim (see
 * `companiesNamingPatternTopics`, which does the same for the question sheet).
 */
export function companiesNamingPattern(pattern: PatternId): Company[] {
  return COMPANIES.filter((c) => c.evidence === 'topics' && c.patterns.includes(pattern));
}
