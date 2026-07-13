import type {
  SiteLocaleResponse,
  TranslationStatus,
  UiStringLocalizationResponse,
  UiStringResponse,
} from '@/types/api';

export const siteLocale = (over: Partial<SiteLocaleResponse> = {}): SiteLocaleResponse => ({
  site_id: 'site-1',
  locale_id: 'loc-en',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr',
  is_active: true,
  is_default: false,
  url_prefix: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

export const localeEn = siteLocale({ locale_id: 'loc-en', code: 'en', is_default: true });
export const localeDe = siteLocale({
  locale_id: 'loc-de',
  code: 'de',
  name: 'German',
  native_name: 'Deutsch',
});
export const localeFr = siteLocale({
  locale_id: 'loc-fr',
  code: 'fr',
  name: 'French',
  native_name: 'Français',
});

export const localization = (
  id: string,
  localeId: string,
  value: string,
  status: TranslationStatus = 'Approved',
): UiStringLocalizationResponse => ({
  id,
  locale_id: localeId,
  value,
  translation_status: status,
});

export const uiString = (over: Partial<UiStringResponse> = {}): UiStringResponse => ({
  id: 'us-1',
  key: 'blog.min_read',
  localizations: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...over,
});

/** en translated, de outdated, fr missing. */
export const rowMinRead = uiString({
  id: 'us-1',
  key: 'blog.min_read',
  localizations: [
    localization('l-1', 'loc-en', 'min read'),
    localization('l-2', 'loc-de', 'Min. Lesezeit', 'Outdated'),
  ],
});

/** Fully translated in all three locales. */
export const rowFooterLinks = uiString({
  id: 'us-2',
  key: 'footer.links',
  localizations: [
    localization('l-3', 'loc-en', 'Links'),
    localization('l-4', 'loc-de', 'Links'),
    localization('l-5', 'loc-fr', 'Liens'),
  ],
});

export const problemDetails = (code: string, status: number) => ({
  type: 'about:blank',
  title: 'Error',
  status,
  code,
});
