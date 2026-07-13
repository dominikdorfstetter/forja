/**
 * Chrome-string translation for the template (UI Strings module).
 *
 * Resolution chain per key: CMS value (site's UI Strings dictionary) →
 * template per-locale default JSON → key literal. The default JSONs in
 * `src/i18n/defaults/` double as the documented key list for site operators.
 *
 * Usage in any .astro frontmatter:
 * ```ts
 * const t = await getTranslator(Astro.locals.locale);
 * ```
 * The CMS map is fetched once per locale per build/process (cached in
 * `fetchUiStrings`), never once per `t()` call.
 */
import { fetchUiStrings } from './api';
import type { SiteLocale } from './api';
import { localeCode } from './locale';
import ar from '../i18n/defaults/ar.json';
import de from '../i18n/defaults/de.json';
import deAT from '../i18n/defaults/de-AT.json';
import en from '../i18n/defaults/en.json';
import es from '../i18n/defaults/es.json';
import fr from '../i18n/defaults/fr.json';
import it from '../i18n/defaults/it.json';
import nl from '../i18n/defaults/nl.json';
import pl from '../i18n/defaults/pl.json';
import pt from '../i18n/defaults/pt.json';
import uk from '../i18n/defaults/uk.json';

type UiStringMap = Record<string, string>;

const DEFAULTS: Record<string, UiStringMap> = {
  ar,
  de,
  'de-AT': deAT,
  en,
  es,
  fr,
  it,
  nl,
  pl,
  pt,
  uk,
};

/** Resolves a chrome-string key to its display text. */
export type Translator = (key: string) => string;

/**
 * Template defaults for a locale code: English base, overlaid with the
 * base language (`de` for `de-AT`), overlaid with the exact code.
 */
export function defaultsForLocale(code: string): UiStringMap {
  return { ...en, ...DEFAULTS[code.split('-')[0]], ...DEFAULTS[code] };
}

/**
 * Build a `t(key)` translator for the active locale. Fetches the site's
 * UI-string map once (cached per locale) and closes over it, so calls are
 * synchronous lookups: CMS value → template default → key literal.
 * Degrades gracefully — a failed fetch just means defaults everywhere.
 */
export async function getTranslator(
  locale?: SiteLocale | string | null,
): Promise<Translator> {
  const code = localeCode(locale);
  const cms = await fetchUiStrings(code);
  const defaults = defaultsForLocale(code);
  return (key) => cms[key] ?? defaults[key] ?? key;
}
