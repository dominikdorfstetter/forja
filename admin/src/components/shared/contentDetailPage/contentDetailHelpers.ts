import type { ActiveLocale } from './types';

/** Fallback label for the changed-fields popover: "cover_image_id" → "Cover image". */
export function humanizeFieldName(name: string): string {
  const words = name.replace(/_id$/, '').replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Content entities all carry an `id`; the harness is generic over their shape. */
export function entityIdOf(entity: unknown): string {
  return (entity as { id: string }).id;
}

/**
 * Index of the only locale tab that already has a localization, or -1 when
 * none or several do — used to auto-open the tab with the content.
 */
export function soleLocalizedTabIndex(
  activeLocales: readonly ActiveLocale[],
  hasLocalization: (localeId: string) => boolean,
): number {
  const localized = activeLocales.flatMap((locale, i) => (hasLocalization(locale.id) ? [i] : []));
  return localized.length === 1 ? localized[0] : -1;
}
