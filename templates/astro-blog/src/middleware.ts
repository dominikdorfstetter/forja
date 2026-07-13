/**
 * Astro middleware — runs on every request.
 * Sets locale context so pages don't need to detect it themselves.
 */
import { defineMiddleware } from 'astro:middleware';
import { fetchSiteLocales, type SiteLocale } from './lib/api';
import { getLocaleFromRequest } from './lib/locale';

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  // Never throws — a failed fetch degrades to an empty list (no locale filtering).
  const locales: SiteLocale[] = await fetchSiteLocales();

  const current = getLocaleFromRequest(request, locales);

  (locals as unknown as Record<string, unknown>).locale = current;
  (locals as unknown as Record<string, unknown>).locales = locales;

  return next();
});
