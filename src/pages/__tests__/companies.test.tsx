import { screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { render } from '@testing-library/react';
import { makeStore } from '@/store/store';
import CompaniesPage from '@/pages/CompaniesPage';
import { solveQuestion } from '@/store/actions';
import { COMPANIES } from '@/data/companies';
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
  test('separates companies that publish topics from those that publish less', () => {
    renderAt('/companies');

    expect(screen.getByRole('heading', { name: 'Companies that name specific topics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Companies that publish less' })).toBeInTheDocument();

    const withTopics = COMPANIES.filter((c) => c.evidence === 'topics');
    for (const company of withTopics) {
      expect(screen.getByRole('link', { name: new RegExp(company.name) })).toBeInTheDocument();
    }
  });

  test('states the scope limit up front rather than in a footnote', () => {
    renderAt('/companies');
    expect(screen.getByText(/No company publishes the problems it asks/)).toBeInTheDocument();
  });
});

describe('CompaniesPage — a company with topic-level evidence', () => {
  test('shows the verbatim quote, the checked date, and a link to the source', () => {
    const google = COMPANIES.find((c) => c.id === 'google')!;
    renderAt('/companies/google');

    const source = screen.getByRole('region', { name: 'Source' });
    expect(within(source).getByText(google.quote)).toBeInTheDocument();
    expect(within(source).getByText(`checked ${google.checkedAt}`)).toBeInTheDocument();
    expect(within(source).getByRole('link', { name: /Read their page/ })).toHaveAttribute('href', google.url);
  });

  test('coverage counts the learner\'s own solves against the mapped patterns', () => {
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

  test('solving moves the coverage count', () => {
    const store = makeStore();
    // #231 "Basic Calculator" is the first stacks question — a pattern Google names.
    store.dispatch(solveQuestion(231));
    renderAt('/companies/google', store);

    const coverage = screen.getByRole('region', { name: 'Your coverage' });
    expect(within(coverage).getByText(/1 \/ \d+ solved/)).toBeInTheDocument();
  });
});

describe('CompaniesPage — companies without topic-level evidence', () => {
  test('a categories-only company gets no pattern mapping and says why', () => {
    renderAt('/companies/amazon');

    expect(screen.getByRole('heading', { name: 'No pattern mapping' })).toBeInTheDocument();
    expect(screen.getByText(/does not invent the difference/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your coverage' })).not.toBeInTheDocument();
  });

  test('a company that says it avoids puzzles is reported as such, not padded', () => {
    renderAt('/companies/netflix');

    expect(screen.getByText(/do not ask algorithm puzzles/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your coverage' })).not.toBeInTheDocument();
  });

  test('an unknown company id fails closed instead of inventing an entry', () => {
    renderAt('/companies/definitely-not-real');
    expect(screen.getByRole('heading', { name: 'Unknown company' })).toBeInTheDocument();
  });
});
