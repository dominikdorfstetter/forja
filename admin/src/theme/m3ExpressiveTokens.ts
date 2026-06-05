/**
 * M3 Expressive design tokens.
 *
 * Surface layers, radii, motion, and typography tokens that primitives consume
 * via CSS custom properties. Emitted on :root so plain CSS (e.g. scrollbar,
 * focus ring) can consume them without needing to reach into MUI.
 *
 * Tokens resolve differently depending on the active theme flavor — the M3
 * Expressive Dark flavor uses the dark layered surfaces; Catppuccin flavors
 * map their existing surface/text colours onto the same variable names so
 * primitives that reference --surface-container work everywhere.
 */

import type { Flavor } from './palettes';
import { palettes } from './palettes';

export type Accent = 'violet' | 'coral' | 'teal' | 'amber';

export interface ResolvedAccent {
  primary: string;
  primaryC: string;
  container: string;
  onContainer: string;
}

/**
 * Fixed M3 Expressive Dark accents — these are tuned by hand for the
 * M3 dark surface layer so the container tone and on-container text
 * hit M3's contrast targets. For Catppuccin flavors we derive accents
 * from the flavor's own palette (see `resolveAccent`).
 */
export const ACCENTS: Record<Accent, ResolvedAccent> = {
  violet: { primary: '#b8a4ff', primaryC: '#2e1884', container: '#463d7a', onContainer: '#e5dfff' },
  coral: { primary: '#ffb59a', primaryC: '#5c1f00', container: '#7a3a2a', onContainer: '#ffded0' },
  teal: { primary: '#7edac6', primaryC: '#00382e', container: '#2a5a4f', onContainer: '#c8f0e5' },
  amber: { primary: '#ffc98a', primaryC: '#4a2c00', container: '#7a5a2a', onContainer: '#ffe4b8' },
};

/**
 * Maps our four accent keys to Catppuccin palette hues. Each flavor
 * ships its own tuned version of mauve / peach / teal / yellow, so the
 * picked accent always belongs to the active flavor's palette — a
 * violet under Mocha reads as Mocha's mauve (#cba6f7), under Latte as
 * Latte's mauve (#8839ef).
 *
 * LIGHT flavors remap coral → red and amber → peach so both hues stay
 * saturated enough to serve as a primary (AppBar bg, filled buttons)
 * without washing out. Yellow under Latte/Dawn/Nord is too pale to
 * carry UI surfaces that need ≥4.5:1 text; peach + red are the
 * darker, more chromatic siblings. Dark flavors keep the full
 * mauve/peach/teal/yellow spread because their pastels already read
 * well against dim surfaces.
 */
type CatppuccinHue = 'mauve' | 'peach' | 'red' | 'teal' | 'yellow';

const CATPPUCCIN_ACCENT_KEYS_DARK: Record<Accent, CatppuccinHue> = {
  violet: 'mauve',
  coral: 'peach',
  teal: 'teal',
  amber: 'yellow',
};

const CATPPUCCIN_ACCENT_KEYS_LIGHT: Record<Accent, CatppuccinHue> = {
  violet: 'mauve',
  coral: 'red',
  teal: 'teal',
  amber: 'peach',
};

const LIGHT_FLAVORS: ReadonlyArray<Flavor> = ['latte', 'dawn', 'nord'];

/**
 * Parse a hex colour (#rrggbb) into WCAG relative luminance. Used to
 * decide whether the primary is bright enough to need a dark text
 * foreground (e.g. a pastel yellow accent) or dark enough for a light
 * foreground. Returns 0..1 where 0 is black and 1 is white.
 */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const chan = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/**
 * Resolve an accent to a concrete `{ primary, primaryC, container,
 * onContainer }` given the active flavor. M3 Expressive Dark uses the
 * tuned ACCENTS map; Catppuccin flavors derive from their palette.
 *
 * - `primary` — accent hue from the flavor's palette.
 * - `primaryC` — "on-primary" foreground. Picked by luminance of the
 *   primary, NOT the flavor: a pale Nord amber (#ebcb8b) always pairs
 *   with dark text; a saturated Latte mauve (#8839ef) with white.
 *   Readability wins over stylistic consistency.
 * - `container` — muted tonal version of the accent, produced by
 *   color-mixing the accent into a flavor-appropriate surface token.
 * - `onContainer` — readable foreground on the container. On light
 *   flavors this is a darkened version of the accent so the text
 *   clears WCAG AA against the pale tint.
 */
