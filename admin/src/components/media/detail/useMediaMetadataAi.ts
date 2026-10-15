import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { generateAiContent } from '@/services/ai';
import type { AiAction, Locale } from '@/types/api';
import {
  EMPTY_META_VALUES,
  GENERATE_ACTIONS,
  TRANSLATE_FIELDS,
  generatedValueFor,
  hasMetaContent,
  stripMarkdownEmphasis,
  type MetaField,
  type MetaValues,
  type MetaValuesByLocale,
} from './mediaDetailModel';

interface MediaMetadataAiOptions {
  siteId: string;
  imageUrl: string | null | undefined;
  editingMeta: MetaValuesByLocale;
  defaultLocale: Locale | undefined;
  setMetaField: (localeId: string, field: MetaField, value: string) => void;
  setLocaleValues: (localeId: string, values: MetaValues) => void;
}

/**
 * AI helpers for media metadata: generate a single field from the image, or
 * translate the default locale's fields into another locale.
 */
export function useMediaMetadataAi({
  siteId,
  imageUrl,
  editingMeta,
  defaultLocale,
  setMetaField,
  setLocaleValues,
}: MediaMetadataAiOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isTranslating, setIsTranslating] = useState(false);

  const { mutate: generate, isPending: isGenerating, variables: generateVariables } = useMutation({
    mutationFn: ({ action, localeCode }: { action: AiAction; localeCode: string }) =>
      generateAiContent(siteId, {
        action,
        content: '',
        image_url: imageUrl ?? undefined,
        target_locale: localeCode,
      }),
  });

  const translateMetadata = useCallback(
    async (targetLocaleId: string, targetLocaleCode: string) => {
      if (!defaultLocale) return;
      const source = editingMeta[defaultLocale.id];
      if (!hasMetaContent(source)) {
        enqueueSnackbar(t('media.ai.noSourceContent', 'No content in default locale to translate'), { variant: 'warning' });
        return;
      }

      setIsTranslating(true);
      try {
        const newValues = { ...(editingMeta[targetLocaleId] || EMPTY_META_VALUES) };

        // Translate fields sequentially to avoid response field collisions
        for (const { key, translateAs } of TRANSLATE_FIELDS) {
          const value = source[key];
          if (!value) continue;
          const result = await generateAiContent(siteId, {
            action: 'translate',
            content: JSON.stringify({ [translateAs]: value }),
            target_locale: targetLocaleCode,
          });
          const translated = result[translateAs] ?? '';
          if (translated) newValues[key] = stripMarkdownEmphasis(translated);
        }

        setLocaleValues(targetLocaleId, newValues);
        enqueueSnackbar(t('media.ai.translated', 'Metadata translated'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('media.ai.generationFailed', 'AI generation failed'), { variant: 'error' });
      } finally {
        setIsTranslating(false);
      }
    },
    [defaultLocale, editingMeta, enqueueSnackbar, t, siteId, setLocaleValues],
  );

  const generateField = useCallback(
    (field: MetaField, localeId: string, localeCode: string) => {
      generate(
        { action: GENERATE_ACTIONS[field], localeCode },
        {
          onSuccess: (result) => {
            const value = generatedValueFor(field, result);
            if (value) {
              setMetaField(localeId, field, value);
              enqueueSnackbar(t('media.ai.fieldGenerated', 'AI content generated'), { variant: 'success' });
            }
          },
          onError: () => {
            enqueueSnackbar(t('media.ai.generationFailed', 'AI generation failed'), { variant: 'error' });
          },
        },
      );
    },
    [generate, setMetaField, enqueueSnackbar, t],
  );

  /** The AI action currently generating, if any (drives per-field spinners). */
  const generatingAction = isGenerating ? generateVariables?.action : undefined;

  return { isTranslating, translateMetadata, isGenerating, generatingAction, generateField };
}

export type MediaMetadataAi = ReturnType<typeof useMediaMetadataAi>;
