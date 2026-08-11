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
  // resolution can exceed findBy's 1s default on a loaded machine.
  expect(await screen.findByText(/DSA Roadmap/i, undefined, { timeout: 5000 })).toBeInTheDocument();
});
