import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { makeStore } from '@/store/store';
import App from '@/App';

test('app renders', async () => {
  render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  );
  // Generous timeout: the dashboard chunk is lazy-loaded, and under a fully parallel suite its
  // resolution can exceed findBy's 1s default on a loaded machine. 8000 matches routes.test.tsx's
  // CHUNK_TIMEOUT — first shell mounts were observed taking >5s at peak worker contention.
  expect(await screen.findByText(/DSA Roadmap/i, undefined, { timeout: 8000 })).toBeInTheDocument();
});
