import type { AiAction, AiGenerateResponse, Locale, MediaMetadataResponse, SiteLocaleResponse } from '@/types/api';

/** Per-locale editable metadata fields of a media file. */
export type MetaField = 'alt_text' | 'caption' | 'title';
export type MetaValues = Record<MetaField, string>;
export type MetaValuesByLocale = Record<string, MetaValues>;

export const EMPTY_META_VALUES: MetaValues = { alt_text: '', caption: '', title: '' };

/** Saved metadata rows → editable values keyed by locale id. */
export function toMetaValuesByLocale(metadata: MediaMetadataResponse[]): MetaValuesByLocale {
  const map: MetaValuesByLocale = {};
  for (const m of metadata) {
    map[m.locale_id] = { alt_text: m.alt_text || '', caption: m.caption || '', title: m.title || '' };
  }
  return map;
}

/** The site's default locale among `locales`, falling back to the first one. */
export function findDefaultLocale(locales: Locale[], siteLocales: SiteLocaleResponse[]): Locale | undefined {
  return locales.find((l) =>
    siteLocales.find((sl) => sl.locale_id === l.id && sl.is_default)
  ) ?? locales[0];
}

/** Strip residual markdown emphasis (**bold**, *em*, _em_) from AI output. */
export function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/_(.+?)_/g, '$1');
}

export function hasMetaContent(values: MetaValues | undefined): values is MetaValues {
  return !!values && !!(values.alt_text || values.caption || values.title);
}

/** AI action that generates each metadata field from the image. */
export const GENERATE_ACTIONS: Record<MetaField, AiAction> = {
  alt_text: 'alt_text',
  caption: 'image_caption',
  title: 'image_title',
};

const GENERATED_RESPONSE_FIELD: Record<MetaField, 'alt_text' | 'subtitle' | 'title'> = {
  alt_text: 'alt_text',
  caption: 'subtitle',
  title: 'title',
};

/** The cleaned-up generated value for `field` from an AI response ('' when absent). */
export function generatedValueFor(field: MetaField, result: AiGenerateResponse): string {
  return stripMarkdownEmphasis(result[GENERATED_RESPONSE_FIELD[field]] ?? '');
}

/**
 * How each field is sent for translation. "subtitle" (alt text, caption: plain
 * text up to 150 chars) and "title" (up to 100 chars) are translate field types
 * whose prompts enforce "no markdown, no formatting".
 */
export const TRANSLATE_FIELDS: ReadonlyArray<{ key: MetaField; translateAs: 'subtitle' | 'title' }> = [
  { key: 'alt_text', translateAs: 'subtitle' },
  { key: 'caption', translateAs: 'subtitle' },
  { key: 'title', translateAs: 'title' },
];

/**
 * The locale whose metadata can be machine-translated into `targetLocaleId`:
 * the default locale, once it has a draft, and never into itself.
 */
export function translationSourceFor(
  targetLocaleId: string,
  defaultLocale: Locale | undefined,
  editingMeta: MetaValuesByLocale,
): Locale | null {
  if (!defaultLocale || targetLocaleId === defaultLocale.id || !editingMeta[defaultLocale.id]) return null;
  return defaultLocale;
}
