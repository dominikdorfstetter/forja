import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { PageSectionResponse } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAiAssist } from '@/hooks/useAiAssist';
import { queryKeys } from '@/lib/queryKeys';
import { useSectionEditorSave } from './useSectionEditorSave';
import { useSectionEditorLocales } from './useSectionEditorLocales';
import { useSectionTranslation } from './useSectionTranslation';
import { editorReducer, initialEditorState, localeFormFrom, type LocaleFormData } from './sectionEditorState';

/** Page-level context the dialog forwards to the AI Generate-Content action. */
export interface SectionPageContext {
  route?: string;
  title?: string;
  /** Section types already on the page, in display order — lets the model avoid repeating angles. */
  existingSectionTypes?: string[];
}

interface UseSectionEditorOptions {
  open: boolean;
  section: PageSectionResponse | null;
  onClose: () => void;
  pageContext?: SectionPageContext;
}

/** Editing session of one section: per-locale forms with unsaved-locale stash, section config, save/close and AI actions. */
export function useSectionEditor({ open, section, onClose, pageContext }: UseSectionEditorOptions) {
  const { showError } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const ai = useAiAssist();

  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const coverImageUrl = useMediaUrl(state.coverImageId || undefined);

  const { dirtyLocalesRef, saveAll, queryClient } = useSectionEditorSave({
    sectionId: section?.id,
    pageId: section?.page_id,
  });

  const { localizations, activeLocales, defaultLocale, defaultLocalization, hasSourceContent } =
    useSectionEditorLocales(selectedSiteId, section?.id);
  const currentLocale = activeLocales[state.activeTab];
  const isOnDefaultLocale = !!currentLocale && !!defaultLocale && currentLocale.id === defaultLocale.id;

  const setLocaleForm = useCallback((value: LocaleFormData) => dispatch({ type: 'SET_LOCALE_FORM', value }), []);

  const translation = useSectionTranslation({
    ai,
    targetLocaleCode: currentLocale?.code,
    source: defaultLocalization,
    hasSourceContent,
    localeForm: state.localeForm,
    onApply: setLocaleForm,
    showError,
  });

  const markLocaleDirty = useCallback((localeId: string, data: LocaleFormData) => {
    dirtyLocalesRef.current.set(localeId, data);
    dispatch({ type: 'BUMP_DIRTY_VERSION' });
  }, [dirtyLocalesRef]);

  const stashCurrentLocale = useCallback(() => {
    if (currentLocale) markLocaleDirty(currentLocale.id, state.localeForm);
  }, [currentLocale, state.localeForm, markLocaleDirty]);

  const handleTabChange = (_: unknown, newValue: number) => {
    stashCurrentLocale();
    dispatch({ type: 'SET_ACTIVE_TAB', value: newValue });
    const locale = activeLocales[newValue];
    const dirty = locale ? dirtyLocalesRef.current.get(locale.id) : undefined;
    if (dirty) setLocaleForm(dirty);
    else setLocaleForm(localeFormFrom(localizations?.find((l) => locale && l.locale_id === locale.id)));
  };

  // Initialize section metadata when dialog opens or section changes
  const prevSectionRef = useRef<{ open: boolean; sectionId: string | null }>({ open: false, sectionId: null });
  useEffect(() => {
    const currentSectionKey = `${open}-${section?.id ?? null}`;
    const prevSectionKey = `${prevSectionRef.current.open}-${prevSectionRef.current.sectionId}`;
    if (currentSectionKey !== prevSectionKey) {
      prevSectionRef.current = { open, sectionId: section?.id ?? null };
      if (open && section) {
        dispatch({ type: 'INIT_SECTION', coverImageId: section.cover_image_id || '', ctaRoute: section.call_to_action_route || '', settings: section.settings ? { ...section.settings } : {} });
        dirtyLocalesRef.current.clear();
      }
    }
  });

  useEffect(() => {
    if (localizations && currentLocale) {
      const dirty = dirtyLocalesRef.current.get(currentLocale.id);
      if (dirty) setLocaleForm(dirty);
      else setLocaleForm(localeFormFrom(localizations.find((l) => l.locale_id === currentLocale.id)));
    }
  }, [localizations, currentLocale, dirtyLocalesRef, setLocaleForm]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveAll(currentLocale?.id, state.localeForm, { coverImageId: state.coverImageId, ctaRoute: state.ctaRoute, settings: state.settings }, stashCurrentLocale);
      dispatch({ type: 'BUMP_DIRTY_VERSION' });
    } finally {
      setIsSaving(false);
    }
  }, [saveAll, currentLocale, state.localeForm, state.coverImageId, state.ctaRoute, state.settings, stashCurrentLocale]);

  const handleGenerateContent = useCallback(async () => {
    if (!section || !ai.isConfigured) return;
    try {
      const result = await ai.generate('section_content', '', {
        targetLocale: currentLocale?.code,
        sectionContext: {
          section_type: section.section_type,
          page_title: pageContext?.title,
          page_route: pageContext?.route,
          existing_section_types: pageContext?.existingSectionTypes ?? [],
        },
      });
      setLocaleForm({
        title: result.title ?? '',
        text: result.text ?? '',
        buttonText: result.button_text ?? '',
        items: state.localeForm.items,
      });
    } catch (err) {
      showError(err);
    }
  }, [ai, section, currentLocale?.code, pageContext, showError, state.localeForm.items, setLocaleForm]);

  useEffect(() => {
    if (currentLocale && open) {
      dirtyLocalesRef.current.set(currentLocale.id, state.localeForm);
    }
  }, [state.localeForm, currentLocale, open, dirtyLocalesRef]);

  const isDirty = dirtyLocalesRef.current.size > 0;

  // No autosave: persist any pending edits when the dialog closes so work
  // isn't lost, then close. Save errors are surfaced via saveAll's snackbar.
  const handleClose = useCallback(async () => {
    if (isDirty && section) {
      try {
        await handleSave();
      } catch {
        // already surfaced by the save hook
      }
    }
    if (section) queryClient.invalidateQueries({ queryKey: queryKeys.sectionLocalizations(section.id) });
    onClose();
  }, [isDirty, section, handleSave, queryClient, onClose]);

  /** Whether a locale holds unsaved edits; `dirtyVersion` re-renders the tab markers when that changes. */
  const isLocaleDirty = (localeId: string) => state.dirtyVersion >= 0 && dirtyLocalesRef.current.has(localeId);

  return {
    state,
    dispatch,
    siteId: selectedSiteId,
    ai,
    coverImageUrl,
    localizations,
    activeLocales,
    currentLocale,
    isOnDefaultLocale,
    hasSourceContent,
    translation,
    isSaving,
    isLocaleDirty,
    handleTabChange,
    handleSave,
    handleClose,
    handleGenerateContent,
  };
}

export type SectionEditorModel = ReturnType<typeof useSectionEditor>;
