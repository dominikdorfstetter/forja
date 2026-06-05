import { useState, useCallback, type Dispatch } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createDocumentFolder, deleteDocument, deleteDocumentFolder, setDocumentPrivacy, updateDocument, updateDocumentFolder } from '@/services/documents';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import { createDocumentWithLocalizations, updateDocumentWithLocalizations } from '@/pages/documentMutationFns';
import type { UIAction } from '@/pages/DocumentsReducer';
import type { useBulkSelection } from '@/hooks/useBulkSelection';

interface UseDocumentMutationsArgs {
  selectedSiteId: string;
  dispatch: Dispatch<UIAction>;
  detailMap: Map<string, DocumentResponse>;
  bulk: ReturnType<typeof useBulkSelection>;
}

export function useDocumentMutations({ selectedSiteId, dispatch, detailMap, bulk }: UseDocumentMutationsArgs) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const invalidateDocuments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['document-details'] });
  }, [queryClient]);

  const invalidateTrash = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trash-count'] });
    queryClient.invalidateQueries({ queryKey: ['trash'] });
  }, [queryClient]);

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string }) =>
      createDocumentFolder(selectedSiteId, { name, parent_id: parentId, display_order: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['document-folders'] }); showSuccess(t('media.messages.folderCreated')); },
    onError: (error) => showError(error),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateDocumentFolder(id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['document-folders'] }); showSuccess(t('media.messages.folderRenamed')); },
    onError: (error) => showError(error),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deleteDocumentFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      dispatch({ type: 'setSelectedFolder', id: null });
      showSuccess(t('media.messages.folderDeleted'));
    },
    onError: (error) => showError(error),
  });

  // Document mutations
  const createDocumentMutation = useMutation({
    mutationFn: async ({ data, localizations, privacy }: { data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[]; privacy?: { password: string } }) => {
      const doc = await createDocumentWithLocalizations(selectedSiteId, data, localizations);
      if (privacy && doc?.id) {
        await setDocumentPrivacy(doc.id, { password: privacy.password });
      }
      return doc;
    },
    onSuccess: () => {
      invalidateDocuments();
      dispatch({ type: 'closeForm' });
      showSuccess(t('documents.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data, localizations }: { id: string; data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) =>
      updateDocumentWithLocalizations(id, data, localizations, detailMap),
    onSuccess: () => {
      invalidateDocuments();
      dispatch({ type: 'setEditingDocument', doc: null });
      dispatch({ type: 'closeForm' });
      showSuccess(t('documents.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      invalidateDocuments();
      invalidateTrash();
      dispatch({ type: 'closeDelete' });
      showSuccess(t('documents.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      updateDocument(id, { folder_id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); showSuccess(t('media.messages.moved')); },
    onError: (error) => showError(error),
  });

  const handleBulkDelete = useCallback(async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(bulk.selectedIds);
      for (const id of ids) {
        await deleteDocument(id);
      }
      invalidateDocuments();
      invalidateTrash();
      showSuccess(t('bulk.messages.success', { count: ids.length }));
      bulk.clear();
    } catch (err) {
      showError(err);
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirmOpen(false);
    }
  }, [bulk, invalidateDocuments, invalidateTrash, showSuccess, showError, t]);

  return {
    createFolderMutation,
    renameFolderMutation,
    deleteFolderMutation,
    createDocumentMutation,
    updateDocumentMutation,
    deleteDocumentMutation,
    moveToFolderMutation,
    bulkDeleting,
    bulkDeleteConfirmOpen,
    setBulkDeleteConfirmOpen,
    handleBulkDelete,
  };
}
