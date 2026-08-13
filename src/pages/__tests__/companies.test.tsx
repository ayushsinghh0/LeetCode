import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { makeStore } from '@/store/store';
import CompaniesPage from '@/pages/CompaniesPage';
import { reviseQuestion, solveQuestion } from '@/store/actions';
import { COMPANIES, EVIDENCE_LABEL, EVIDENCE_MEANING } from '@/data/companies';
import type { AppStore } from '@/store/store';

// The shared helper mounts a MemoryRouter at "/", but these surfaces are route-parameterised —
// so this file wires its own router with the :companyId param in place.
function renderAt(path: string, store: AppStore = makeStore()) {
  render(
    <Provider store={store}>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/companies/:companyId" element={<CompaniesPage />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </Provider>,
  );
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CompaniesPage — the list', () => {
  test('groups companies by what their own page actually says', () => {
    renderAt('/companies');

    expect(
      screen.getByRole('heading', { name: 'Companies that name specific topics' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Companies that name the area only' }),
    ).toBeInTheDocument();
    // A company saying it does not ask puzzles is not "publishing less" — it is publishing the
    // most decision-changing fact in the set, so it gets its own group rather than the footer.
    expect(
      screen.getByRole('heading', { name: 'Companies that say they avoid puzzles' }),
    ).toBeInTheDocument();
  });

  test('every company is listed exactly once, and cites the page being quoted', () => {
    renderAt('/companies');

    for (const company of COMPANIES) {
      const links = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === `/companies/${company.id}`);
      expect(links).toHaveLength(1);
      // "Google Careers — Software Engineer interview prep guide" is checkable; "Google" is a brand.
      expect(within(links[0]!).getByText(company.sourceLabel)).toBeInTheDocument();
    }
  });

  test('states the scope limit up front rather than in a footnote', () => {
    renderAt('/companies');
    expect(screen.getByText(/No company publishes the problems it asks/)).toBeInTheDocument();
  });
});

describe('CompaniesPage — evidence-aware wording', () => {
  test('every company page names its evidence tier and what that tier means', () => {
    for (const company of COMPANIES) {
      renderAt(`/companies/${company.id}`);
      expect(screen.getByText(new RegExp(EVIDENCE_LABEL[company.evidence]))).toBeInTheDocument();
      expect(screen.getByText(EVIDENCE_MEANING[company.evidence])).toBeInTheDocument();
      cleanup();
    }
  });

  test('the claim boundary leads every company page instead of trailing it', () => {
    for (const company of COMPANIES) {
      renderAt(`/companies/${company.id}`);
      expect(screen.getByText(/No company publishes the problems it asks/)).toBeInTheDocument();
      cleanup();
    }
  });

  // The single most important rule in the repo's data model, asserted against the rendered DOM
  // rather than against the dataset: no surface may state or imply that a company asks a problem.
  test('no company page ever phrases a per-problem association', () => {
    const forbidden = [
      /\basked by\b/i,
      /\basked at\b/i,
      /\bcommonly asked\b/i,
      /\bfrequently asked\b/i,
      /\btop questions\b/i,
      /\bmost asked\b/i,
    ];

    for (const company of COMPANIES) {
      renderAt(`/companies/${company.id}`);
      const text = document.body.textContent ?? '';
      for (const pattern of forbidden) {
        expect(text).not.toMatch(pattern);
      }
      cleanup();
    }
  });
});

describe('CompaniesPage — a company with topic-level evidence', () => {
  test('shows the verbatim quote, the cited page, the checked date, and a link to the source', () => {
    const google = COMPANIES.find((c) => c.id === 'google')!;
    renderAt('/companies/google');

    const source = screen.getByRole('region', { name: 'Source' });
    expect(within(source).getByText(google.quote)).toBeInTheDocument();
    expect(within(source).getByText(google.sourceLabel)).toBeInTheDocument();
    expect(within(source).getByText(`checked ${google.checkedAt}`)).toBeInTheDocument();
    expect(within(source).getByRole('link', { name: /Read their page/ })).toHaveAttribute(
      'href',
      google.url,
    );
  });

  test("coverage counts the learner's own solves against the mapped patterns", () => {
    const store = makeStore();
    // Question 1 is two-pointers, which Google's mapping does NOT include; question 231
    // onwards covers other patterns. Use a pattern Google names: stacks.
    renderAt('/companies/google', store);

    const coverage = screen.getByRole('region', { name: 'Your coverage' });
    expect(within(coverage).getByText(/0 \/ \d+ solved/)).toBeInTheDocument();
  });

  test('the workload figure is explicitly not a readiness score', () => {
    renderAt('/companies/google');
    expect(screen.getByText(/not a readiness score/)).toBeInTheDocument();
  });

  test('the practice set disclaims that these are not the company\'s questions', () => {
    renderAt('/companies/google');
    const practice = screen.getByRole('region', { name: 'Practice set' });
    expect(within(practice).getByText(/These are not questions Google asks/)).toBeInTheDocument();
  });

  test('every practice row says why it is there, and the reason is the topic mapping', () => {
    renderAt('/companies/google');
    const practice = screen.getByRole('region', { name: 'Practice set' });

    const rows = within(practice).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(within(row).getByText(/mapped from a topic they name/)).toBeInTheDocument();
    }
  });

  test('solving moves the coverage count', () => {
    const store = makeStore();
    // #231 "Basic Calculator" is the first stacks question — a pattern Google names.
    store.dispatch(solveQuestion(231));
    renderAt('/companies/google', store);

    const coverage = screen.getByRole('region', { name: 'Your coverage' });
    expect(within(coverage).getByText(/1 \/ \d+ solved/)).toBeInTheDocument();
  });
});

