import { useCallback, useMemo } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { useAiAssist } from '@/hooks/useAiAssist';
import type { SectionLocalizationResponse } from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';

const MIN_CONTENT_CHARS = 50;

/** Concatenate `title + text` of localizations for the active locale.
 *  Order is whatever the API returns — section ordering on the page itself is
 *  preserved at fetch time. Empty fields are skipped to keep the prompt tight. */
function buildSeoSourceContent(
  localizations: SectionLocalizationResponse[] | undefined,
  localeId: string | undefined,
): string {
  if (!localizations || !localeId) return '';
  return localizations
    .filter((l) => l.locale_id === localeId)
    .flatMap((l) => [l.title, l.text].filter((v): v is string => !!v))
    .join('\n\n');
}

interface UsePageSeoAiOptions {
  /** Section localizations of the page — the source content for generation. */
  sectionLocalizations: SectionLocalizationResponse[] | undefined;
  /** Locale whose section content feeds the prompt (the default locale). */
  sourceLocaleId: string | undefined;
  setValue: UseFormSetValue<PageDetailFormData> | undefined;
  onSnapshot: () => void;
}

/** AI "Generate SEO" / "Generate excerpt" actions for the page SEO tab. */
export function usePageSeoAi({ sectionLocalizations, sourceLocaleId, setValue, onSnapshot }: UsePageSeoAiOptions) {
  const ai = useAiAssist();
  const seoSourceContent = useMemo(
    () => buildSeoSourceContent(sectionLocalizations, sourceLocaleId),
    [sectionLocalizations, sourceLocaleId],
  );
  const hasSeoSource = seoSourceContent.length >= MIN_CONTENT_CHARS;

  const handleGenerateSeo = useCallback(async () => {
    if (!hasSeoSource || !setValue) return;
    const result = await ai.generate('seo', seoSourceContent);
    if (result.meta_title) setValue('meta_title', result.meta_title, { shouldDirty: true });
    if (result.meta_description) setValue('meta_description', result.meta_description, { shouldDirty: true });
    onSnapshot();
  }, [ai, hasSeoSource, seoSourceContent, setValue, onSnapshot]);

  const handleGenerateExcerpt = useCallback(async () => {
    if (!hasSeoSource || !setValue) return;
    const result = await ai.generate('excerpt', seoSourceContent);
    if (result.excerpt) setValue('excerpt', result.excerpt, { shouldDirty: true });
    onSnapshot();
  }, [ai, hasSeoSource, seoSourceContent, setValue, onSnapshot]);

  return { ai, hasSeoSource, handleGenerateSeo, handleGenerateExcerpt };
}