export function resolveAccent(flavor: Flavor, accent: Accent): ResolvedAccent {
  if (flavor === 'm3Dark') return ACCENTS[accent];
  const p = palettes[flavor];
  const isLight = LIGHT_FLAVORS.includes(flavor);
  const keyMap = isLight ? CATPPUCCIN_ACCENT_KEYS_LIGHT : CATPPUCCIN_ACCENT_KEYS_DARK;
  const primary = p[keyMap[accent]];
  // Luminance-driven contrast text: 0.45 threshold keeps us on the
  // safe side of the WCAG 4.5:1 break. "Dark text" is flavor-aware —
  // light flavors use p.text (a dark blue-gray) because their crust is
  // near-white, while dark flavors use p.crust (near-black) because
  // their p.text is a light foreground. Either way we pick whichever
  // of the two has lower luminance for the active flavor.
  const darkFg = isLight ? p.text : p.crust;
  const primaryC = relativeLuminance(primary) > 0.45 ? darkFg : '#ffffff';
  // sRGB (not oklch) to avoid the hue-rotation trap when mixing a
  // warm accent (red / peach / yellow) with a surface layer that has
  // a cool blue-gray hue — oklch takes the shortest hue arc and can
  // route the result through purple. sRGB = linear channel blend,
  // so the tinted container reads as the accent hue, not its
  // complement.
  const container = isLight
    ? `color-mix(in srgb, ${primary} 22%, ${p.surface0})`
    : `color-mix(in srgb, ${primary} 22%, ${p.surface1})`;
  // On-container text must read against the pale tint on light flavors.
  // Mix with p.text in sRGB (linear channel blend) rather than oklch —
  // oklch's shortest-arc hue interpolation can rotate a warm accent
  // into purple when mixed with a blue-ish text colour.
  const onContainer = isLight
    ? `color-mix(in srgb, ${primary} 50%, ${p.text})`
    : primary;
  return { primary, primaryC, container, onContainer };
}

export const M3_DARK_SURFACES = {
  surface: '#13131a',
  surfaceDim: '#0c0c12',
  containerLowest: '#0e0e14',
  containerLow: '#181822',
  container: '#1d1d28',
  containerHigh: '#26262f',
  containerHighest: '#2f2f39',
  onSurface: '#e6e1ea',
  onSurfaceVariant: '#a59fb0',
  outline: '#3b3b46',
  outlineVariant: '#272731',
  warnContainer: '#4a3a1a',
  onWarnContainer: '#ffd8a0',
  tertiaryContainer: '#1f4026',
  onTertiaryContainer: '#b8e6c2',
  err: '#ffb4a9',
  info: '#8ec5ff',
} as const;

export const RADII = { xs: 6, sm: 10, md: 16, lg: 22, xl: 28 } as const;