describe('CompaniesPage — companies without mapped patterns', () => {
  test('a categories-only company gets no pattern mapping and says why', () => {
    renderAt('/companies/amazon');

    expect(screen.getByRole('heading', { name: 'No pattern mapping' })).toBeInTheDocument();
    expect(screen.getByText(/does not invent the difference/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your coverage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Practice set' })).not.toBeInTheDocument();
  });

  test('a categories-only company still offers somewhere to put the time, labelled as roadmap advice', () => {
    const store = makeStore();
    // Weakness needs repeated NEGATIVE evidence, not merely activity: solving three questions
    // says nothing about what is failing. Two failed recalls on the same question are what make a
    // pattern nameable. (This fixture used to be three plain solves, which ranked under the old
    // coverage blend — the formula that could call a 100%-solved pattern "weakest".)
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));
    store.dispatch(solveQuestion(3));
    vi.setSystemTime(new Date('2026-07-31T12:00:00'));
    store.dispatch(reviseQuestion(1, false));
    vi.setSystemTime(new Date('2026-08-01T12:00:00'));
    store.dispatch(reviseQuestion(1, false));
    vi.setSystemTime(new Date('2026-08-02T12:00:00'));
    renderAt('/companies/amazon', store);

    const where = screen.getByRole('region', { name: 'Where to put the time' });
    expect(within(where).getByRole('list', { name: 'Your weakest patterns' })).toBeInTheDocument();
    expect(within(where).getByText(/roadmap advice, not company advice/)).toBeInTheDocument();
  });

  test('with no negative evidence the fallback says so instead of ranking nothing', () => {
    const store = makeStore();
    // Solves alone must NOT produce a weakness ranking — unmeasured is not weak.
    store.dispatch(solveQuestion(1));
    store.dispatch(solveQuestion(2));
    store.dispatch(solveQuestion(3));
    renderAt('/companies/amazon', store);
    const where = screen.getByRole('region', { name: 'Where to put the time' });
    expect(within(where).getByText(/Not enough practice yet to rank your patterns/)).toBeInTheDocument();
  });

  test('a company that says it avoids puzzles is reported as such, not padded', () => {
    renderAt('/companies/netflix');

    expect(screen.getByText(/do not ask algorithm puzzles/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your coverage' })).not.toBeInTheDocument();
    // No weakest-pattern fallback here: their own words say pattern drilling is the wrong
    // optimisation, and offering it anyway would contradict the page's own headline finding.
    expect(screen.queryByRole('region', { name: 'Where to put the time' })).not.toBeInTheDocument();
  });

  test('an unknown company id fails closed instead of inventing an entry', () => {
    renderAt('/companies/definitely-not-real');
    expect(screen.getByRole('heading', { name: 'Unknown company' })).toBeInTheDocument();
  });
});

describe('CompaniesPage — problems a first-party page names', () => {
  const linkedin = COMPANIES.find((c) => c.id === 'linkedin')!;

  test('the dataset still has exactly one entry with named problems', () => {
    // If this ever changes, the surface below needs re-reading, not just re-testing.
    const withNamed = COMPANIES.filter((c) => (c.namedProblems?.length ?? 0) > 0);
    expect(withNamed.map((c) => c.id)).toEqual(['linkedin']);
  });

  test('renders each string exactly as the source phrases it', () => {
    renderAt('/companies/linkedin');
    const region = screen.getByRole('region', { name: 'Named problems' });
    for (const problem of linkedin.namedProblems!) {
      expect(within(region).getByText(problem)).toBeInTheDocument();
    }
  });

  test('the scope note renders alongside, never behind a disclosure', () => {
    renderAt('/companies/linkedin');
    const region = screen.getByRole('region', { name: 'Named problems' });

    expect(within(region).getByText(linkedin.namedProblemsNote!)).toBeInTheDocument();
    expect(region.querySelector('details')).toBeNull();
    expect(region.querySelector('[hidden]')).toBeNull();
  });

  test('named problems are never mapped onto a roadmap question', () => {
    renderAt('/companies/linkedin');
    const region = screen.getByRole('region', { name: 'Named problems' });

    // Nothing in this block is clickable: a link or a button here would be a mapping.
    expect(within(region).queryByRole('link')).toBeNull();
    expect(within(region).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Practice set' })).not.toBeInTheDocument();
  });
});
