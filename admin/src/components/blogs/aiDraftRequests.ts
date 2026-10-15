import type { AiAction, AiGenerateResponse, SiteLocaleResponse } from '@/types/api';
import type { OutlineItem, RegenerateField } from './blogWizardAiFields';

/** The draft fields an AI request reads, independent of how each host names its state. */
export interface AiDraftSource {
  title: string;
  subtitle: string;
  outline: OutlineItem[];
  body: string;
}

/** AI generation runs in the site's default locale (English when none is configured). */
export function defaultLocaleInfo(siteLocales: SiteLocaleResponse[] | undefined) {
  const defaultLocale = siteLocales?.find((sl) => sl.is_default);
  return { code: defaultLocale?.code ?? 'en', name: defaultLocale?.name ?? 'English' };
}

/** JSON prompt payload for the `draft_post` action. */
export function draftPostContent({ title, subtitle, outline }: Omit<AiDraftSource, 'body'>): string {
  return JSON.stringify({ title, subtitle, outline: outline.map((item) => item.value) });
}

/** Which AI action + prompt content regenerates a given field. */
export function regenerateRequest(field: RegenerateField, draft: AiDraftSource): { action: AiAction; content: string } {
  switch (field) {
    case 'all':
    case 'body':
      return { action: 'draft_post', content: draftPostContent(draft) };
    case 'excerpt':
    case 'seo':
      return { action: field, content: draft.body };
  }
}

export type AiResultKey = 'body' | 'excerpt' | 'meta_title' | 'meta_description';

const REGENERATED_KEYS: Record<RegenerateField, AiResultKey[]> = {
  all: ['body', 'excerpt', 'meta_title', 'meta_description'],
  body: ['body'],
  excerpt: ['excerpt'],
  seo: ['meta_title', 'meta_description'],
};

/** The non-empty response values a regeneration of `field` should overwrite, in field order. */
export function regeneratedValues(field: RegenerateField, result: AiGenerateResponse): [AiResultKey, string][] {
  return REGENERATED_KEYS[field].flatMap((key): [AiResultKey, string][] => {
    const value = result[key];
    return typeof value === 'string' && value ? [[key, value]] : [];
  });
}
