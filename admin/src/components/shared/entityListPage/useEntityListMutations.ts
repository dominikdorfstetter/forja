import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BulkContentRequest, ContentStatus } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { queryKeys } from '@/lib/queryKeys';
import { bulkRequestFor, type BulkAction } from './entityListHelpers';
import type { EntityListAdapter } from './types';

interface EntityListMutationOptions<TItem, TStatusCounts> {
  adapter: EntityListAdapter<TItem, TStatusCounts>;
  selectedSiteId: string;
  /** List-chrome translator (`<i18nNamespace>.list.*`). */
  tl: (sub: string) => string;
  /** Closes the single-row delete dialog after a successful delete. */
  closeDelete: () => void;
  /** Current bulk selection — the ids a bulk action applies to. */
  selectedIds: ReadonlySet<string>;
  /** Clears the selection and closes the bulk dialogs after a bulk action. */
  onBulkSettled: () => void;
}

/**
 * Row status updates, row delete and bulk actions for the list harness. Every
 * success invalidates the site's list (via the adapter's query-key root), the
 * adapter's extra keys, and its status counts.
 */
export function useEntityListMutations<TItem, TStatusCounts>({
  adapter,
  selectedSiteId,
  tl,
  closeDelete,
  selectedIds,
  onBulkSettled,
}: EntityListMutationOptions<TItem, TStatusCounts>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, enqueueSnackbar, showSuccess } = useErrorSnackbar();

  const queryKeyRoot = adapter.queryKeyRoot ?? adapter.entityKey + 's';

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityList(queryKeyRoot, selectedSiteId) });
    adapter.bulkExtraInvalidations?.(selectedSiteId).forEach((key) =>
      queryClient.invalidateQueries({ queryKey: key }),
    );
    if (adapter.statusCountsQueryKey) {
      queryClient.invalidateQueries({ queryKey: adapter.statusCountsQueryKey(selectedSiteId) });
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      adapter.updateEntity(id, { status }),
    onSuccess: () => {
      invalidateLists();
      showSuccess(tl('messages.updated'));
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adapter.deleteEntity(id),
    onSuccess: () => {
      invalidateLists();
      closeDelete();
      showSuccess(tl('messages.deleted'));
    },
    onError: (err) => showError(err),
  });

  const bulkMutation = useMutation({
    mutationFn: (request: BulkContentRequest) => adapter.bulkAction(selectedSiteId, request),
    onSuccess: (resp) => {
      invalidateLists();
      onBulkSettled();
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), {
          variant: 'warning',
        });
      }
    },
    onError: (err) => showError(err),
  });

  const onRowConfirmStatus = useCallback(
    (item: TItem, status: ContentStatus) => {
      updateMutation.mutate({ id: adapter.getItemId(item), status });
    },
    [adapter, updateMutation],
  );

  const onRowConfirmDelete = useCallback(
    (item: TItem) => {
      deleteMutation.mutate(adapter.getItemId(item));
    },
    [adapter, deleteMutation],
  );

  const onBulkConfirm = useCallback(
    (action: BulkAction) => {
      bulkMutation.mutate(bulkRequestFor(action, [...selectedIds]));
    },
    [selectedIds, bulkMutation],
  );

  return {
    onRowConfirmStatus,
    onRowConfirmDelete,
    onBulkConfirm,
    deleteLoading: deleteMutation.isPending,
    bulkLoading: bulkMutation.isPending,
  };
}
