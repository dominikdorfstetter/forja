import type { SiteLocaleResponse, UiStringResponse } from '@/types/api';

/** Per-locale value state of one UI string key, computed from rows × site locales. */
export type LocaleValueState = 'translated' | 'outdated' | 'missing';

export type CoverageFilter = 'all' | 'missing' | 'outdated';

/** Active site locales with the default locale first — tab/chip display order. */
export function orderedActiveLocales(locales: SiteLocaleResponse[]): SiteLocaleResponse[] {
  const active = locales.filter((l) => l.is_active);
  return [...active.filter((l) => l.is_default), ...active.filter((l) => !l.is_default)];
}

export function localeValueState(row: UiStringResponse, localeId: string): LocaleValueState {
  const loc = row.localizations.find((l) => l.locale_id === localeId);
  if (!loc || loc.value.length === 0) return 'missing';
  return loc.translation_status === 'Outdated' ? 'outdated' : 'translated';
}

export function hasMissingLocale(row: UiStringResponse, locales: SiteLocaleResponse[]): boolean {
  return locales.some((l) => localeValueState(row, l.locale_id) === 'missing');
}

export function hasOutdatedLocale(row: UiStringResponse, locales: SiteLocaleResponse[]): boolean {
  return locales.some((l) => localeValueState(row, l.locale_id) === 'outdated');
}

export function applyCoverageFilter(
  rows: UiStringResponse[],
  locales: SiteLocaleResponse[],
  filter: CoverageFilter,
): UiStringResponse[] {
  switch (filter) {
    case 'missing':
      return rows.filter((row) => hasMissingLocale(row, locales));
    case 'outdated':
      return rows.filter((row) => hasOutdatedLocale(row, locales));
    default:
      return rows;
  }
}
