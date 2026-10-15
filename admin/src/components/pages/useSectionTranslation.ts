import { useCallback, useState } from 'react';
import type { useAiAssist } from '@/hooks/useAiAssist';
import type { SectionLocalizationResponse } from '@/types/api';
import type { SectionTranslationPreview } from './SectionTranslateDialog';
import type { LocaleFormData } from './sectionEditorState';

type TranslatableField = 'title' | 'text' | 'button_text';

/** JSON payload of the default-locale fields to translate; empty fields are dropped
 *  so the backend doesn't translate placeholders. */
function buildTranslateContent(source: SectionLocalizationResponse | undefined): string {
  const fields = {
    title: source?.title ?? '',
    text: source?.text ?? '',
    button_text: source?.button_text ?? '',
  };
  return JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([, value]) => value)));
}

interface UseSectionTranslationOptions {
  ai: ReturnType<typeof useAiAssist>;
  /** Code of the locale being translated into. */
  targetLocaleCode: string | undefined;
  /** Default-locale localization the translation starts from. */
  source: SectionLocalizationResponse | undefined;
  hasSourceContent: boolean;
  localeForm: LocaleFormData;
  /** Writes the applied translation into the locale form. */
  onApply: (form: LocaleFormData) => void;
  showError: (error: unknown) => void;
}

/** "Suggest translation" dialog state — local to the editor session, never persisted. */
export function useSectionTranslation({
  ai,
  targetLocaleCode,
  source,
  hasSourceContent,
  localeForm,
  onApply,
  showError,
}: UseSectionTranslationOptions) {
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translationPreview, setTranslationPreview] = useState<SectionTranslationPreview>(null);
  const [refreshingField, setRefreshingField] = useState<TranslatableField | null>(null);

  const handleOpenTranslate = useCallback(() => {
    setTranslationPreview(null);
    setTranslateOpen(true);
  }, []);

  const handleCloseTranslate = useCallback(() => {
    setTranslateOpen(false);
    setTranslationPreview(null);
  }, []);

  const handleGenerateTranslation = useCallback(async () => {
    if (!ai.isConfigured || !targetLocaleCode || !hasSourceContent) return;
    try {
      const result = await ai.generate('translate', buildTranslateContent(source), {
        targetLocale: targetLocaleCode,
      });
      setTranslationPreview({
        title: result.title,
        text: result.text,
        button_text: result.button_text,
      });
    } catch (err) {
      showError(err);
    }
  }, [ai, targetLocaleCode, hasSourceContent, source, showError]);

  const handleRefreshTranslateField = useCallback(
    async (field: TranslatableField) => {
      if (!ai.isConfigured || !targetLocaleCode) return;
      const sourceValue = source?.[field];
      if (!sourceValue) return;
      setRefreshingField(field);
      try {
        const result = await ai.generate(
          'translate',
          JSON.stringify({ [field]: sourceValue }),
          { targetLocale: targetLocaleCode },
        );
        const translated = result[field];
        if (translated) {
          setTranslationPreview((prev) => (prev ? { ...prev, [field]: translated } : prev));
        }
      } catch (err) {
        showError(err);
      } finally {
        setRefreshingField(null);
      }
    },
    [ai, targetLocaleCode, source, showError],
  );

  const handleApplyTranslation = useCallback(() => {
    if (!translationPreview) return;
    onApply({
      title: translationPreview.title ?? localeForm.title,
      text: translationPreview.text ?? localeForm.text,
      buttonText: translationPreview.button_text ?? localeForm.buttonText,
      items: localeForm.items,
    });
    setTranslateOpen(false);
    setTranslationPreview(null);
  }, [translationPreview, localeForm, onApply]);

  return {
    translateOpen,
    translationPreview,
    setTranslationPreview,
    refreshingField,
    handleOpenTranslate,
    handleCloseTranslate,
    handleGenerateTranslation,
    handleRefreshTranslateField,
    handleApplyTranslation,
  };
}
