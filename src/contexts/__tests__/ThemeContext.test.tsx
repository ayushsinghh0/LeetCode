import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeStore } from '@/store/store';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function renderWithProviders() {
  const store = makeStore();
  render(
    <Provider store={store}>
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    </Provider>,
  );
  return store;
}

beforeEach(() => {
  document.documentElement.classList.remove('dark', 'light');
});

test('applies the dark class to documentElement for the default theme', () => {
  renderWithProviders();
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.documentElement.classList.contains('light')).toBe(false);
  expect(screen.getByTestId('theme-value').textContent).toBe('dark');
});

test('toggle() flips the theme, the settings slice, and the documentElement class', () => {
  const store = renderWithProviders();

  fireEvent.click(screen.getByText('toggle'));

  expect(store.getState().settings.theme).toBe('light');
  expect(screen.getByTestId('theme-value').textContent).toBe('light');
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(document.documentElement.classList.contains('dark')).toBe(false);

  fireEvent.click(screen.getByText('toggle'));

  expect(store.getState().settings.theme).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.documentElement.classList.contains('light')).toBe(false);
});

test('useTheme() throws when used outside of a ThemeProvider', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<ThemeProbe />)).toThrow();
  errorSpy.mockRestore();
});
