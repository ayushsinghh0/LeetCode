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
  /** First-party page, fetched and quoted on `checkedAt`. */
  url: string;
  checkedAt: string;
  evidence: CompanyEvidence;
  /** Verbatim excerpt from that page. */
  quote: string;
  /** The topics the page literally names, in its own words. */
  namedTopics: string[];
  /** OUR mapping of THEIR named topics onto this roadmap's patterns. Empty unless 'topics'. */
  patterns: PatternId[];
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

/** Companies whose published topics touch a given pattern. */
export function companiesNamingPattern(pattern: PatternId): Company[] {
  return COMPANIES.filter((c) => c.patterns.includes(pattern));
}
