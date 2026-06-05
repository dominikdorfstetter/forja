/**
 * Astro middleware — runs on every request.
 * Sets locale context so pages don't need to detect it themselves.
 */
import { defineMiddleware } from 'astro:middleware';
import { fetchSiteLocales, type SiteLocale } from './lib/api';
import { getLocaleFromRequest } from './lib/locale';

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  let locales: SiteLocale[] = [];
  try {
    locales = await fetchSiteLocales();
  } catch {
    // Graceful fallback — no locale filtering
  }

  const current = getLocaleFromRequest(request, locales);

  (locals as unknown as Record<string, unknown>).locale = current;
  (locals as unknown as Record<string, unknown>).locales = locales;

  return next();
});
