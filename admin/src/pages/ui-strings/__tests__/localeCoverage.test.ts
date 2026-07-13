import { describe, expect, it } from 'vitest';

import {
  applyCoverageFilter,
  hasMissingLocale,
  hasOutdatedLocale,
  localeValueState,
  orderedActiveLocales,
} from '../localeCoverage';
import {
  localeDe,
  localeEn,
  localeFr,
  localization,
  rowFooterLinks,
  rowMinRead,
  siteLocale,
  uiString,
} from './fixtures';

const locales = [localeEn, localeDe, localeFr];

describe('orderedActiveLocales', () => {
  it('puts the default locale first and drops inactive locales', () => {
    const inactive = siteLocale({ locale_id: 'loc-pl', code: 'pl', is_active: false });
    const ordered = orderedActiveLocales([localeFr, inactive, localeEn, localeDe]);
    expect(ordered.map((l) => l.code)).toEqual(['en', 'fr', 'de']);
  });
});

describe('localeValueState', () => {
  it('reports translated, outdated, and missing per locale', () => {
    expect(localeValueState(rowMinRead, 'loc-en')).toBe('translated');
    expect(localeValueState(rowMinRead, 'loc-de')).toBe('outdated');
    expect(localeValueState(rowMinRead, 'loc-fr')).toBe('missing');
  });

  it('treats an empty stored value as missing', () => {
    const row = uiString({ localizations: [localization('l-9', 'loc-en', '')] });
    expect(localeValueState(row, 'loc-en')).toBe('missing');
  });
});

describe('coverage flags and filter', () => {
  it('flags rows with missing or outdated locales', () => {
    expect(hasMissingLocale(rowMinRead, locales)).toBe(true);
    expect(hasMissingLocale(rowFooterLinks, locales)).toBe(false);
    expect(hasOutdatedLocale(rowMinRead, locales)).toBe(true);
    expect(hasOutdatedLocale(rowFooterLinks, locales)).toBe(false);
  });

  it('ignores outdated localizations of locales no longer active on the site', () => {
    const row = uiString({
      localizations: [
        localization('l-1', 'loc-en', 'min read'),
        localization('l-9', 'loc-pl', 'Min. czytania', 'Outdated'),
      ],
    });
    expect(hasOutdatedLocale(row, locales)).toBe(false);
    expect(applyCoverageFilter([row], locales, 'outdated')).toEqual([]);
  });

  it('applyCoverageFilter narrows rows by missing / outdated and passes all through', () => {
    const rows = [rowMinRead, rowFooterLinks];
    expect(applyCoverageFilter(rows, locales, 'all')).toEqual(rows);
    expect(applyCoverageFilter(rows, locales, 'missing')).toEqual([rowMinRead]);
    expect(applyCoverageFilter(rows, locales, 'outdated')).toEqual([rowMinRead]);
  });
});
