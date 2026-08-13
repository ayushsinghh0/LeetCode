import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { COMPANIES, EVIDENCE_LABEL, EVIDENCE_MEANING, companyById } from '@/data/companies';
import { patternById } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPatternStats, selectQuestions } from '@/store/selectors';
import { companyCoverage, companyPracticeSet, practiceSetMinutes } from '@/utils/engine/companies';
import { formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';

// The honesty line. It appears on every company surface, not buried in a footnote, because it
// is the single most important thing to understand about this data.
const SCOPE_NOTE =
  'Every line here comes from a page the company publishes itself, quoted and dated. No company ' +
  'publishes the problems it asks, so this app makes no problem-level claims at all.';

const STANDING_LABEL = {
  strong: 'Holding',
  developing: 'Developing',
  gap: 'Gap',
} as const;

function CompanyList() {
  const withTopics = COMPANIES.filter((c) => c.evidence === 'topics');
  const others = COMPANIES.filter((c) => c.evidence !== 'topics');

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gradient">Interview relevance</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{SCOPE_NOTE}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Companies that name specific topics</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          These prep pages list actual data structures and algorithms, which is enough to line up
          against your own coverage.
        </p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {withTopics.map((company) => (
            <li key={company.id}>
              <Link
                to={`/companies/${company.id}`}
                className="glass flex h-full flex-col gap-1 p-4 transition-colors duration-150 ease-swift hover:border-primary/40"
              >
                <span className="font-semibold">{company.name}</span>
                <span className="figures text-xs text-muted-foreground">
                  {company.patterns.length} mapped patterns &middot; checked {company.checkedAt}
                </span>
                <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {company.namedTopics.slice(0, 6).join(', ')}…
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Companies that publish less</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Their pages confirm the coding interview exists and name the area, but not the topics.
          They are listed so the absence is visible rather than filled in with guesswork.
        </p>
        <ul className="flex flex-col">
          {others.map((company) => (
            <li key={company.id} className="border-b border-border/50 last:border-b-0">
              <Link
                to={`/companies/${company.id}`}
                className="flex items-center gap-3 py-2.5 text-sm transition-colors duration-150 ease-swift hover:text-primary"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{company.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {EVIDENCE_LABEL[company.evidence]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CompanyDetail({ companyId }: { companyId: string }) {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectPatternStats);
  const byId = useAppSelector((s) => s.progress.byId);
  const all = selectQuestions();

  const company = companyById[companyId];
  if (!company) {
    return (
      <div className="glass p-6">
        <h1 className="text-xl font-semibold">Unknown company</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No verified source is on file for that one.{' '}
          <Link to="/companies" className="underline underline-offset-2">
            Back to the list
          </Link>
          .
        </p>
      </div>
    );
  }

  const coverage = companyCoverage(company.patterns, stats, all, byId);
  const practiceSet = companyPracticeSet(coverage, all, byId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link to="/companies" className="text-xs text-muted-foreground underline underline-offset-2">
          Interview relevance
        </Link>
        <h1 className="text-2xl font-bold text-gradient">{company.name}</h1>
        <p className="text-sm text-muted-foreground">{EVIDENCE_MEANING[company.evidence]}</p>
      </header>

      <section className="glass flex flex-col gap-3 p-5" aria-label="Source">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
          <h2 className="text-base font-medium">What they publish</h2>
          <span className="figures text-xs text-muted-foreground">checked {company.checkedAt}</span>
        </div>
        <blockquote className="flex gap-2 text-sm text-muted-foreground">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{company.quote}</span>
        </blockquote>
        {company.namedTopics.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Topics named across that page
            </p>
            <p className="mt-1 text-sm">{company.namedTopics.join(' · ')}</p>
            {/* The quote above is one excerpt; these are collected from the whole page. Saying so
                matters — otherwise the list reads as an expansion of the sentence above it, which
                it is not. */}
            <p className="mt-1 text-xs text-muted-foreground">
              Collected from the full page, not only the sentence quoted above.
            </p>
          </div>
        )}
        {company.note && <p className="text-sm text-muted-foreground">{company.note}</p>}
        <Button asChild variant="outline" size="sm" className="self-start">
          <a href={company.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Read their page
          </a>
        </Button>
      </section>

      {company.patterns.length === 0 ? (
        <section className="glass p-5" aria-label="Coverage">
          <h2 className="text-base font-medium">No pattern mapping</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {company.evidence === 'avoids-puzzles'
              ? 'They say they do not ask algorithm puzzles, so lining their interview up against this roadmap would misrepresent both. Prepare for it as engineering work, not as pattern drilling.'
              : 'Their page names the area but not the topics, and this app does not invent the difference. Practise the roadmap broadly rather than optimizing for a list nobody published.'}
          </p>
        </section>
      ) : (
        <section className="glass flex flex-col gap-3 p-5" aria-label="Your coverage">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
            <h2 className="text-base font-medium">Your coverage of those topics</h2>
            <span className="figures text-sm text-muted-foreground">
              {coverage.solved} / {coverage.total} solved
            </span>
          </div>
          <Progress value={coverage.pct} className="h-1.5" aria-label="Coverage of mapped patterns" />

          <ul className="flex flex-col">
            {coverage.patterns.map((row) => {
              const pattern = patternById[row.pattern];
              return (
                <li key={row.pattern} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <Link
                    to={`/patterns/${row.pattern}`}
                    className="min-w-0 flex-1 truncate text-sm transition-colors duration-150 ease-swift hover:text-primary"
                  >
                    {pattern.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      row.standing === 'strong' && 'text-easy',
                      row.standing === 'gap' && 'text-hard',
                      row.standing === 'developing' && 'text-muted-foreground',
                    )}
                  >
                    {STANDING_LABEL[row.standing]}
                  </span>
                  <span className="figures w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {row.solved}/{row.total}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-muted-foreground">
            About <span className="figures">{formatMinutes(coverage.remainingMinutes)}</span> of
            unsolved material sits in these patterns. That is a workload figure, not a readiness
            score — this app has no basis for telling you whether you are ready for an interview.
          </p>
        </section>
      )}

      {practiceSet.length > 0 && (
        <section className="glass flex flex-col gap-3 p-5" aria-label="Practice set">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
            <h2 className="text-base font-medium">Where to start</h2>
            <span className="figures text-sm text-muted-foreground">
              ~{formatMinutes(practiceSetMinutes(practiceSet))}
            </span>
          </div>
          <p className="max-w-prose text-sm text-muted-foreground">
            Unsolved roadmap questions in the patterns {company.name} names, weakest area first.
            These are not questions {company.name} asks — nobody publishes those.
          </p>
          <ul className="flex flex-col">
            {practiceSet.map((question) => (
              <li key={question.id} className="border-b border-border/50 last:border-b-0">
                <button
                  type="button"
                  onClick={() => dispatch(activeQuestionSet(question.id))}
                  className="flex w-full items-center gap-3 py-2 text-left transition-colors duration-150 ease-swift hover:text-primary"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{question.title}</span>
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span className="figures shrink-0 text-xs text-muted-foreground">
                    ~{question.estimatedTime}m
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">{SCOPE_NOTE}</p>
    </div>
  );
}

export default function CompaniesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return companyId ? <CompanyDetail companyId={companyId} /> : <CompanyList />;
}
