import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import {
  Disclosure,
  Eyebrow,
  Figures,
  Ledger,
  Meta,
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
  RuledItem,
  RuledList,
  Section,
} from '@/components/layout/Page';
import { COMPANIES, EVIDENCE_LABEL, EVIDENCE_MEANING, companyById, type Company } from '@/data/companies';
import { patternById } from '@/data/patterns';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import {
  selectPatternStats,
  selectPatternWeakness,
  selectQuestions,
  selectTargetCompany,
} from '@/store/selectors';
import { setTargetCompany } from '@/store/actions';
import { useToday } from '@/hooks/useToday';
import {
  STRONG_PASS_RATE,
  STRONG_PCT,
  WEAK_PCT,
  companyCoverage,
  practicePicks,
  practiceSetMinutes,
} from '@/utils/engine/companies';
import type { CompanyPatternCoverage } from '@/utils/engine/companies';
// The page quotes the same threshold the standing is computed from — a page that named its own
// number would be a second opinion about when recall counts as measured.
import { MIN_PASS_RATE_ATTEMPTS } from '@/utils/engine/stats';
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

// The claim boundary. On the detail view it leads the page on an ink rail; on the index it rides
// the context rail beside the lists it governs (below `lg` it stacks after them, still full
// strength). It used to be `text-xs` at the very bottom of the detail page, which made the most
// important sentence on the page the quietest.
const SCOPE_NOTE =
  'No company publishes the problems it asks. Every claim here is read off a page the company ' +
  'publishes itself — quoted verbatim and dated — and it never descends to the level of an ' +
  'individual problem, because no first-party source does.';

const STANDING_LABEL: Record<CompanyPatternCoverage['standing'], string> = {
  strong: 'Holding',
  unreviewed: 'Unreviewed',
  developing: 'Developing',
  gap: 'Gap',
};

// `unreviewed` is neutral ink, not the strong ink: covering a pattern and remembering it are
// different achievements, and only the second one has been demonstrated when this reads "Holding".
const STANDING_CLASS: Record<CompanyPatternCoverage['standing'], string> = {
  strong: 'text-easy',
  unreviewed: 'text-muted-foreground',
  developing: 'text-muted-foreground',
  gap: 'text-hard',
};

