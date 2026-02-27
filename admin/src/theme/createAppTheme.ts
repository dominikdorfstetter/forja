import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { type Flavor, palettes } from './palettes';

export type ThemeId = 'system' | 'latte' | 'dawn' | 'nord' | 'frappe' | 'macchiato' | 'mocha';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  mode: 'light' | 'dark' | 'system';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'system', label: 'System', mode: 'system' },
  { id: 'latte', label: 'Latte', mode: 'light' },
  { id: 'dawn', label: 'Dawn', mode: 'light' },
  { id: 'nord', label: 'Nord Light', mode: 'light' },
  { id: 'frappe', label: 'Frapp\u00e9', mode: 'dark' },
  { id: 'macchiato', label: 'Macchiato', mode: 'dark' },
  { id: 'mocha', label: 'Mocha', mode: 'dark' },
];

const FONT_FAMILY = [
  'Outfit',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
].join(',');

export function createAppTheme(flavor: Flavor, locale?: ThemeOptions): Theme {
  const p = palettes[flavor];
  const lightFlavors: Flavor[] = ['latte', 'dawn', 'nord'];
  const isDark = !lightFlavors.includes(flavor);

  const lightShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)';
  const lightShadowHover = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
  const darkShadow = '0 1px 4px 0 rgb(0 0 0 / 0.3), 0 1px 3px -1px rgb(0 0 0 / 0.2)';
  const darkShadowHover = '0 4px 8px -1px rgb(0 0 0 / 0.35), 0 2px 6px -2px rgb(0 0 0 / 0.25)';

  const shadow = isDark ? darkShadow : lightShadow;
  const shadowHover = isDark ? darkShadowHover : lightShadowHover;

  const baseTheme: ThemeOptions = {
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: p.blue,
        contrastText: isDark ? p.crust : '#ffffff',
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
      fontFamily: FONT_FAMILY,
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
            transition: 'box-shadow 200ms ease, transform 200ms ease',
            '&:hover': {
              boxShadow: shadowHover,
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
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: p.mantle,
            backgroundImage: 'none',
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
