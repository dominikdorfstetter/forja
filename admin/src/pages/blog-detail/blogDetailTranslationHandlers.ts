import type { UseFormGetValues } from 'react-hook-form';
import type { BlogContentFormData } from './blogDetailSchema';
import type { UIState, UIAction } from './BlogDetailReducer';
import { buildFormDefaults } from './BlogDetailReducer';
import type { BlogDetailResponse, AiAction, AiGenerateResponse } from '@/types/api';

type AiGenerateFn = (action: AiAction, content: string, targetLocale?: string) => Promise<AiGenerateResponse>;

interface TranslationDeps {
  getValues: UseFormGetValues<BlogContentFormData>;
  dispatch: React.Dispatch<UIAction>;
  ui: UIState;
  aiGenerate: AiGenerateFn;
  activeLocales: { id: string; code: string; name: string }[];
  currentLocale: { id: string; code: string } | undefined;
  localeFormCache: React.MutableRefObject<Map<string, BlogContentFormData>>;
  blogDetail: BlogDetailResponse | undefined;
  isDirty: boolean;
  flush: () => Promise<void> | void;
  formSyncKey: React.MutableRefObject<string>;
}

export function createTranslationHandlers(deps: TranslationDeps) {
  const { getValues, dispatch, ui, aiGenerate, activeLocales, currentLocale, localeFormCache, blogDetail, isDirty, flush, formSyncKey } = deps;

  const handleGenerateTranslation = async () => {
    const values = getValues();
    if (!values.body || !ui.translateLocale) return;
    const content = JSON.stringify({
      title: values.title, subtitle: values.subtitle, excerpt: values.excerpt,
      body: values.body, meta_title: values.meta_title, meta_description: values.meta_description,
    });
    const result = await aiGenerate('translate', content, ui.translateLocale);
    dispatch({ type: 'setTranslationPreview', value: {
      title: result.title, subtitle: result.subtitle, excerpt: result.excerpt,
      body: result.body, meta_title: result.meta_title, meta_description: result.meta_description,
    } });
  };

  const handleRefreshField = async (fieldName: 'title' | 'subtitle' | 'excerpt' | 'body' | 'meta_title' | 'meta_description') => {
    const values = getValues();
    const sourceValue = values[fieldName];
    if (!sourceValue || !ui.translateLocale) return;
    dispatch({ type: 'setRefreshingField', value: fieldName });
    try {
      const result = await aiGenerate('translate', JSON.stringify({ [fieldName]: sourceValue }), ui.translateLocale);
      const translated = result[fieldName];
      if (translated && ui.translationPreview) {
        dispatch({ type: 'setTranslationPreview', value: { ...ui.translationPreview, [fieldName]: translated } });
      }
    } finally {
      dispatch({ type: 'setRefreshingField', value: null });
    }
  };

  const handleApplyTranslation = async () => {
    if (!ui.translationPreview || !ui.translateLocale || !currentLocale) return;
    const targetLocale = activeLocales.find((l) => l.code === ui.translateLocale);
    if (!targetLocale) return;
    const targetTabIndex = activeLocales.indexOf(targetLocale);
    localeFormCache.current.set(currentLocale.id, getValues());
    if (isDirty) await flush();
    const existingLoc = blogDetail?.localizations?.find((l) => l.locale_id === targetLocale.id);
    const existingCache = localeFormCache.current.get(targetLocale.id);
    const base = existingCache ?? buildFormDefaults(blogDetail, existingLoc);
    const prev = ui.translationPreview;
    const merged: BlogContentFormData = {
      ...base,
      ...(prev.title && { title: prev.title }),
      ...(prev.subtitle && { subtitle: prev.subtitle }),
      ...(prev.excerpt && { excerpt: prev.excerpt }),
      ...(prev.body && { body: prev.body }),
      ...(prev.meta_title && { meta_title: prev.meta_title }),
      ...(prev.meta_description && { meta_description: prev.meta_description }),
    };
    localeFormCache.current.set(targetLocale.id, merged);
    formSyncKey.current = '';
    dispatch({ type: 'applyTranslation', tabIndex: targetTabIndex });
  };

  return { handleGenerateTranslation, handleRefreshField, handleApplyTranslation };
}
