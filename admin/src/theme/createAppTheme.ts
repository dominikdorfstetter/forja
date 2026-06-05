import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { type Flavor, palettes } from './palettes';
import { type Accent, resolveAccent } from './m3ExpressiveTokens';

export type ThemeId =
  | 'system'
  | 'latte'
  | 'dawn'
  | 'nord'
  | 'frappe'
  | 'macchiato'
  | 'mocha'
  | 'm3Dark';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  mode: 'light' | 'dark' | 'system';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'system', label: 'System', mode: 'system' },
  { id: 'm3Dark', label: 'M3 Expressive Dark', mode: 'dark' },
  { id: 'latte', label: 'Latte', mode: 'light' },
  { id: 'dawn', label: 'Dawn', mode: 'light' },
  { id: 'nord', label: 'Nord Light', mode: 'light' },
  { id: 'frappe', label: 'Frapp\u00e9', mode: 'dark' },
  { id: 'macchiato', label: 'Macchiato', mode: 'dark' },
  { id: 'mocha', label: 'Mocha', mode: 'dark' },
];

const ROBOTO_FLEX_FAMILY = [
  'Roboto Flex',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'sans-serif',
].join(',');

export function createAppTheme(
  flavor: Flavor,
  locale?: ThemeOptions,
  direction: 'ltr' | 'rtl' = 'ltr',
  accent: Accent = 'violet',
): Theme {
  const p = palettes[flavor];
  const lightFlavors: Flavor[] = ['latte', 'dawn', 'nord'];
  const isDark = !lightFlavors.includes(flavor);
  const resolved = resolveAccent(flavor, accent);
  const primaryMain = resolved.primary;
  const primaryContrast = resolved.primaryC;
  // Single type family across every flavor — Outfit is gone; Roboto
  // Flex is loaded with the full opsz (8..144) / wght (300..800) axes
  // so the variable-font typography tweaks apply in Catppuccin too.
  const fontFamily = ROBOTO_FLEX_FAMILY;

  const lightShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)';
  const lightShadowHover = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
  const darkShadow = '0 1px 4px 0 rgb(0 0 0 / 0.3), 0 1px 3px -1px rgb(0 0 0 / 0.2)';
  const darkShadowHover = '0 4px 8px -1px rgb(0 0 0 / 0.35), 0 2px 6px -2px rgb(0 0 0 / 0.25)';

  const shadow = isDark ? darkShadow : lightShadow;
  const shadowHover = isDark ? darkShadowHover : lightShadowHover;

  const baseTheme: ThemeOptions = {
    direction,
    transitions: {
      easing: {
        easeInOut: 'cubic-bezier(0.2, 0, 0, 1)',
        easeOut: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        easeIn: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        sharp: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: primaryMain,
        contrastText: primaryContrast,
      },
      secondary: {
        main: p.mauve,
        contrastText: isDark ? p.crust : '#ffffff',
      },
      error: {
        main: p.red,
      },
      warning: {
        main: p.peach,
      },
      info: {
        main: p.sapphire,
      },
      success: {
        main: p.green,
      },
      background: {
        default: p.base,
        paper: p.mantle,
      },
      text: {
        primary: p.text,
        secondary: p.subtext1,
        disabled: p.overlay0,
      },
      divider: p.surface0,
      action: {
        hover: isDark
          ? `${p.surface1}80`
          : `${p.surface0}80`,
        selected: isDark
          ? `${p.surface1}cc`
          : `${p.surface0}cc`,
      },
    },
    typography: {
      fontFamily,
      // Every flavor runs on Roboto Flex now, so the variable-font axes
      // apply everywhere — Catppuccin flavors benefit from the same
      // opsz / wght tuning as M3 Expressive Dark.
      h1: { fontWeight: 700, letterSpacing: -0.6, fontVariationSettings: '"wght" 700, "opsz" 40' },
      h2: { fontWeight: 700, letterSpacing: -0.5, fontVariationSettings: '"wght" 700, "opsz" 36' },
      h3: { fontWeight: 700, letterSpacing: -0.4, fontVariationSettings: '"wght" 700, "opsz" 32' },
      h4: { fontWeight: 700, letterSpacing: -0.3, fontVariationSettings: '"wght" 700, "opsz" 28' },
      h5: { fontWeight: 600, letterSpacing: -0.2, fontVariationSettings: '"wght" 600, "opsz" 24' },
      h6: { fontWeight: 600, letterSpacing: -0.1, fontVariationSettings: '"wght" 600, "opsz" 20' },
      subtitle1: { fontVariationSettings: '"wght" 500, "opsz" 16' },
      subtitle2: { fontVariationSettings: '"wght" 500, "opsz" 14' },
      body1: { fontVariationSettings: '"wght" 400, "opsz" 14' },
      body2: { fontVariationSettings: '"wght" 400, "opsz" 13' },
      button: { fontVariationSettings: '"wght" 600, "opsz" 14' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: shadow,
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: shadow,
            position: 'relative',
            transition: 'border-color 200ms cubic-bezier(0.2, 0, 0, 1)',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow: shadowHover,
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 200ms cubic-bezier(0.2, 0, 0, 1)',
            },
            '&:hover::after': {
              opacity: 1,
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '10px 16px',
          },
          sizeSmall: {
            padding: '10px 16px',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 0,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: p.mantle,
            backgroundImage: 'none',
            borderRadius: 0,
          },
        },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  };

  return locale
    ? createTheme(baseTheme, locale)
    : createTheme(baseTheme);
}
