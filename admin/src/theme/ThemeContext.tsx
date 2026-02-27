import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { enUS, deDE, frFR, esES, itIT, ptPT, nlNL, plPL } from '@mui/material/locale';
import { type Flavor } from './palettes';
import { type ThemeId, type ThemeOption, THEME_OPTIONS, createAppTheme } from './createAppTheme';

const MUI_LOCALES: Record<string, ThemeOptions> = {
  en: enUS,
  de: deDE,
  fr: frFR,
  es: esES,
  it: itIT,
  pt: ptPT,
  nl: nlNL,
  pl: plPL,
};

const STORAGE_KEY = 'theme-preference';

interface ThemeModeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  resolvedFlavor: Flavor;
  options: ThemeOption[];
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_OPTIONS.some((o) => o.id === stored)) {
      return stored as ThemeId;
    }
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const { i18n } = useTranslation();

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  };

  const resolvedFlavor: Flavor = useMemo(() => {
    if (themeId === 'system') {
      return prefersDark ? 'mocha' : 'latte';
    }
    return themeId as Flavor;
  }, [themeId, prefersDark]);

  const langBase = i18n.language?.split('-')[0] || 'en';
  const muiLocale = MUI_LOCALES[langBase] || MUI_LOCALES.en;
  const theme = useMemo(() => createAppTheme(resolvedFlavor, muiLocale), [resolvedFlavor, muiLocale]);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme.palette.mode;
  }, [theme.palette.mode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({ themeId, setThemeId, resolvedFlavor, options: THEME_OPTIONS }),
    [themeId, resolvedFlavor],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
}
