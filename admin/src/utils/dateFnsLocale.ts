/**
 * Maps i18n language codes to date-fns locale objects.
 * Used to ensure all date/time formatting matches the UI language.
 */
import { useTranslation } from 'react-i18next';
import { useMemo, useCallback } from 'react';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { enUS, de, fr, es, it, pt, nl, pl, uk, ar } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const LOCALE_MAP: Record<string, Locale> = {
  en: enUS,
  de: de,
  'de-AT': de, // Wienerisch uses German date formatting
  fr: fr,
  es: es,
  it: it,
  pt: pt,
  nl: nl,
  pl: pl,
  uk: uk,
  ar: ar,
};

/** Returns the date-fns Locale matching the current i18n language. */
function useDateLocale(): Locale {
  const { i18n } = useTranslation();
  return useMemo(
    () => LOCALE_MAP[i18n.language] ?? enUS,
    [i18n.language],
  );
}

/** Locale-aware date formatting. Drop-in replacement for date-fns format(). */
export function useLocalizedFormat() {
  const locale = useDateLocale();
  return useCallback(
    (date: Date | number | string, pattern: string) =>
      dateFnsFormat(typeof date === 'string' ? new Date(date) : date, pattern, { locale }),
    [locale],
  );
}

/** Locale-aware relative time. Drop-in replacement for formatDistanceToNow(). */
export function useLocalizedDistanceToNow() {
  const locale = useDateLocale();
  return useCallback(
    (date: Date | number | string, opts?: { addSuffix?: boolean }) =>
      dateFnsFormatDistanceToNow(typeof date === 'string' ? new Date(date) : date, { ...opts, locale }),
    [locale],
  );
}
