import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { permanentDeleteTrashItem, restoreTrashItem } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { queryKeys } from '@/lib/queryKeys';
import { selectionToTargets, toTrashTarget, type TrashItem, type TrashTarget } from './trashItem';
import type { TrashConfirmAction } from './TrashConfirmDialog';

/** Restoring or purging can touch any soft-deletable resource — refresh them all. */
function useInvalidateTrash(siteId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trash(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trashCount(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pages(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.media(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.legal(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.socialLinks(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.navigationMenus(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.navigationItems() });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cvEntries(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.skills(siteId) });
  }, [queryClient, siteId]);
}

/**
 * Selection, confirmation and restore/permanent-delete mutations of the Trash
 * page. `items` is the currently loaded page — selections resolve against it.
 */
export function useTrashActions(siteId: string, items: TrashItem[]) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useErrorSnackbar();
  const invalidateTrash = useInvalidateTrash(siteId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<TrashConfirmAction | null>(null);

  const restoreMutation = useMutation({
    mutationFn: async (targets: TrashTarget[]) => {
      await Promise.all(targets.map(({ id, entityType }) => restoreTrashItem(id, entityType)));
    },
    onSuccess: (_data, targets) => {
      invalidateTrash();
      setSelected((prev) => {
        const next = new Set(prev);
        targets.forEach(({ id }) => next.delete(id));
        return next;
      });
      showSuccess(t('trash.restored'));
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: async (targets: TrashTarget[]) => {
      await Promise.all(
        targets.map(({ id, entityType }) => permanentDeleteTrashItem(id, entityType)),
      );
    },
    onSuccess: () => {
      invalidateTrash();
      setSelected(new Set());
      setConfirmAction(null);
      showSuccess(t('trash.deleted'));
    },
    onError: (err) => {
      setConfirmAction(null);
      showError(err);
    },
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = (next: boolean) =>
    setSelected(next ? new Set(items.map((i) => i.id)) : new Set());

  const executeConfirmedDelete = () =>
    deleteMutation.mutate(
      confirmAction === 'deleteAll' ? items.map(toTrashTarget) : selectionToTargets(selected, items),
    );

  return {
    selected,
    toggleSelect,
    toggleSelectAll,
    confirmAction,
    isBusy: restoreMutation.isPending || deleteMutation.isPending,
    isDeleting: deleteMutation.isPending,
    restoreOne: (item: TrashItem) => restoreMutation.mutate([toTrashTarget(item)]),
    restoreSelected: () => restoreMutation.mutate(selectionToTargets(selected, items)),
    requestDeleteOne: (item: TrashItem) => {
      setSelected(new Set([item.id]));
      setConfirmAction('delete');
    },
    requestDeleteSelected: () => setConfirmAction('delete'),
    requestDeleteAll: () => setConfirmAction('deleteAll'),
    cancelConfirm: () => setConfirmAction(null),
    executeConfirmedDelete,
  };
}
