/**
 * Locale utilities for the Astro template.
 */
import type { SiteLocale } from './api';

const COOKIE_NAME = 'forja_locale';

/** Read the active locale from a cookie, falling back to the site default. */
export function getLocaleFromRequest(request: Request, locales: SiteLocale[]): SiteLocale {
  const defaultLocale = locales.find((l) => l.is_default) ?? locales[0];
  if (!defaultLocale) return { locale_id: '', code: 'en', name: 'English', direction: 'ltr', is_default: true, is_active: true };

  const cookie = request.headers.get('cookie');
  if (!cookie) return defaultLocale;

  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return defaultLocale;

  return locales.find((l) => l.code === match[1]) ?? defaultLocale;
}

/**
 * Pick the best localization from an array for the given locale.
 * Falls back to the first item if the locale isn't available.
 *
 * @example
 * ```ts
 * const loc = localize(blog.localizations, Astro.locals.locale);
 * // loc.title, loc.body, loc.excerpt — resolved for the active language
 * ```
 */
export function localize<T extends { locale_id: string }>(
  items: T[],
  locale?: SiteLocale | string | null,
): T | undefined {
  if (!items || items.length === 0) return undefined;
  if (!locale) return items[0];
  const localeId = typeof locale === 'string' ? locale : locale.locale_id;
  if (!localeId) return items[0];
  return items.find((item) => item.locale_id === localeId) ?? items[0];
}

/**
 * Check if content has a localization for the given locale.
 * Use to filter lists to only show content available in the active language.
 *
 * @example
 * ```ts
 * const blogs = allBlogs.filter(b => hasLocale(b.localizations, Astro.locals.locale));
 * ```
 */
export function hasLocale<T extends { locale_id: string }>(
  items: T[],
  locale?: SiteLocale | string | null,
): boolean {
  if (!items || items.length === 0) return false;
  if (!locale) return items.length > 0;
  const localeId = typeof locale === 'string' ? locale : locale.locale_id;
  if (!localeId) return items.length > 0;
  return items.some((item) => item.locale_id === localeId);
}

/**
 * Resolve the locale code from a `SiteLocale`, plain code string, or nothing.
 * Falls back to `'en'`.
 */
export function localeCode(locale?: SiteLocale | string | null): string {
  if (!locale) return 'en';
  return typeof locale === 'string' ? locale : locale.code ?? 'en';
}

/**
 * Format a date string using the active locale.
 *
 * @example
 * ```ts
 * formatDate('2026-03-23', Astro.locals.locale); // "23. März 2026" for German
 * ```
 */
export function formatDate(
  dateStr: string,
  locale?: SiteLocale | string | null,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(dateStr).toLocaleDateString(localeCode(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...opts,
  });
}
