import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePageSection, upsertSectionLocalization } from '@/services/pages';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  UpdatePageSectionRequest,
  UpsertSectionLocalizationRequest,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface LocaleFormData {
  title: string;
  text: string;
  buttonText: string;
  /** Per-locale `settings.items` override — `null` = fall back to default. */
  items: Record<string, unknown>[] | null;
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
      upsertSectionLocalization(sectionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pageSectionLocalizations(pageId) });
    },
    onError: (error) => showError(error),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (data: UpdatePageSectionRequest) =>
      updatePageSection(sectionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pageSections(pageId) });
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

    // Omitting `items` clears the override (full-row upsert semantics), so a
    // `null` form value maps to an absent field — fall back to the default.
    const toUpsertPayload = (
      localeId: string,
      data: LocaleFormData,
    ): UpsertSectionLocalizationRequest => ({
      locale_id: localeId,
      title: data.title || undefined,
      text: data.text || undefined,
      button_text: data.buttonText || undefined,
      items: data.items ?? undefined,
    });

    const dirtyEntries = Array.from(dirtyLocalesRef.current.entries());
    for (const [localeId, data] of dirtyEntries) {
      await upsertLocMutation.mutateAsync(toUpsertPayload(localeId, data));
    }

    if (currentLocaleId && !dirtyLocalesRef.current.has(currentLocaleId)) {
      await upsertLocMutation.mutateAsync(toUpsertPayload(currentLocaleId, currentLocaleForm));
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
