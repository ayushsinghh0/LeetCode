import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

test('renders children when nothing throws', () => {
  render(
    <ErrorBoundary>
      <p>all good</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText('all good')).toBeInTheDocument();
});

test('a render crash shows the recovery fallback instead of a white screen', () => {
  // React logs the caught error loudly; keep the test output clean.
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Download backup/ })).toBeInTheDocument();

  errorSpy.mockRestore();
});
