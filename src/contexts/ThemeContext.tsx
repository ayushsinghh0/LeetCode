import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateSettings } from '@/store/actions';
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
      // Through the thunk, not the slice action: `store/actions.ts` is the only public mutation
      // API (the documented exception is the `ui` slice, which this is not). The value written
      // here is always valid, so this was convention drift rather than a live bug — but the
      // convention is what stops the next settings write from bypassing `setDailyCapacity`'s
      // range guard, and a lone exception is how that erodes.
      toggle: () => dispatch(updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })),
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
