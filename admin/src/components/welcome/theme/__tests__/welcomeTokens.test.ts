import { describe, expect, it } from 'vitest';
import {
  buildWelcomeTokenCss,
  WELCOME_COLOR_TOKENS,
} from '../welcomeTokens';

/**
 * Foundation tracer (#807): the Welcome surface owns a teal OKLCH token set
 * extracted live from the brand site. Light is the default; dark overrides via
 * `prefers-color-scheme: dark`. We assert against the emitted CSS string (the
 * same seam the M3 token builder is tested through) because jsdom cannot
 * compute `var()` or evaluate media queries.
 */
describe('buildWelcomeTokenCss', () => {
  const css = buildWelcomeTokenCss();

  it('scopes every token under .welcome-surface and never leaks to :root', () => {
    expect(css).toContain('.welcome-surface');
    // Must not redefine global app tokens at :root scope.
    expect(css).not.toMatch(/(^|[^-])\broot\s*\{/);
  });

  describe('tracer: bg / fg / primary match the brand table in both modes', () => {
    it('light is the default scope', () => {
      // light defaults live in the unconditional .welcome-surface block
      const lightBlock = css.slice(0, css.indexOf('@media'));
      expect(lightBlock).toContain('--w-bg: oklch(0.99 0.005 200)');
      expect(lightBlock).toContain('--w-fg: oklch(0.2 0.02 200)');
      expect(lightBlock).toContain('--w-primary: oklch(0.6 0.09 200)');
      expect(lightBlock).toContain('color-scheme: light dark');
    });

    it('dark overrides under prefers-color-scheme: dark', () => {
      const darkIdx = css.indexOf('@media (prefers-color-scheme: dark)');
      expect(darkIdx).toBeGreaterThan(-1);
      const darkBlock = css.slice(darkIdx);
      expect(darkBlock).toContain('--w-bg: oklch(0.15 0.015 200)');
      expect(darkBlock).toContain('--w-fg: oklch(0.96 0.005 200)');
      expect(darkBlock).toContain('--w-primary: oklch(0.78 0.12 200)');
    });
  });

  it('emits the full color token set for both modes', () => {
    // Every key present in light must also be overridden in dark.
    const keys = Object.keys(WELCOME_COLOR_TOKENS.light);
    expect(keys.length).toBeGreaterThanOrEqual(13);
    for (const key of keys) {
      expect(WELCOME_COLOR_TOKENS.dark).toHaveProperty(key);
    }
  });

  it('defines the Inter / Inter Display / mono type stack and fluid scale', () => {
    expect(css).toContain('--w-font-sans');
    expect(css).toContain('"Inter"');
    expect(css).toContain('--w-font-display');
    expect(css).toContain('"Inter Display"');
    expect(css).toContain('--w-text-6xl: clamp(');
    expect(css).toContain('--w-tracking-tight');
  });

  it('defines the brand radii (pill 9999, card 12) and motif tokens', () => {
    expect(css).toContain('--w-radius-full: 9999px');
    expect(css).toContain('--w-radius-xl: 12px');
    expect(css).toContain('--w-gradient-headline');
    expect(css).toContain('linear-gradient(135deg');
    expect(css).toContain('--w-glow');
    expect(css).toContain('radial-gradient(');
  });

  it('disables animation inside the surface under prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.welcome-surface[\s\S]*animation[\s\S]*0\.01ms/);
  });
});