/** A quiet block of qualifying prose on a hairline rail — scope, dates, what was inferred. */
function Caveat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>{label}</Eyebrow>
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
  '-mx-2 flex flex-col gap-1 rounded-md px-2 py-2 transition-colors duration-150 ease-swift ' +
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
    <Screen>
      {/* No support line — the Figures census below says the same thing in numbers, one row up
          from where the sentence said it in words. */}
      <ScreenHeader eyebrow={`${COMPANIES.length} first-party sources`} title="Interview relevance" />

      {/* The set's whole shape, before any scrolling: five pages say enough to map, one says the
          opposite of what prep folklore assumes, and most say almost nothing. Computed from the
          same arrays the sections render — a hardcoded line here would be a second census. */}
      <Figures
        items={[
          { value: withTopics.length, label: 'name topics' },
          ...(avoidsPuzzles.length > 0
            ? [
                {
                  value: avoidsPuzzles.length,
                  label: avoidsPuzzles.length === 1 ? 'avoids puzzles' : 'avoid puzzles',
                },
              ]
            : []),
          { value: categoriesOnly.length, label: 'name the area only' },
        ]}
      />

      {/* The claim boundary leads the lists it governs, at every width — and it is rendered ONCE.
          It briefly rode `PageColumns`' context rail, which stacks after main below `lg`, so the
          app's central epistemic claim ("no company publishes the problems it asks") landed at the
          very bottom of the index on every phone and tablet: precisely the placement `SCOPE_NOTE`'s
          own comment records having fixed once before, and a disagreement with `CompanyDetail`,
          which leads with it. A breakpoint-duplicated pair (`lg:hidden` + `hidden lg:block`) would
          have fixed the placement by putting the sentence in the document twice, which is a worse
          answer on a page whose subject is what the app is entitled to claim.

          The horizontal composition survives as `PagePair` on the two lists below, which is the
          better pairing anyway: "companies that name topics" and "companies that name only the
          area" are two halves of one census, where the scope note is not a half of anything. */}
      {/* The census in three columns from `xl`: the scope note leads column one with the folded
          area-only tier beneath it, the mapped tier takes column two, the avoids tier column
          three. Explicit placements, because DOM order is reading order — scope note first, then
          the tiers by how much they say — and phones must stack in exactly that order. Below `xl`
          it is the two-up census it was. */}
      <ScreenBody>
        <Panel>
        <div className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-start md:gap-x-10 xl:grid-cols-3 xl:gap-8">
        <div className="xl:col-start-1 xl:row-start-1">
          <ScopeNote />
        </div>
        <Section
          className="xl:col-start-2 xl:row-start-1 xl:row-span-2"
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
            className="xl:col-start-3 xl:row-start-1 xl:row-span-2"
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
          className="xl:col-start-1 xl:row-start-2"
          title="Companies that name the area only"
          support="Their pages confirm the coding interview exists and name data structures and algorithms as an area, but never say which ones. Most companies are here. They are listed so the absence is visible rather than filled in with guesswork."
        >
          {/* The tier's finding is the absence, and the support line above already states it — the
              eleven rows beneath only repeat it eleven times. The list stays complete (which pages
              were checked is the evidence), but it folds: reading the citations is a rare errand,
              and open it cost ~970px of identical rows between the masthead and the next thing.
              The heading and its meaning stay pinned above the latch, so the tier is never
              invisible — only its roll call waits to be asked for. */}
          <Disclosure
            summary={`All ${categoriesOnly.length} companies`}
            meta={String(categoriesOnly.length)}
          >
            <RuledList className="border-y-0">
              {categoriesOnly.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </RuledList>
          </Disclosure>
        </Section>
        </div>
        </Panel>
      </ScreenBody>
    </Screen>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Detail                                                                                         */
/* --------------------------------------------------------------------------------------------- */

function UnknownCompany() {
  return (
    <Screen>
      <ScreenHeader
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
    </Screen>
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

      {/* The methodology tail: every word the page names, and what was or was not inferred from
          them. It is real evidence consulted rarely — the quote and citation above are what the
          page leads with — so it folds rather than competing with them. The summary keeps the old
          eyebrow's exact words, the count says what the latch is holding, and nothing inside is
          shortened or reworded on its way in. */}
      {company.namedTopics.length > 0 ? (
        <Disclosure
          summary="Topics named across that page"
          meta={String(company.namedTopics.length)}
        >
          <p className="text-sm leading-relaxed">{company.namedTopics.join(' · ')}</p>
          {/* The quote above is one excerpt; these are collected from the whole page. Saying so
              matters — otherwise the list reads as an expansion of the sentence above it, which
              it is not. */}
          <p className="text-xs text-muted-foreground">
            Collected from the full page, not only the sentence quoted above.
          </p>
        </Disclosure>
      ) : (
        // No named topics to summarise (Netflix is this case): a latch headed "Topics named
        // across that page" over a list that does not exist would be a label telling a lie.
        null
      )}

      {/* The caveat renders OUTSIDE the latch in both branches. It was inside the topics
          disclosure, under a summary that reads "Topics named across that page · 12" — a label
          that counts topics and silently also holds the scope caveat. On an evidence page the
          caveat is the one thing a reader must not miss, and `Page.tsx` requires a summary to be
          "a real summary", which a label naming only part of its contents is not. */}
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
      {/* Three figures: how much was mapped, how much of it is holding, how much is not. The
          fourth was the unsolved-minutes total, which the paragraph below already states — and
          states better, because there it arrives with the sentence that says it is a workload
          figure rather than a score. */}
      <Ledger
        columns={3}
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

      {/* "Holding" is the only positive claim on this page, so the page states what earns it.
          Solving is not remembering: a pattern cleared this morning and never once recalled is
          reported as unreviewed, not quietly counted as recall that is holding up. Both paragraphs
          are definitions rather than readings — what the word costs to earn, what the figure is
          not — and a definition is consulted, not re-read on every visit, so the pair folds. The
          figures they govern stay open above, and not a word changes on the way in: the fold is
          composition, never a softening of the claim. */}
      <Disclosure summary="How these figures are computed">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          A pattern only reads as holding once its recalls say so —{' '}
          <span className="figures">{MIN_PASS_RATE_ATTEMPTS}</span> graded reviews or more, at least{' '}
          <span className="figures">{Math.round(STRONG_PASS_RATE * 100)}%</span> of them passing.
          Solved but never revised is marked unreviewed instead: nothing has tested yet whether it
          stuck.
        </p>

        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          About <span className="figures">{formatMinutes(coverage.remainingMinutes)}</span> of unsolved
          material sits in these patterns. That is a workload figure, not a readiness score — this app
          has no basis for telling you whether you are ready for an interview, and will not pretend to
          by inventing one.
        </p>
      </Disclosure>

      {/* The masthead button's fine print. It lives here, not beside the button, because "these
          patterns" must point at the list above to mean anything — and never behind the
          disclosure, because what targeting will not do is the load-bearing half of the copy. */}
      <TargetNote company={company} />
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

  // Silence used to be the empty state: with every mapped question solved the section vanished,
  // which reads as a missing feature. It is a real outcome and it has a real limit — running out
  // of roadmap material inside these patterns says something about this roadmap's coverage of
  // them and nothing whatsoever about being prepared, which is a claim this page never makes.
  if (picks.length === 0) {
    return (
      <Section title="Where to start" aria-label="Practice set">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Every roadmap question inside the patterns mapped above is already solved, so there is
          nothing left here to hand you. That is a fact about this roadmap's stock of questions in
          those patterns — it is not a statement that you are prepared for {company.name}, and
          this app has no basis for making one.
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          What is left is recall. The coverage list above marks which of these patterns have
          actually been through graded reviews and which have only been solved once.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Where to start"
      support={`Unsolved roadmap questions inside the patterns mapped above, weakest area first. Each row says why it is in this set. These are not questions ${company.name} asks — nobody publishes those.`}
      aria-label="Practice set"
      // The slot held a duration, which is a figure rather than a control — so the section that
      // exists to answer "where do I start" had no way to start. The set is ordered weakest area
      // first, easiest first, so its top row is the answer and this button opens it.
      action={
        <Button size="sm" onClick={() => dispatch(activeQuestionSet(picks[0]!.question.id))}>
          Start here
        </Button>
      }
    >
      {/* The duration the action slot used to carry, said as what it is. Never a readiness
          figure: it is the authored cost of the unsolved material, and nothing else. */}
      <Meta
        items={[
          <>
            <span className="figures">{picks.length}</span> unsolved{' '}
            {picks.length === 1 ? 'question' : 'questions'}
          </>,
          <>
            about{' '}
            <span className="figures">
              {formatMinutes(practiceSetMinutes(picks.map((p) => p.question)))}
            </span>{' '}
            of work at the authored estimates
          </>,
        ]}
      />

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
  const today = useToday();
  const weakest = useAppSelector((s) => selectPatternWeakness(s, today)).slice(0, 3);

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
            {weakest.map(({ id, name }) => (
              <RuledItem key={id} className="py-0">
                <Link to={`/patterns/${id}`} className={ROW_LINK}>
                  <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                </Link>
              </RuledItem>
            ))}
          </RuledList>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            Ranked from repeated negative evidence — failed recalls, drill misses, slow solves.
            This is roadmap advice, not company advice — nothing on their page points at any of it.
          </p>
        </>
      )}
    </Section>
  );
}

/**
 * Set this company as the one being prepared for, or clear it.
 *
 * Offered only where it can do something: a target's ONLY effect is to scope practice by the
 * patterns a company's own page names, so a categories-tier company would produce a setting that
 * silently changes nothing. The button rides the masthead's action slot now — it is the page's
 * one real action, and it used to close the page as a trailing section, roughly two and a half
 * viewports below the title it acts on. The explanation travels separately (`TargetNote`, kept
 * beside the coverage list whose patterns the target scopes), because this is the surface most
 * at risk of being read as "show me their questions", which do not exist — the sentence saying
 * so must sit where "these patterns" visibly points at something.
 */
function TargetButton({ company }: { company: Company }) {
  const dispatch = useAppDispatch();
  const target = useAppSelector(selectTargetCompany);
  const isTarget = target?.id === company.id;

  return (
    <Button
      variant={isTarget ? 'outline' : 'default'}
      size="sm"
      onClick={() => dispatch(setTargetCompany(isTarget ? null : company.id))}
    >
      {isTarget ? 'Stop targeting' : `Prepare for ${company.name}`}
    </Button>
  );
}

/** What the masthead's target button will and will not do — word for word the old control's copy. */
function TargetNote({ company }: { company: Company }) {
  const target = useAppSelector(selectTargetCompany);
  const isTarget = target?.id === company.id;

  return (
    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
      {isTarget
        ? `Today carries a quiet line pointing back here while ${company.name} is your target, and an interview can be drawn from these patterns. Nothing else changes: there is still no per-problem claim to make.`
        : `Marking a target adds one line to Today and lets an interview draw from these patterns. It cannot tell you what ${company.name} asks — nobody publishes that.`}
    </p>
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

  // The reading measure, not the data-grid one. For a `categories` company — most of them — this
  // page is five blocks of pure prose, every one already capped at `max-w-prose`; the wider
  // column only moved the right-hand void around. `UnknownCompany` above was already correct.
  return (
    <Screen>
      <ScreenHeader
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
        // The page's one real action, in the slot a page-level action belongs in. It used to
        // close the page as a trailing section — the composition's worst priority inversion: the
        // only thing to DO here sat below every sentence on the page. Gated exactly as the old
        // section was — offered only where a target can do something.
        action={hasMapping ? <TargetButton company={company} /> : undefined}
      />

      {/* The claim boundary leads, then the evidence. The evidence itself scrolls in one panel:
          a company page is a document, and the brief allows a detail view to scroll — but inside
          the shell, with the masthead and the rail staying put. */}
      <ScopeNote />

      <ScreenBody>
        <Panel className="max-w-[46rem]">
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
        </Panel>
      </ScreenBody>
    </Screen>
  );
}

export default function CompaniesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return companyId ? <CompanyDetail companyId={companyId} /> : <CompanyList />;
}
