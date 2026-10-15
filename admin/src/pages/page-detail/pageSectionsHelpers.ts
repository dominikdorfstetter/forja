import type { PageSectionResponse, ReorderItem, SectionLocalizationResponse, SectionType } from '@/types/api';

const SUBTITLE_MAX_CHARS = 60;

export interface SectionsLocale {
  id: string;
  code: string;
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/[#*_~`>[\]()!|\\-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

export function sortByDisplayOrder(sections: PageSectionResponse[]): PageSectionResponse[] {
  return [...sections].sort((a, b) => a.display_order - b.display_order);
}

/** Reorder payload: each section's new `display_order` is its list index. */
export function toReorderItems(sections: PageSectionResponse[]): ReorderItem[] {
  return sections.map((section, index) => ({ id: section.id, display_order: index }));
}

/** Upper-cased codes of the active locales the section has a localization for. */
export function localeChipsFor(
  sectionId: string,
  localizations: SectionLocalizationResponse[] | undefined,
  activeLocales: SectionsLocale[],
): string[] {
  if (!localizations || !activeLocales.length) return [];
  const sectionLocs = localizations.filter((l) => l.page_section_id === sectionId);
  return activeLocales
    .filter((locale) => sectionLocs.some((l) => l.locale_id === locale.id))
    .map((locale) => locale.code.toUpperCase());
}

/** First non-empty localized title of the section, in any locale. */
export function primaryTitleFor(
  sectionId: string,
  localizations: SectionLocalizationResponse[] | undefined,
): string | null {
  if (!localizations) return null;
  const loc = localizations.find((l) => l.page_section_id === sectionId && l.title);
  return loc?.title || null;
}

/** Plain-text excerpt (≤60 chars) of the first non-empty localized text of the section. */
export function subtitleFor(
  sectionId: string,
  localizations: SectionLocalizationResponse[] | undefined,
): string | null {
  if (!localizations) return null;
  const loc = localizations.find((l) => l.page_section_id === sectionId && l.text);
  if (!loc?.text) return null;
  const stripped = stripMarkdown(loc.text);
  return stripped.length > SUBTITLE_MAX_CHARS ? stripped.slice(0, SUBTITLE_MAX_CHARS) + '...' : stripped;
}

/** Types of the page's other sections in display order — grounding for AI section generation. */
export function otherSectionTypes(
  sections: PageSectionResponse[] | undefined,
  excludeId: string | undefined,
): SectionType[] {
  return sortByDisplayOrder((sections ?? []).filter((s) => s.id !== excludeId)).map((s) => s.section_type);
}
