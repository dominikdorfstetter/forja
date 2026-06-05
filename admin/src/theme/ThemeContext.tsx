import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import type { ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { enUS, deDE, frFR, esES, itIT, ptPT, nlNL, plPL, arEG, ukUA } from '@mui/material/locale';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { type Flavor, palettes } from './palettes';
import { type ThemeId, type ThemeOption, THEME_OPTIONS, createAppTheme } from './createAppTheme';
import { type Accent, buildTokenCss } from './m3ExpressiveTokens';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cspNonce } from '@/utils/cspNonce';

const MUI_LOCALES: Record<string, ThemeOptions> = {
  en: enUS,
  de: deDE,
  'de-AT': deDE,
  fr: frFR,
  es: esES,
  it: itIT,
  pt: ptPT,
  nl: nlNL,
  pl: plPL,
  uk: ukUA,
  ar: arEG,
};

const RTL_LANGUAGES: Set<string> = new Set(
  SUPPORTED_LANGUAGES.filter((l) => 'dir' in l && l.dir === 'rtl').map((l) => l.code),
);

// Emotion caches: one for LTR (default), one for RTL (with stylis RTL plugin).
// Must include the CSP nonce so injected <style> tags satisfy Content-Security-Policy.
const ltrCache = createCache({ key: 'mui', nonce: cspNonce });
const rtlCache = createCache({ key: 'muirtl', nonce: cspNonce, stylisPlugins: [prefixer, rtlPlugin] });

const STORAGE_KEY = 'theme-preference';
const ACCENT_STORAGE_KEY = 'forja:accent';
const DENSITY_STORAGE_KEY = 'forja:density';

export type Density = 'comfortable' | 'compact';

const VALID_ACCENTS: readonly Accent[] = ['violet', 'coral', 'teal', 'amber'];
const VALID_DENSITIES: readonly Density[] = ['comfortable', 'compact'];

interface ThemeModeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  resolvedFlavor: Flavor;
  options: ThemeOption[];
  accent: Accent;
  setAccent: (a: Accent) => void;
  density: Density;
  setDensity: (d: Density) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readStored<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored && (valid as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // localStorage unavailable
  }
  return fallback;
}

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

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable — noop
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);
  const [accent, setAccentState] = useState<Accent>(() => readStored(ACCENT_STORAGE_KEY, VALID_ACCENTS, 'violet'));
  const [density, setDensityState] = useState<Density>(() =>
    readStored(DENSITY_STORAGE_KEY, VALID_DENSITIES, 'comfortable'),
  );
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const { i18n } = useTranslation();

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    persist(STORAGE_KEY, id);
  };

  const setAccent = (a: Accent) => {
    setAccentState(a);
    persist(ACCENT_STORAGE_KEY, a);
  };

  const setDensity = (d: Density) => {
    setDensityState(d);
    persist(DENSITY_STORAGE_KEY, d);
  };

  const resolvedFlavor: Flavor = useMemo(() => {
    if (themeId === 'system') {
      return prefersDark ? 'm3Dark' : 'latte';
    }
    return themeId as Flavor;
  }, [themeId, prefersDark]);

  const isRtl = RTL_LANGUAGES.has(i18n.language);
  const muiLocale = MUI_LOCALES[i18n.language] || MUI_LOCALES[i18n.language?.split('-')[0]] || MUI_LOCALES.en;
  const theme = useMemo(
    () => createAppTheme(resolvedFlavor, muiLocale, isRtl ? 'rtl' : 'ltr', accent),
    [resolvedFlavor, muiLocale, isRtl, accent],
  );

  // Sync document direction for native HTML/CSS layout
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme.palette.mode;
  }, [theme.palette.mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = palettes[resolvedFlavor].mantle;
    }
  }, [resolvedFlavor]);

  const tokenCss = useMemo(() => buildTokenCss(resolvedFlavor, accent), [resolvedFlavor, accent]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      themeId,
      setThemeId,
      resolvedFlavor,
      options: THEME_OPTIONS,
      accent,
      setAccent,
      density,
      setDensity,
    }),
    [themeId, resolvedFlavor, accent, density],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <CacheProvider value={isRtl ? rtlCache : ltrCache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={tokenCss} />
          {children}
        </ThemeProvider>
      </CacheProvider>
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
