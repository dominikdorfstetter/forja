import type { Locale, SiteLocaleResponse } from '@/types/api';

/** A site locale keyed by its global locale id: the shape editor locale tabs consume. */
export type ActiveSiteLocale = Omit<Locale, 'site_count'>;

export function toActiveSiteLocale(sl: SiteLocaleResponse): ActiveSiteLocale {
  return {
    id: sl.locale_id,
    code: sl.code,
    name: sl.name,
    native_name: sl.native_name,
    direction: sl.direction,
    is_active: sl.is_active,
    created_at: sl.created_at,
  };
}

/** The site's active locales, in site order. */
export function activeSiteLocales(siteLocales: readonly SiteLocaleResponse[] | undefined): ActiveSiteLocale[] {
  return (siteLocales ?? []).filter((sl) => sl.is_active).map(toActiveSiteLocale);
}

/** Active site locales in the global `Locale` shape; a per-site view has no `site_count`, so it is 0. */
export function activeSiteLocalesAsLocales(siteLocales: readonly SiteLocaleResponse[] | undefined): Locale[] {
  return activeSiteLocales(siteLocales).map((locale) => ({ ...locale, site_count: 0 }));
}
