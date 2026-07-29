import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import type { SettingsState } from '@/types';

type Theme = SettingsState['theme'];

interface ThemeContextValue {
  theme: Theme;
  toggle(): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppSelector((state) => state.settings.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggle: () => dispatch(settingsUpdated({ theme: theme === 'dark' ? 'light' : 'dark' })),
    }),
    [theme, dispatch],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
