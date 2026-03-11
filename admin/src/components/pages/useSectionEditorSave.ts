import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  UpdatePageSectionRequest,
  UpsertSectionLocalizationRequest,
} from '@/types/api';

interface LocaleFormData {
  title: string;
  text: string;
  buttonText: string;
}

interface UseSectionEditorSaveOptions {
  sectionId: string | undefined;
  pageId: string | undefined;
}

export function useSectionEditorSave({ sectionId, pageId }: UseSectionEditorSaveOptions) {
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();

  const dirtyLocalesRef = useRef<Map<string, LocaleFormData>>(new Map());

  const upsertLocMutation = useMutation({
    mutationFn: (data: UpsertSectionLocalizationRequest) =>
      apiService.upsertSectionLocalization(sectionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-section-localizations'] });
    },
    onError: (error) => showError(error),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (data: UpdatePageSectionRequest) =>
      apiService.updatePageSection(sectionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', pageId] });
    },
    onError: (error) => showError(error),
  });

  const saveAll = useCallback(async (
    currentLocaleId: string | undefined,
    currentLocaleForm: LocaleFormData,
    sectionConfig: { coverImageId: string; ctaRoute: string; settings: Record<string, unknown> },
    stashCurrentLocale: () => void,
  ) => {
    stashCurrentLocale();

    const dirtyEntries = Array.from(dirtyLocalesRef.current.entries());
    for (const [localeId, data] of dirtyEntries) {
      await upsertLocMutation.mutateAsync({
        locale_id: localeId,
        title: data.title || undefined,
        text: data.text || undefined,
        button_text: data.buttonText || undefined,
      });
    }

    if (currentLocaleId && !dirtyLocalesRef.current.has(currentLocaleId)) {
      await upsertLocMutation.mutateAsync({
        locale_id: currentLocaleId,
        title: currentLocaleForm.title || undefined,
        text: currentLocaleForm.text || undefined,
        button_text: currentLocaleForm.buttonText || undefined,
      });
    }

    await updateSectionMutation.mutateAsync({
      cover_image_id: sectionConfig.coverImageId || undefined,
      call_to_action_route: sectionConfig.ctaRoute || undefined,
      settings: Object.keys(sectionConfig.settings).length > 0 ? sectionConfig.settings : undefined,
    });

    dirtyLocalesRef.current.clear();
  }, [upsertLocMutation, updateSectionMutation]);

  return {
    dirtyLocalesRef,
    saveAll,
    queryClient,
  };
}
