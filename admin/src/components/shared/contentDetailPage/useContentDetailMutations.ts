import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FieldValues } from 'react-hook-form';
import type { ReviewActionRequest } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { ContentDetailAdapter } from './types';

/**
 * Entity / localization saves and editorial review actions for one content
 * entity. `markPublishing` flags the next successful entity update as a
 * publish so the adapter's `onPublishSuccess` fires once it lands.
 */
export function useContentDetailMutations<TDetail, TFormData extends FieldValues, TLoc>(
  adapter: ContentDetailAdapter<TDetail, TFormData, TLoc>,
  id: string | undefined,
  detail: TDetail | undefined,
) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const justPublishedRef = useRef(false);

  const invalidateDetail = (entityId: string) =>
    queryClient.invalidateQueries({ queryKey: adapter.detailQueryKey(entityId) });
  const invalidateOnSave = () =>
    adapter.invalidateOnSave?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      adapter.updateEntity(entityId, data),
    onSuccess: (_resp, vars) => {
      invalidateDetail(vars.entityId);
      invalidateOnSave();
      if (justPublishedRef.current && detail) {
        adapter.onPublishSuccess?.(detail);
      }
      justPublishedRef.current = false;
    },
    onError: (err) => showError(err),
  });

  const createLocMutation = useMutation({
    mutationFn: ({ entityId, localeId, data }: { entityId: string; localeId: string; data: Record<string, unknown> }) =>
      adapter.createLocalization(entityId, localeId, data),
    onSuccess: () => invalidateDetail(id ?? ''),
    onError: (err) => showError(err),
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ locId, data }: { locId: string; data: Record<string, unknown> }) =>
      adapter.updateLocalization(locId, data),
    onSuccess: () => invalidateDetail(id ?? ''),
    onError: (err) => showError(err),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => {
      if (!adapter.reviewEntity) throw new Error('reviewEntity not configured');
      return adapter.reviewEntity(id!, data);
    },
    onSuccess: (resp) => {
      invalidateDetail(id ?? '');
      invalidateOnSave();
      showSuccess(resp.message);
    },
    onError: (err) => showError(err),
  });

  const markPublishing = useCallback(() => {
    justPublishedRef.current = true;
  }, []);

  const isSaving =
    updateEntityMutation.isPending ||
    createLocMutation.isPending ||
    updateLocMutation.isPending ||
    reviewMutation.isPending;

  return { updateEntityMutation, createLocMutation, updateLocMutation, reviewMutation, isSaving, markPublishing };
}

export type ContentDetailMutations = ReturnType<typeof useContentDetailMutations>;
