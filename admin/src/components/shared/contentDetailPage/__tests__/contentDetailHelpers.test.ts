import { describe, it, expect } from 'vitest';
import { humanizeFieldName, soleLocalizedTabIndex } from '../contentDetailHelpers';
import type { ActiveLocale } from '../types';

describe('humanizeFieldName', () => {
  it('drops an _id suffix and turns separators into spaces', () => {
    expect(humanizeFieldName('cover_image_id')).toBe('Cover image');
    expect(humanizeFieldName('seo.meta_title')).toBe('Seo meta title');
  });
});

describe('soleLocalizedTabIndex', () => {
  const locales = [{ id: 'en' }, { id: 'de' }, { id: 'fr' }] as ActiveLocale[];

  it('returns the index when exactly one locale has a localization', () => {
    expect(soleLocalizedTabIndex(locales, (id) => id === 'de')).toBe(1);
  });

  it('returns -1 when none or several locales are localized', () => {
    expect(soleLocalizedTabIndex(locales, () => false)).toBe(-1);
    expect(soleLocalizedTabIndex(locales, (id) => id !== 'en')).toBe(-1);
  });
});