export const FONTS = {
  sans: "'Roboto Flex', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/**
 * M3 Expressive motion. Emphasised curve is the signature "anticipate and
 * settle" easing — it overshoots the endpoint slightly before relaxing.
 * Standard is the flatter productivity curve used for micro-transitions
 * where overshoot would read as sloppy.
 */
export const EASING = {
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  expressiveSpring: 'cubic-bezier(.5, 1.4, .6, 1)',
} as const;

export const DURATION = {
  short1: '50ms',
  short2: '100ms',
  short3: '150ms',
  short4: '200ms',
  medium1: '250ms',
  medium2: '300ms',
  medium3: '350ms',
  medium4: '400ms',
  long1: '450ms',
  long2: '500ms',
} as const;

export const MOTION = {
  shapeMorph: `border-radius 220ms ${EASING.expressiveSpring}`,
  fadeIn: 'fadeIn 280ms cubic-bezier(0.05, 0.7, 0.1, 1) both',
  fadeInUp: 'fadeInUp 320ms cubic-bezier(0.05, 0.7, 0.1, 1) both',
  pulse: 'pulse 2s ease-in-out infinite',
  pressScale: 'transform 120ms cubic-bezier(0.2, 0, 0, 1)',
} as const;

/**
 * Map Catppuccin flavour surface colours onto the same variable names so
 * primitives that reference `--surface-container` work under any flavour.
 * Returns the CSS var string to inject via MUI's GlobalStyles.
 */
export function buildTokenCss(flavor: Flavor, accent: Accent): string {
  const p = palettes[flavor];
  const isM3Dark = flavor === ('m3Dark' as Flavor);
  const a = resolveAccent(flavor, accent);

  // Light flavors need darkened on-container foregrounds. Mix with
  // p.text in sRGB — NOT oklch, because oklch interpolates hue along
  // the shortest arc: mixing a red hue (~27°) with Latte's p.text
  // (dark blue-gray, hue ~280°) through oklch can rotate the result
  // into purple (hue 250-310°). sRGB does linear channel blending
  // so the result is predictably a darkened version of the hue
  // without drift.
  const isLightFlavor = LIGHT_FLAVORS.includes(flavor);
  const darkenForText = (hue: string) =>
    isLightFlavor ? `color-mix(in srgb, ${hue} 50%, ${p.text})` : hue;

  // Catppuccin's palette steps go LIGHT→DARK the same way on light and
  // dark flavors (surface0 darker than base, surface2 darkest of the
  // surface triad). Under light flavors that means surface-container-
  // highest jumps from base #eff1f5 all the way down to surface2
  // #acb0be — a near-white to medium-gray leap. A popover or dropdown
  // rendered at containerHighest then reads as a heavy dark card on
  // a light page. Remap the light-flavor containers to stay closer to
  // base by reusing mantle / crust / surface0 instead of advancing
  // through surface1/2. Dark flavors keep the original stepped
  // hierarchy because surface0..2 are visibly lighter than base there.
  // Smooth 0%→45% tint gradient from base toward crust gives five
  // near-white steps that are clearly distinguishable without ever
  // dropping to a medium gray. A popover at containerHighest then
  // reads as "paper card slightly below page bg" on any light flavor.
  const lightTint = (pct: number) =>
    `color-mix(in srgb, ${p.base} ${100 - pct}%, ${p.crust})`;
  const lightSurfaces = {
    containerLowest: p.base,
    containerLow: lightTint(12),
    container: lightTint(22),
    containerHigh: lightTint(32),
    containerHighest: lightTint(45),
  };
  const darkSurfaces = {
    containerLowest: p.crust,
    containerLow: p.mantle,
    container: p.surface0,
    containerHigh: p.surface1,
    containerHighest: p.surface2,
  };
  const stepped = isLightFlavor ? lightSurfaces : darkSurfaces;

  const surfaces = isM3Dark
    ? M3_DARK_SURFACES
    : {
        surface: p.base,
        surfaceDim: p.crust,
        containerLowest: stepped.containerLowest,
        containerLow: stepped.containerLow,
        container: stepped.container,
        containerHigh: stepped.containerHigh,
        containerHighest: stepped.containerHighest,
        onSurface: p.text,
        onSurfaceVariant: p.subtext0,
        outline: p.overlay0,
        outlineVariant: p.surface2,
        warnContainer: `${p.peach}26`,
        onWarnContainer: darkenForText(p.peach),
        tertiaryContainer: `${p.green}26`,
        onTertiaryContainer: darkenForText(p.green),
        err: isLightFlavor ? darkenForText(p.red) : p.red,
        info: isLightFlavor ? darkenForText(p.blue) : p.blue,
      };

  return `
    html, body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    :root {
      --surface: ${surfaces.surface};
      --surface-dim: ${surfaces.surfaceDim};
      --surface-container-lowest: ${surfaces.containerLowest};
      --surface-container-low: ${surfaces.containerLow};
      --surface-container: ${surfaces.container};
      --surface-container-high: ${surfaces.containerHigh};
      --surface-container-highest: ${surfaces.containerHighest};
      --on-surface: ${surfaces.onSurface};
      --on-surface-variant: ${surfaces.onSurfaceVariant};
      --outline: ${surfaces.outline};
      --outline-variant: ${surfaces.outlineVariant};
      --warn-container: ${surfaces.warnContainer};
      --on-warn-container: ${surfaces.onWarnContainer};
      --tertiary-container: ${surfaces.tertiaryContainer};
      --on-tertiary-container: ${surfaces.onTertiaryContainer};
      --err: ${surfaces.err};
      --info: ${surfaces.info};

      --primary: ${a.primary};
      --primary-c: ${a.primaryC};
      --primary-container: ${a.container};
      --on-primary-container: ${a.onContainer};

      --radius-xs: ${RADII.xs}px;
      --radius-sm: ${RADII.sm}px;
      --radius-md: ${RADII.md}px;
      --radius-lg: ${RADII.lg}px;
      --radius-xl: ${RADII.xl}px;

      --font-sans: ${FONTS.sans};
      --font-mono: ${FONTS.mono};

      --motion-shape-morph: ${MOTION.shapeMorph};
      --motion-fade-in: ${MOTION.fadeIn};
      --motion-fade-in-up: ${MOTION.fadeInUp};
      --motion-press-scale: ${MOTION.pressScale};

      --easing-emphasized: ${EASING.emphasized};
      --easing-emphasized-decelerate: ${EASING.emphasizedDecelerate};
      --easing-emphasized-accelerate: ${EASING.emphasizedAccelerate};
      --easing-standard: ${EASING.standard};
      --easing-spring: ${EASING.expressiveSpring};

      --dur-short-1: ${DURATION.short1};
      --dur-short-2: ${DURATION.short2};
      --dur-short-3: ${DURATION.short3};
      --dur-short-4: ${DURATION.short4};
      --dur-medium-1: ${DURATION.medium1};
      --dur-medium-2: ${DURATION.medium2};
      --dur-medium-3: ${DURATION.medium3};
      --dur-medium-4: ${DURATION.medium4};
      --dur-long-1: ${DURATION.long1};
      --dur-long-2: ${DURATION.long2};
    }

    [data-density="compact"] { --density: 0.82; }
    [data-density="comfortable"] { --density: 1; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    /* notistack: pin the toast container to the top-right regardless of
     * whether notistack's own goober-generated positioning classes have
     * loaded. In Vite production builds the goober stylesheet can end up
     * initialized after the first class names are requested, so the
     * internal styles$1.top / styles$1.right rules ship as class names
     * without matching CSS — the container falls back to its static DOM
     * position inline with the providers tree, which is exactly the
     * bottom-left corner of the sidebar area we've been seeing on
     * Railway deployments (it works on localhost because HMR re-injects
     * goober's sheet after every change). Targeting notistack's stable
     * semantic class (always applied, not hashed by goober) plus our
     * own named class guarantees the anchor sticks in both paths.
     *
     * 72px top clears the 64px AppBar + 8px gutter; 16px right keeps
     * toasts off the viewport edge; z-index 1600 lifts the container
     * above MUI Drawer (1200) and Dialog (1300). */
    .notistack-SnackbarContainer,
    .forja-snackbar-top-right {
      position: fixed !important;
      top: 72px !important;
      right: 16px !important;
      left: auto !important;
      bottom: auto !important;
      z-index: 1600 !important;
      display: flex !important;
      flex-direction: column !important;
      pointer-events: none !important;
    }
    .notistack-SnackbarContainer > *,
    .forja-snackbar-top-right > * {
      pointer-events: auto;
    }

    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--outline-variant); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--outline); }

    button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    /* SearchField surfaces focus on the wrapping label via a :focus-within
     * box-shadow ring; suppressing the inner input's native outline here
     * keeps the pill from double-painting without using inline style. */
    input.forja-search-input:focus,
    input.forja-search-input:focus-visible {
      outline-style: none;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
}
