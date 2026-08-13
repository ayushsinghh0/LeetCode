import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Ledger, Page, PageHeader, RuledItem, RuledList, Section } from '@/components/layout/Page';
import { COMPANIES, EVIDENCE_LABEL, EVIDENCE_MEANING, companyById } from '@/data/companies';
import type { Company } from '@/data/companies';
import { patternById } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectPatternStats, selectQuestions, selectWeakestPatterns } from '@/store/selectors';
import {
  STRONG_PCT,
  WEAK_PCT,
  companyCoverage,
  practicePicks,
  practiceSetMinutes,
} from '@/utils/engine/companies';
import type { CompanyPatternCoverage } from '@/utils/engine/companies';
import { formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';

/**
 * The company surface, and the one place in the app where the wording *is* the feature.
 *
 * Every sentence here is gated by an evidence tier. `topics` companies enumerate structures and
 * algorithms on their own page, so this app may map those topics onto roadmap patterns and count
 * the learner's practice against them. `categories` companies name the area and nothing else, so
 * there is nothing to map. `avoids-puzzles` companies say in their own engineering writing that
 * they do not ask algorithm puzzles — which is the single most decision-changing thing a learner
 * preparing for them can be told, and so it leads rather than reading as a missing feature.
 *
 * The line no tier may cross: nothing here ever says, implies, or shapes itself around "this
 * company asks this problem". No first-party source supports that claim (see the `_readme` in
 * scripts/data/companies.json), the data model has nowhere to put it, and the practice set below
 * states its actual reason for existing on every single row.
 */

// The claim boundary. It leads both views on an ink rail — it used to be `text-xs` at the very
// bottom of the detail page, which made the most important sentence on the page the quietest.
const SCOPE_NOTE =
  'No company publishes the problems it asks. Every claim here is read off a page the company ' +
  'publishes itself — quoted verbatim and dated — and it never descends to the level of an ' +
  'individual problem, because no first-party source does.';

const STANDING_LABEL: Record<CompanyPatternCoverage['standing'], string> = {
  strong: 'Holding',
  developing: 'Developing',
  gap: 'Gap',
};

const STANDING_CLASS: Record<CompanyPatternCoverage['standing'], string> = {
  strong: 'text-easy',
  developing: 'text-muted-foreground',
  gap: 'text-hard',
};

const EYEBROW = 'figures text-xs uppercase tracking-[0.14em] text-muted-foreground';

/** A quiet block of qualifying prose on a hairline rail — scope, dates, what was inferred. */
function Caveat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={EYEBROW}>{label}</p>
      <p className="max-w-prose border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

/** Full-strength body text on the ink rail: this is the app's own standing claim, not a footnote. */
function ScopeNote() {
  return (
    <p className="max-w-prose border-l-2 border-primary/40 pl-4 text-sm leading-relaxed">
      {SCOPE_NOTE}
    </p>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* List                                                                                           */
/* --------------------------------------------------------------------------------------------- */

const ROW_LINK =
  '-mx-2 flex flex-col gap-1 rounded-md px-2 py-3.5 transition-colors duration-150 ease-swift ' +
  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** Name over its citation — which page is being quoted is the useful thing to know about a row. */
function CompanyRow({ company, trailing }: { company: Company; trailing?: ReactNode }) {
  return (
    <RuledItem className="py-0">
      <Link to={`/companies/${company.id}`} className={ROW_LINK}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex-1 truncate font-medium">{company.name}</span>
          {trailing && <span className="figures shrink-0 text-xs text-muted-foreground">{trailing}</span>}
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{company.sourceLabel}</span>
      </Link>
    </RuledItem>
  );
}

function CompanyList() {
  const withTopics = COMPANIES.filter((c) => c.evidence === 'topics');
  const avoidsPuzzles = COMPANIES.filter((c) => c.evidence === 'avoids-puzzles');
  const categoriesOnly = COMPANIES.filter((c) => c.evidence === 'categories');

  return (
    <Page>
      <PageHeader
        eyebrow={`${COMPANIES.length} first-party sources`}
        title="Interview relevance"
        support="Companies grouped by how much their own published interview guidance actually says. The group a company sits in is the whole of what this app will claim about it."
      />

      <ScopeNote />

      <Section
        title="Companies that name specific topics"
        support="These prep pages list actual data structures and algorithms, which is enough to line up against your own coverage — and the only tier where this app maps anything to a pattern."
      >
        <RuledList>
          {withTopics.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              trailing={`${company.patterns.length} patterns mapped`}
            />
          ))}
        </RuledList>
      </Section>

      {avoidsPuzzles.length > 0 && (
        <Section
          title="Companies that say they avoid puzzles"
          support="Their own engineering writing states they do not ask algorithm-puzzle questions. That is not a gap in the data — it is the most decision-changing thing on this page, so it is not filed under the companies that publish little."
        >
          <RuledList>
            {avoidsPuzzles.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </RuledList>
        </Section>
      )}

      <Section
        title="Companies that name the area only"
        support="Their pages confirm the coding interview exists and name data structures and algorithms as an area, but never say which ones. Most companies are here. They are listed so the absence is visible rather than filled in with guesswork."
      >
        <RuledList>
          {categoriesOnly.map((company) => (
            <CompanyRow key={company.id} company={company} />
          ))}
        </RuledList>
      </Section>
    </Page>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Detail                                                                                         */
/* --------------------------------------------------------------------------------------------- */

function UnknownCompany() {
  return (
    <Page width="reading">
      <PageHeader
        eyebrow={
          <Link to="/companies" className="underline-offset-4 hover:underline">
            Interview relevance
          </Link>
        }
        title="Unknown company"
        support={
          <>
            No verified source is on file for that one.{' '}
            <Link to="/companies" className="underline underline-offset-2">
              Back to the list
            </Link>
            .
          </>
        }
      />
    </Page>
  );
}

/** The citation: a verbatim blockquote, the page it came from, and the date it was last read. */
function SourceSection({ company }: { company: Company }) {
  return (
    <Section
      title="What they publish"
      support="Quoted verbatim from the page linked below — not summarised, not stitched together from headings. An ellipsis marks elision, and every fragment is re-checked against the live page by the source audit."
      aria-label="Source"
    >
      {/* Quoted evidence rides the neutral hairline rail (the InsightPanel idiom); the ink rail
          above is reserved for the app's own standing claim, so the two never read as one voice. */}
      <figure className="flex flex-col gap-3">
        <blockquote className="max-w-prose border-l-2 border-border pl-4 text-base leading-relaxed">
          {company.quote}
        </blockquote>
        <figcaption className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <cite className="not-italic font-medium text-foreground">{company.sourceLabel}</cite>
          <span aria-hidden="true" className="text-border">
            &middot;
          </span>
          <span className="figures">checked {company.checkedAt}</span>
        </figcaption>
      </figure>

      {company.namedTopics.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={EYEBROW}>Topics named across that page</p>
          <p className="text-sm leading-relaxed">{company.namedTopics.join(' · ')}</p>
          {/* The quote above is one excerpt; these are collected from the whole page. Saying so
              matters — otherwise the list reads as an expansion of the sentence above it, which
              it is not. */}
          <p className="text-xs text-muted-foreground">
            Collected from the full page, not only the sentence quoted above.
          </p>
        </div>
      )}

      {company.note && <Caveat label="Scope and caveats">{company.note}</Caveat>}

      <Button asChild variant="outline" size="sm" className="self-start">
        <a href={company.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink /> Read their page
        </a>
      </Button>
    </Section>
  );
}

/**
 * The one company in a seventeen-company sweep whose own page names any problem at all.
 *
 * The strings render exactly as the source phrases them, and the mandatory scope note renders
 * with them — never behind a disclosure — because the limits (2016, one specialist role, the
 * page's own words "simple problems") are most of what the claim means.
 */
function NamedProblemsSection({ company }: { company: Company }) {
  if (!company.namedProblems || company.namedProblems.length === 0) return null;

  return (
    <Section
      title={`Problems ${company.name}'s page names`}
      support={`Phrased exactly as that page phrases them. They are not matched to any question in this roadmap, and they are not a list of what ${company.name} asks — they are what one first-party page happened to write down, and the note beneath them is where the claim actually stops.`}
      aria-label="Named problems"
    >
      <RuledList>
        {company.namedProblems.map((problem) => (
          <RuledItem key={problem}>
            <span className="text-sm">{problem}</span>
          </RuledItem>
        ))}
      </RuledList>
      {company.namedProblemsNote && <Caveat label="Read this narrowly">{company.namedProblemsNote}</Caveat>}
    </Section>
  );
}

/* --- topics tier: coverage + practice ---------------------------------------------------------- */

function CoverageSection({
  company,
  coverage,
}: {
  company: Company;
  coverage: ReturnType<typeof companyCoverage>;
}) {
  return (
    <Section
      title="Your coverage of these topics"
      support={`This roadmap's patterns, matched by this app to the topics ${company.name}'s page names. The figures are your own solving record against them — not a prediction, not a percentile, and not a score anyone else would recognise.`}
      aria-label="Your coverage"
      action={
        <span className="figures text-sm text-muted-foreground">
          {coverage.solved} / {coverage.total} solved
        </span>
      }
    >
      <Ledger
        columns={4}
        items={[
          {
            label: 'Patterns mapped',
            value: coverage.patterns.length,
            sub: `from ${company.namedTopics.length} named topics`,
          },
          {
            label: 'Holding',
            value: coverage.strong.length,
            sub: `${STRONG_PCT}%+ solved, reviews passing`,
          },
          { label: 'Gaps', value: coverage.gaps.length, sub: `under ${WEAK_PCT}% solved` },
          {
            label: 'Unsolved here',
            value: formatMinutes(coverage.remainingMinutes),
            sub: 'at the authored estimates',
          },
        ]}
      />

      <RuledList aria-label="Mapped patterns">
        {coverage.patterns.map((row) => {
          const pattern = patternById[row.pattern];
          return (
            <RuledItem key={row.pattern} className="py-0">
              <Link to={`/patterns/${row.pattern}`} className={ROW_LINK}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{pattern.name}</span>
                  <span className="flex shrink-0 items-baseline gap-2 text-xs">
                    <span className={cn(STANDING_CLASS[row.standing])}>
                      {STANDING_LABEL[row.standing]}
                    </span>
                    <span className="figures text-muted-foreground">
                      {row.solved}/{row.total}
                    </span>
                  </span>
                </span>
                <Progress value={row.pct} className="h-1" aria-label={`${pattern.name} coverage`} />
              </Link>
            </RuledItem>
          );
        })}
      </RuledList>

      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        About <span className="figures">{formatMinutes(coverage.remainingMinutes)}</span> of unsolved
        material sits in these patterns. That is a workload figure, not a readiness score — this app
        has no basis for telling you whether you are ready for an interview, and will not pretend to
        by inventing one.
      </p>
    </Section>
  );
}

function PracticeSection({
  company,
  coverage,
}: {
  company: Company;
  coverage: ReturnType<typeof companyCoverage>;
}) {
  const dispatch = useAppDispatch();
  const byId = useAppSelector((s) => s.progress.byId);
  const all = selectQuestions();

  const picks = practicePicks(coverage, all, byId);
  if (picks.length === 0) return null;

  return (
    <Section
      title="Where to start"
      support={`Unsolved roadmap questions inside the patterns mapped above, weakest area first. Each row says why it is in this set. These are not questions ${company.name} asks — nobody publishes those.`}
      aria-label="Practice set"
      action={
        <span className="figures text-sm text-muted-foreground">
          ~{formatMinutes(practiceSetMinutes(picks.map((p) => p.question)))}
        </span>
      }
    >
      <RuledList>
        {picks.map(({ question, pattern, standing }) => (
          <RuledItem key={question.id} className="py-0">
            <button
              type="button"
              onClick={() => dispatch(activeQuestionSet(question.id))}
              className={cn(ROW_LINK, 'w-full text-left')}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{question.title}</span>
                <span className="figures shrink-0 text-xs text-muted-foreground">
                  ~{question.estimatedTime}m
                </span>
              </span>
              {/* The honest reason, on every row: the pattern was mapped from a topic on their
                  page, and the learner's standing in it is why the row sits where it does. */}
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <DifficultyBadge difficulty={question.difficulty} />
                <span aria-hidden="true" className="text-border">
                  &middot;
                </span>
                <span>
                  {patternById[pattern].name} — mapped from a topic they name
                  {standing === 'gap' && ', and your weakest area of theirs'}
                </span>
              </span>
            </button>
          </RuledItem>
        ))}
      </RuledList>
    </Section>
  );
}

/* --- the majority: companies with nothing to map ----------------------------------------------- */

/**
 * Most entries are `categories` or `avoids-puzzles`, and neither is an error state.
 *
 * `avoids-puzzles` gets a straight answer: their own words say pattern drilling is the wrong
 * optimisation, so the page stops rather than padding. `categories` gets the honest fallback —
 * there is no company-specific target, so the useful move is the one the learner would make
 * anyway, clearly labelled as roadmap advice rather than company advice.
 */
function NoMappingSection({ company }: { company: Company }) {
  if (company.evidence === 'avoids-puzzles') {
    return (
      <Section title="What that changes" aria-label="No pattern mapping">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          They say they do not ask algorithm puzzles, so lining their interview up against this
          roadmap would misrepresent both. There is nothing to map here, and nothing on this roadmap
          that is specifically preparation for them.
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Prepare for it as engineering work, with their own page above as the brief. This roadmap
          still buys you fluency — reading a problem, choosing a structure, writing it under time —
          which is worth having whoever is asking. It is just not this company's syllabus, and this
          app will not dress it up as one.
        </p>
      </Section>
    );
  }

  return (
    <Section title="No pattern mapping" aria-label="No pattern mapping">
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        Their page names the area but not the topics, and this app does not invent the difference.
        There is no {company.name}-shaped subset of this roadmap to hand you, because {company.name}{' '}
        never published one.
      </p>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        Treat the page above as the checklist for their loop; this roadmap covers the data
        structures and algorithms part of it, and nothing here can tell you how much of the rest
        they weight.
      </p>
    </Section>
  );
}

/** Roadmap advice, said as roadmap advice — the fallback when there is no company-specific target. */
function BroadPracticeSection() {
  const weakest = useAppSelector(selectWeakestPatterns).slice(0, 3);

  return (
    <Section
      title="Where to put the time instead"
      support="With nothing company-specific to aim at, the best available move is the one you would make anyway: the patterns you are weakest in."
      aria-label="Where to put the time"
    >
      {weakest.length === 0 ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Not enough practice yet to rank your patterns. Start anywhere in{' '}
          <Link to="/patterns" className="underline underline-offset-2 hover:text-primary">
            Patterns
          </Link>{' '}
          and this will fill in.
        </p>
      ) : (
        <>
          <RuledList aria-label="Your weakest patterns">
            {weakest.map(({ pattern }) => (
              <RuledItem key={pattern} className="py-0">
                <Link to={`/patterns/${pattern}`} className={ROW_LINK}>
                  <span className="min-w-0 truncate text-sm font-medium">
                    {patternById[pattern].name}
                  </span>
                </Link>
              </RuledItem>
            ))}
          </RuledList>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            Ranked from your own review pass rate, confidence and completion. This is roadmap
            advice, not company advice — nothing on their page points at any of it.
          </p>
        </>
      )}
    </Section>
  );
}

function CompanyDetail({ companyId }: { companyId: string }) {
  const stats = useAppSelector(selectPatternStats);
  const byId = useAppSelector((s) => s.progress.byId);
  const all = selectQuestions();

  const company = companyById[companyId];
  if (!company) return <UnknownCompany />;

  const coverage = companyCoverage(company.patterns, stats, all, byId);
  const hasMapping = company.patterns.length > 0;

  return (
    <Page>
      <PageHeader
        eyebrow={
          <>
            <Link to="/companies" className="underline-offset-4 hover:underline">
              Interview relevance
            </Link>
            <span aria-hidden="true" className="px-1.5 text-border">
              &middot;
            </span>
            {EVIDENCE_LABEL[company.evidence]}
          </>
        }
        title={company.name}
        support={EVIDENCE_MEANING[company.evidence]}
      />

      <ScopeNote />

      <SourceSection company={company} />

      <NamedProblemsSection company={company} />

      {hasMapping ? (
        <>
          <CoverageSection company={company} coverage={coverage} />
          <PracticeSection company={company} coverage={coverage} />
        </>
      ) : (
        <>
          <NoMappingSection company={company} />
          {company.evidence === 'categories' && <BroadPracticeSection />}
        </>
      )}
    </Page>
  );
}

export default function CompaniesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return companyId ? <CompanyDetail companyId={companyId} /> : <CompanyList />;
}
