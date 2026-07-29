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
  expect(await screen.findByText(/DSA Roadmap/i)).toBeInTheDocument();
});
