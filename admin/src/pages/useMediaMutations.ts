import { useState, useCallback, type Dispatch } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createMediaFolder, deleteMedia, deleteMediaFolder, updateMedia, updateMediaFolder, uploadMediaFile } from '@/services/media';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { useBulkSelection } from '@/hooks/useBulkSelection';

/** Action types shared with Media page reducer */
type MediaDispatchAction =
  | { type: 'SET_UPLOAD_OPEN'; payload: boolean }
  | { type: 'SET_DELETING_FILE'; payload: null }
  | { type: 'SET_SELECTED_FOLDER'; payload: string | null };

interface UseMediaMutationsArgs {
  selectedSiteId: string;
  selectedFolderId: string | null;
  dispatch: Dispatch<MediaDispatchAction>;
  bulk: ReturnType<typeof useBulkSelection>;
}

export function useMediaMutations({ selectedSiteId, selectedFolderId, dispatch, bulk }: UseMediaMutationsArgs) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const invalidateTrash = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trash-count'] });
    queryClient.invalidateQueries({ queryKey: ['trash'] });
  }, [queryClient]);

  const uploadMutation = useMutation({
    mutationFn: ({ file, isGlobal }: { file: File; isGlobal: boolean }) =>
      uploadMediaFile(file, [selectedSiteId], selectedFolderId ?? undefined, isGlobal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-category-counts'] });
      dispatch({ type: 'SET_UPLOAD_OPEN', payload: false });
      showSuccess(t('media.upload.success'));
    },
    onError: (error) => showError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => deleteMedia(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-category-counts'] });
      invalidateTrash();
      dispatch({ type: 'SET_DELETING_FILE', payload: null });
      showSuccess(t('media.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      updateMedia(id, { folder_id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media'] }); showSuccess(t('media.messages.moved')); },
    onError: (error) => showError(error),
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createMediaFolder(selectedSiteId, { name, display_order: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); showSuccess(t('media.messages.folderCreated')); },
    onError: (error) => showError(error),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateMediaFolder(id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); showSuccess(t('media.messages.folderRenamed')); },
    onError: (error) => showError(error),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deleteMediaFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      if (selectedFolderId) dispatch({ type: 'SET_SELECTED_FOLDER', payload: null });
      showSuccess(t('media.messages.folderDeleted'));
    },
    onError: (error) => showError(error),
  });

  const handleBulkDelete = useCallback(async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(bulk.selectedIds);
      await Promise.all(ids.map((id) => deleteMedia(id)));
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-category-counts'] });
      invalidateTrash();
      showSuccess(t('bulk.messages.success', { count: ids.length }));
      bulk.clear();
    } catch (err) {
      showError(err);
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirmOpen(false);
    }
  }, [bulk, queryClient, invalidateTrash, showSuccess, showError, t]);

  return {
    uploadMutation,
    deleteMutation,
    moveToFolderMutation,
    createFolderMutation,
    renameFolderMutation,
    deleteFolderMutation,
    bulkDeleting,
    bulkDeleteConfirmOpen,
    setBulkDeleteConfirmOpen,
    handleBulkDelete,
  };
}
