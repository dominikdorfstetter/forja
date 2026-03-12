import { useReducer, useMemo, useImperativeHandle, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArticleIcon from '@mui/icons-material/Article';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { getDocumentDisplayName } from '@/pages/DocumentCardGrid';
import DocumentContentArea from '@/pages/DocumentContentArea';
import DocumentFolderSidebar from '@/pages/DocumentFolderSidebar';
import DocumentDialogs from '@/pages/DocumentDialogs';
import { uiReducer, initialUIState } from '@/pages/DocumentsReducer';
import { createDocumentWithLocalizations, updateDocumentWithLocalizations } from '@/pages/documentMutationFns';
import { createDocumentHandlers } from '@/pages/documentHandlers';

export interface DocumentsPageHandle {
  openCreate: () => void;
}

function DocumentsPage({ embedded = false, ref }: { embedded?: boolean; ref?: Ref<DocumentsPageHandle> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ------ Queries ------

  const {
    data: folders,
    isLoading: foldersLoading,
  } = useQuery({
    queryKey: ['document-folders', selectedSiteId],
    queryFn: () => apiService.getDocumentFolders(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const {
    data: documentsData,
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ['documents', selectedSiteId, ui.selectedFolderId, ui.page, ui.pageSize],
    queryFn: () =>
      apiService.getDocuments(selectedSiteId, {
        folder_id: ui.selectedFolderId ?? undefined,
        page: ui.page,
        page_size: ui.pageSize,
      }),
    enabled: !!selectedSiteId,
  });
  const documents = documentsData?.data;

  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = (siteLocalesRaw || []).filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));

  // Fetch full detail (with localizations) for each document so we can display names
  const documentDetailQueries = useQuery({
    queryKey: ['document-details', documents?.map((d) => d.id)],
    queryFn: async () => {
      if (!documents || documents.length === 0) return [];
      const results = await Promise.all(documents.map((d) => apiService.getDocument(d.id)));
      return results;
    },
    enabled: !!documents && documents.length > 0,
  });

  const detailMap = useMemo(() => {
    const map = new Map<string, DocumentResponse>();
    if (documentDetailQueries.data) {
      for (const detail of documentDetailQueries.data) {
        map.set(detail.id, detail);
      }
    }
    return map;
  }, [documentDetailQueries.data]);

  // Client-side search filter
  const filteredDocuments = useMemo(() => {
    if (!documents || !ui.searchQuery.trim()) return documents;
    const q = ui.searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const displayName = getDocumentDisplayName(doc, detailMap).toLowerCase();
      const fileName = (doc.file_name || '').toLowerCase();
      const url = (doc.url || '').toLowerCase();
      const docType = doc.document_type.toLowerCase();
      return displayName.includes(q) || fileName.includes(q) || url.includes(q) || docType.includes(q);
    });
  }, [documents, ui.searchQuery, detailMap]);

  // ------ Folder Mutations ------

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string }) =>
      apiService.createDocumentFolder(selectedSiteId, { name, parent_id: parentId, display_order: (folders?.length ?? 0) + 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['document-folders'] }); showSuccess(t('media.messages.folderCreated')); },
    onError: (error) => showError(error),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiService.updateDocumentFolder(id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['document-folders'] }); showSuccess(t('media.messages.folderRenamed')); },
    onError: (error) => showError(error),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteDocumentFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      if (ui.selectedFolderId) dispatch({ type: 'setSelectedFolder', id: null });
      showSuccess(t('media.messages.folderDeleted'));
    },
    onError: (error) => showError(error),
  });

  // ------ Document Mutations ------

  const createDocumentMutation = useMutation({
    mutationFn: ({ data, localizations }: { data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) =>
      createDocumentWithLocalizations(selectedSiteId, data, localizations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      dispatch({ type: 'closeForm' });
      showSuccess(t('documents.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data, localizations }: { id: string; data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) =>
      updateDocumentWithLocalizations(id, data, localizations, detailMap),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      dispatch({ type: 'setEditingDocument', doc: null });
      dispatch({ type: 'closeForm' });
      showSuccess(t('documents.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      dispatch({ type: 'closeDelete' });
      showSuccess(t('documents.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      apiService.updateDocument(id, { folder_id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); showSuccess(t('media.messages.moved')); },
    onError: (error) => showError(error),
  });

  // ------ Handlers ------

  const { handleOpenCreate, handleOpenEdit, handleFormSubmit, handleDownload, handleDragStart, handleDragEnd } = createDocumentHandlers({
    dispatch, showError, filteredDocuments,
    moveToFolderMutate: moveToFolderMutation.mutate,
    editingDocument: ui.editingDocument,
    updateDocumentMutate: updateDocumentMutation.mutate,
    createDocumentMutate: createDocumentMutation.mutate,
  });

  useImperativeHandle(ref, () => ({ openCreate: handleOpenCreate }));

  const activeDoc = ui.activeId ? (filteredDocuments?.find((d) => d.id === ui.activeId) ?? null) : null;

  // ------ Render ------

  const isLoading = foldersLoading || documentsLoading;
  const isMutating =
    createDocumentMutation.isPending || updateDocumentMutation.isPending;

  return (
    <Box data-testid="documents.page">
      {!embedded && (
        <PageHeader
          title={t('documents.title')}
          subtitle={t('documents.subtitle')}
          action={
            selectedSiteId
              ? {
                  label: t('documents.createButton'),
                  icon: <AddIcon />,
                  onClick: handleOpenCreate,
                  hidden: !canWrite,
                }
              : undefined
          }
        />
      )}

      {!selectedSiteId ? (
        <EmptyState
          icon={<ArticleIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('documents.empty.noSite')}
        />
      ) : isLoading ? (
        <LoadingState label={t('documents.loading')} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box sx={{ display: 'flex', gap: 3 }}>
            <DocumentFolderSidebar
              folders={folders ?? []}
              selectedFolderId={ui.selectedFolderId}
              onSelectFolder={(id) => dispatch({ type: 'setSelectedFolder', id })}
              onCreateFolder={(name, parentId) => createFolderMutation.mutate({ name, parentId })}
              onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
              onDeleteFolder={(id) => dispatch({ type: 'openDeleteFolder', id })}
              canWrite={canWrite}
            />
            <DocumentContentArea
              searchQuery={ui.searchQuery}
              onSearchChange={(value) => dispatch({ type: 'setSearchQuery', value })}
              filteredDocuments={filteredDocuments}
              detailMap={detailMap}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onDownload={handleDownload}
              onEdit={handleOpenEdit}
              onDelete={(doc) => dispatch({ type: 'openDelete', doc })}
              onOpenCreate={handleOpenCreate}
              meta={documentsData?.meta}
              onPageChange={(p) => dispatch({ type: 'setPage', value: p })}
              onPageSizeChange={(pp) => dispatch({ type: 'setPageSize', value: pp })}
              detailError={!!documentDetailQueries.error}
              activeDoc={activeDoc}
              t={t}
            />
          </Box>
        </DndContext>
      )}

      <DocumentDialogs
        formOpen={ui.formOpen}
        editingDocument={ui.editingDocument}
        folders={folders ?? []}
        locales={locales}
        onFormSubmit={handleFormSubmit}
        onFormClose={() => dispatch({ type: 'closeForm' })}
        formLoading={isMutating}
        deletingDocument={ui.deletingDocument}
        onDeleteConfirm={() => ui.deletingDocument && deleteDocumentMutation.mutate(ui.deletingDocument.id)}
        onDeleteCancel={() => dispatch({ type: 'closeDelete' })}
        deleteLoading={deleteDocumentMutation.isPending}
        deletingFolderId={ui.deletingFolderId}
        onDeleteFolderConfirm={() => { if (ui.deletingFolderId) { deleteFolderMutation.mutate(ui.deletingFolderId); dispatch({ type: 'closeDeleteFolder' }); } }}
        onDeleteFolderCancel={() => dispatch({ type: 'closeDeleteFolder' })}
      />
    </Box>
  );
}

export default DocumentsPage;
