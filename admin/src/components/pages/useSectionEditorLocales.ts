import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSectionLocalizations } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import type { SectionLocalizationResponse, SiteLocaleResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { toActiveSiteLocale } from '@/utils/siteLocales';

/** Active site locale as shown in the section editor's locale tabs. */
export type EditorLocale = ReturnType<typeof toEditorLocales>[number];

export function toEditorLocales(siteLocales: SiteLocaleResponse[] | undefined) {
  return (siteLocales || []).filter((sl) => sl.is_active).map((sl) => ({ ...toActiveSiteLocale(sl), is_default: sl.is_default }));
}

/** Whether a localization carries any text an AI translation could start from. */
export function hasTranslatableSource(loc: SectionLocalizationResponse | undefined): boolean {
  return !!(loc && (loc.title || loc.text || loc.button_text));
}

/** Site locales + the section's localizations, and the default-locale source derived from them. */
export function useSectionEditorLocales(siteId: string, sectionId: string | undefined) {
  const { data: siteLocalesRaw } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
    enabled: !!siteId,
  });

  const { data: localizations } = useQuery({
    queryKey: queryKeys.sectionLocalizations(sectionId),
    queryFn: () => getSectionLocalizations(sectionId!),
    enabled: !!sectionId,
  });

  const activeLocales = useMemo(() => toEditorLocales(siteLocalesRaw), [siteLocalesRaw]);
  const defaultLocale = useMemo(
    () => activeLocales.find((l) => l.is_default) ?? activeLocales[0],
    [activeLocales],
  );
  const defaultLocalization = useMemo(
    () => localizations?.find((l) => defaultLocale && l.locale_id === defaultLocale.id),
    [localizations, defaultLocale],
  );

  return {
    localizations,
    activeLocales,
    defaultLocale,
    defaultLocalization,
    hasSourceContent: hasTranslatableSource(defaultLocalization),
  };
}
