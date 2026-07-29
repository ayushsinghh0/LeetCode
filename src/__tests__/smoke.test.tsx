import { render, screen } from '@testing-library/react';
import App from '@/App';

test('app renders', () => {
  render(<App />);
  expect(screen.getByText(/DSA Roadmap/i)).toBeInTheDocument();
});
