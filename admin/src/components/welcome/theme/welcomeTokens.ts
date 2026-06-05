/**
 * Welcome-surface design tokens — extracted from the dorfstetter.at brand
 * site, teal hue 200.
 *
 * These are intentionally decoupled from the admin M3/Catppuccin theme: every
 * token is prefixed `--w-` and scoped to `.welcome-surface`, so the signed-out
 * marketing surface owns its own palette regardless of the dashboard theme.
 *
 * Light is the default (`.welcome-surface`); dark overrides via
 * `prefers-color-scheme: dark`, mirroring the brand site exactly.
 *
 * Tested through the emitted CSS string (see __tests__/welcomeTokens.test.ts) —
 * the same seam the M3 token builder uses, since jsdom cannot compute `var()`.
 */

export type WelcomeColorToken =
  | 'bg'
  | 'bg-elevated'
  | 'bg-overlay'
  | 'fg'
  | 'fg-muted'
  | 'fg-subtle'
  | 'border'
  | 'border-strong'
  | 'primary'
  | 'primary-hover'
  | 'primary-fg'
  | 'primary-soft'
  | 'primary-light'
  | 'ring';

type ColorMap = Record<WelcomeColorToken, string>;

/** Exact OKLCH values pulled from the brand site's `@layer tokens`. */
export const WELCOME_COLOR_TOKENS: { light: ColorMap; dark: ColorMap } = {
  light: {
    bg: 'oklch(0.99 0.005 200)',
    'bg-elevated': 'oklch(1 0 0)',
    'bg-overlay': 'oklch(0.2 0.02 200 / 0.55)',
    fg: 'oklch(0.2 0.02 200)',
    'fg-muted': 'oklch(0.42 0.02 200)',
    'fg-subtle': 'oklch(0.58 0.02 200)',
    border: 'oklch(0.88 0.01 200)',
    'border-strong': 'oklch(0.7 0.02 200)',
    primary: 'oklch(0.6 0.09 200)',
    'primary-hover': 'oklch(0.52 0.1 200)',
    'primary-fg': 'oklch(0.99 0 0)',
    'primary-soft': 'oklch(0.95 0.04 200)',
    'primary-light': 'oklch(0.68 0.09 200)',
    ring: 'oklch(0.6 0.09 200)',
  },
  dark: {
    bg: 'oklch(0.15 0.015 200)',
    'bg-elevated': 'oklch(0.21 0.02 200)',
    'bg-overlay': 'oklch(0 0 0 / 0.65)',
    fg: 'oklch(0.96 0.005 200)',
    'fg-muted': 'oklch(0.72 0.015 200)',
    'fg-subtle': 'oklch(0.55 0.02 200)',
    border: 'oklch(0.32 0.018 200)',
    'border-strong': 'oklch(0.5 0.025 200)',
    primary: 'oklch(0.78 0.12 200)',
    'primary-hover': 'oklch(0.85 0.12 200)',
    'primary-fg': 'oklch(0.15 0.01 200)',
    'primary-soft': 'oklch(0.3 0.06 200)',
    'primary-light': 'oklch(0.82 0.12 200)',
    ring: 'oklch(0.82 0.12 200)',
  },
};

/** Non-color scale tokens — shared across both modes. */
const SCALE: Record<string, string> = {
  'font-sans':
    '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  'font-display': '"Inter Display", "Inter", system-ui, -apple-system, sans-serif',
  'font-mono': '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'text-xs': '0.75rem',
  'text-sm': '0.875rem',
  'text-base': '1rem',
  'text-lg': '1.125rem',
  'text-xl': 'clamp(1.2rem, 1.15rem + 0.25vw, 1.3rem)',
  'text-2xl': 'clamp(1.4rem, 1.25rem + 0.7vw, 1.65rem)',
  'text-3xl': 'clamp(1.75rem, 1.45rem + 1.4vw, 2.15rem)',
  'text-4xl': 'clamp(2.25rem, 1.75rem + 2.3vw, 3rem)',
  'text-5xl': 'clamp(2.75rem, 2rem + 3.4vw, 4rem)',
  'text-6xl': 'clamp(3.25rem, 2.3rem + 4.5vw, 5rem)',
  'leading-tight': '1.1',
  'leading-snug': '1.25',
  'leading-base': '1.6',
  'leading-loose': '1.8',
  'tracking-tight': '-0.025em',
  'tracking-snug': '-0.015em',
  'tracking-base': '0',
  'tracking-wide': '0.05em',
  'tracking-wider': '0.12em',
  'radius-xs': '3px',
  'radius-sm': '4px',
  'radius-md': '6px',
  'radius-lg': '8px',
  'radius-xl': '12px',
  'radius-2xl': '16px',
  'radius-full': '9999px',
  'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
};

/** Decorative motifs, expressed in terms of the color tokens above. */
const MOTIFS: Record<string, string> = {
  'gradient-headline':
    'linear-gradient(135deg, var(--w-fg) 0%, var(--w-fg) 40%, var(--w-primary) 100%)',
  glow:
    'radial-gradient(80% 50% at 50% -10%, color-mix(in oklch, var(--w-primary) 12%, transparent) 0%, transparent 60%)',
  orb:
    'conic-gradient(from 0deg, color-mix(in oklch, var(--w-primary) 40%, transparent), transparent 35%, color-mix(in oklch, var(--w-primary) 22%, transparent) 70%, transparent)',
};

const declare = (entries: Record<string, string>, prefix = '--w-') =>
  Object.entries(entries)
    .map(([k, v]) => `  ${prefix}${k}: ${v};`)
    .join('\n');

const colorDecls = (map: ColorMap) => declare(map);

/**
 * Build the scoped CSS string for the Welcome surface. Light defaults live on
 * `.welcome-surface`; dark is a `prefers-color-scheme` override; a
 * `prefers-reduced-motion` block neutralises animation inside the surface.
 */
export function buildWelcomeTokenCss(): string {
  return `
.welcome-surface {
  color-scheme: light dark;
${declare(SCALE)}
${declare(MOTIFS)}
${colorDecls(WELCOME_COLOR_TOKENS.light)}
  background: var(--w-bg);
  color: var(--w-fg);
  font-family: var(--w-font-sans);
  font-size: var(--w-text-base);
  line-height: var(--w-leading-base);
  -webkit-font-smoothing: antialiased;
}

@media (prefers-color-scheme: dark) {
  .welcome-surface {
${colorDecls(WELCOME_COLOR_TOKENS.dark)}
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-surface *,
  .welcome-surface *::before,
  .welcome-surface *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`.trim();
}
