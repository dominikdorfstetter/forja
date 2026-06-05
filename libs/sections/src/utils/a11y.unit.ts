import { describe, it, expect, vi } from 'vitest';
import { sectionId, sectionLabel } from './a11y';

describe('sectionLabel', () => {
  it('returns title when provided', () => {
    expect(sectionLabel('My Section', 'fallback')).toBe('My Section');
  });

  it('returns fallback when title is undefined', () => {
    expect(sectionLabel(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback when title is empty string', () => {
    expect(sectionLabel('', 'fallback')).toBe('fallback');
  });

  it('returns fallback when title is only whitespace', () => {
    expect(sectionLabel('   ', 'fallback')).toBe('fallback');
  });

  it('trims title whitespace', () => {
    expect(sectionLabel('  Hello World  ', 'fallback')).toBe('Hello World');
  });
});

describe('sectionId', () => {
  it('generates slug from title', () => {
    expect(sectionId('Hello World', 'section')).toBe('section-hello-world');
  });

  it('handles special characters', () => {
    expect(sectionId('FAQ & Pricing!', 'section')).toBe('section-faq-pricing');
  });

  it('strips leading and trailing hyphens from slug', () => {
    expect(sectionId('--Hello--', 'section')).toBe('section-hello');
  });

  it('generates random suffix when title is undefined', () => {
    const id = sectionId(undefined, 'section');
    expect(id).toMatch(/^section-[a-z0-9]+$/);
  });

  it('uses prefix in generated ID', () => {
    const id = sectionId(undefined, 'hero');
    expect(id).toMatch(/^hero-/);
  });

  it('random suffix is 6 chars from base-36', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const id = sectionId(undefined, 'section');
    const suffix = id.replace('section-', '');

    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[a-z0-9]+$/);

    vi.restoreAllMocks();
  });
});
