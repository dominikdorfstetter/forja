import { describe, it, expect } from 'vitest';
import { buildTokenCss, ACCENTS, M3_DARK_SURFACES, resolveAccent } from '../m3ExpressiveTokens';
import { palettes } from '../palettes';

describe('buildTokenCss', () => {
  it('emits all required surface vars for the M3 Dark flavour', () => {
    const css = buildTokenCss('m3Dark', 'violet');
    expect(css).toContain(`--surface-dim: ${M3_DARK_SURFACES.surfaceDim}`);
    expect(css).toContain(`--surface-container: ${M3_DARK_SURFACES.container}`);
    expect(css).toContain(`--on-surface: ${M3_DARK_SURFACES.onSurface}`);
    expect(css).toContain('--outline-variant');
  });

  it('emits accent vars from the ACCENTS map', () => {
    const css = buildTokenCss('m3Dark', 'coral');
    expect(css).toContain(`--primary: ${ACCENTS.coral.primary}`);
    expect(css).toContain(`--primary-container: ${ACCENTS.coral.container}`);
    expect(css).toContain(`--on-primary-container: ${ACCENTS.coral.onContainer}`);
  });

  it('maps Catppuccin surface colours onto the same variable names', () => {
    const css = buildTokenCss('mocha', 'violet');
    expect(css).toContain('--surface-container');
    expect(css).toContain('--on-surface');
    // Accent vars still emit — but Catppuccin flavors derive the accent
    // from their own palette, so Mocha + violet resolves to Mocha's
    // mauve (#cba6f7), not M3 Dark's violet.
    expect(css).toContain(`--primary: ${palettes.mocha.mauve}`);
  });

  it('resolves the accent per flavor so each Catppuccin variant uses its own palette', () => {
    const latte = resolveAccent('latte', 'violet');
    const mocha = resolveAccent('mocha', 'violet');
    const m3 = resolveAccent('m3Dark', 'violet');
    expect(latte.primary).toBe(palettes.latte.mauve);
    expect(mocha.primary).toBe(palettes.mocha.mauve);
    expect(m3.primary).toBe('#b8a4ff');
  });

  it('picks a luminance-appropriate foreground so pale accents read with dark text', () => {
    // On light flavors, "amber" remaps from yellow (too pale for a
    // primary surface) to peach — Nord peach (#d08770, lum ~0.33) is
    // dark enough that white text reads clearly.
    const nordAmber = resolveAccent('nord', 'amber');
    expect(nordAmber.primary).toBe(palettes.nord.peach);
    expect(nordAmber.primaryC).toBe('#ffffff');

    // Latte's mauve (#8839ef) is saturated and dark — white reads well.
    const latteViolet = resolveAccent('latte', 'violet');
    expect(latteViolet.primaryC).toBe('#ffffff');

    // Mocha's pastel yellow pairs with the flavor's near-black crust.
    const mochaAmber = resolveAccent('mocha', 'amber');
    expect(mochaAmber.primary).toBe(palettes.mocha.yellow);
    expect(mochaAmber.primaryC).toBe(palettes.mocha.crust);
  });

  it('remaps light-flavor accents to darker palette hues', () => {
    // Coral on light flavors uses red (saturated); dark flavors keep peach.
    expect(resolveAccent('latte', 'coral').primary).toBe(palettes.latte.red);
    expect(resolveAccent('mocha', 'coral').primary).toBe(palettes.mocha.peach);
    // Amber on light flavors uses peach; dark flavors keep yellow.
    expect(resolveAccent('dawn', 'amber').primary).toBe(palettes.dawn.peach);
    expect(resolveAccent('frappe', 'amber').primary).toBe(palettes.frappe.yellow);
  });

  it('emits shape-morph motion, radii, and font vars', () => {
    const css = buildTokenCss('m3Dark', 'violet');
    expect(css).toContain('--motion-shape-morph');
    expect(css).toContain('--radius-md: 16px');
    expect(css).toContain('--font-mono');
    expect(css).toContain('--font-sans');
  });

  it('emits M3 expressive easing curves and duration scale', () => {
    const css = buildTokenCss('m3Dark', 'violet');
    expect(css).toContain('--easing-emphasized: cubic-bezier(0.2, 0, 0, 1)');
    expect(css).toContain('--easing-emphasized-decelerate');
    expect(css).toContain('--easing-spring: cubic-bezier(.5, 1.4, .6, 1)');
    expect(css).toContain('--dur-short-4: 200ms');
    expect(css).toContain('--dur-medium-2: 300ms');
    expect(css).toContain('--motion-fade-in-up');
    expect(css).toContain('@keyframes fadeInUp');
  });

  it('honours prefers-reduced-motion with a scoped override', () => {
    const css = buildTokenCss('m3Dark', 'violet');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms');
  });

  it('defines data-density states for comfortable and compact', () => {
    const css = buildTokenCss('m3Dark', 'violet');
    expect(css).toContain('[data-density="compact"]');
    expect(css).toContain('[data-density="comfortable"]');
  });
});
