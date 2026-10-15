import { describe, it, expect } from 'vitest';
import type { SiteLocaleResponse } from '@/types/api';
import { activeSiteLocales, activeSiteLocalesAsLocales } from '../siteLocales';

const siteLocale = (overrides: Partial<SiteLocaleResponse>): SiteLocaleResponse => ({
  site_id: 'site-1',
  locale_id: 'loc-en',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr',
  is_active: true,
  is_default: true,
  url_prefix: null,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const siteLocales = [
  siteLocale({}),
  siteLocale({ locale_id: 'loc-de', code: 'de', is_active: false }),
  siteLocale({ locale_id: 'loc-fr', code: 'fr', is_default: false }),
];

describe('activeSiteLocales', () => {
  it('keeps only active locales, in site order, keyed by the global locale id', () => {
    expect(activeSiteLocales(siteLocales).map((l) => [l.id, l.code])).toEqual([['loc-en', 'en'], ['loc-fr', 'fr']]);
  });

  it('carries the locale fields over without site-only ones', () => {
    expect(activeSiteLocales([siteLocale({})])[0]).toEqual({
      id: 'loc-en',
      code: 'en',
      name: 'English',
      native_name: 'English',
      direction: 'Ltr',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
    });
  });

  it('returns an empty list before locales load', () => {
    expect(activeSiteLocales(undefined)).toEqual([]);
  });
});

describe('activeSiteLocalesAsLocales', () => {
  it('adds a zero site_count for the global Locale shape', () => {
    expect(activeSiteLocalesAsLocales(siteLocales).map((l) => [l.id, l.site_count])).toEqual([['loc-en', 0], ['loc-fr', 0]]);
  });
});
