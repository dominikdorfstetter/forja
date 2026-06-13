import { useReducer, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArticleIcon from '@mui/icons-material/Article';
import { M3Button } from '@/components/design-system';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDocument,
  getDocumentFolders,
  getDocuments,
  unlockDocumentAccess,
} from '@/services/documents';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { DocumentListItem, DocumentResponse } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { getDocumentDisplayName } from '@/pages/DocumentCardGrid';
import DocumentContentArea from '@/pages/DocumentContentArea';
import DocumentFolderSidebar from '@/pages/DocumentFolderSidebar';
import DocumentDialogs from '@/pages/DocumentDialogs';
import DocumentPasswordDialog from '@/components/documents/DocumentPasswordDialog';
import DocumentPrivacyDialog from '@/components/documents/DocumentPrivacyDialog';
import { uiReducer, initialUIState } from '@/pages/DocumentsReducer';
import { createDocumentHandlers } from '@/pages/documentHandlers';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDocumentMutations } from '@/pages/useDocumentMutations';
import { queryKeys } from '@/lib/queryKeys';

function DocumentsPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ------ Data Queries ------

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: queryKeys.documentFolders(selectedSiteId),
    queryFn: () => getDocumentFolders(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: queryKeys.documents(selectedSiteId, ui.page, ui.pageSize, ui.selectedFolderId),
    queryFn: () => getDocuments(selectedSiteId, {
      page: ui.page,
      page_size: ui.pageSize,
      folder_id: ui.selectedFolderId ?? undefined,
    }),
    enabled: !!selectedSiteId,
  });

  const documents: DocumentListItem[] | undefined = documentsData?.data;

  const { data: siteSettings } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const passwordPolicy = useMemo(() => ({
    minLength: siteSettings?.document_password_min_length ?? 8,
    regex: siteSettings?.document_password_regex ?? '',
  }), [siteSettings]);

  const { data: siteLocalesRaw = [] } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = siteLocalesRaw
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at, site_count: 0 }));

  const { data: documentDetailsData, error: documentDetailsError } = useQuery({
    queryKey: queryKeys.documentDetails(documents?.map((d) => d.id)),
    queryFn: async () => {
      if (!documents || documents.length === 0) return [];
      return Promise.all(documents.map((d) => getDocument(d.id)));
    },
    enabled: !!documents && documents.length > 0,
  });

  const detailMap = useMemo(() => {
    const map = new Map<string, DocumentResponse>();
    if (documentDetailsData) {
      for (const detail of documentDetailsData) {
        map.set(detail.id, detail);
      }
    }
    return map;
  }, [documentDetailsData]);

  // 300ms debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'setDebouncedSearchQuery', value: ui.searchQuery }), 300);
    return () => clearTimeout(timer);
  }, [ui.searchQuery]);

  const filteredDocuments = useMemo(() => {
    if (!documents || !ui.debouncedSearchQuery.trim()) return documents;
    const q = ui.debouncedSearchQuery.toLowerCase();
    return documents.filter((doc) => {
      const displayName = getDocumentDisplayName(doc, detailMap).toLowerCase();
      const fileName = (doc.file_name || '').toLowerCase();
      const url = (doc.url || '').toLowerCase();
      const docType = doc.document_type.toLowerCase();
      return displayName.includes(q) || fileName.includes(q) || url.includes(q) || docType.includes(q);
    });
  }, [documents, ui.debouncedSearchQuery, detailMap]);

  // ------ Mutations ------

  const bulk = useBulkSelection([ui.page, ui.pageSize, ui.selectedFolderId]);

  const {
    createFolderMutation, renameFolderMutation, deleteFolderMutation,
    createDocumentMutation, updateDocumentMutation, deleteDocumentMutation,
    moveToFolderMutation,
    bulkDeleting, bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen, handleBulkDelete,
  } = useDocumentMutations({ selectedSiteId, dispatch, detailMap, bulk });

  // ------ Handlers ------

  const { handleOpenCreate, handleOpenEdit, handleFormSubmit, handleDownload, handleDragStart, handleDragEnd } = createDocumentHandlers({
    dispatch, showError, filteredDocuments,
    moveToFolderMutate: moveToFolderMutation.mutate,
    editingDocument: ui.editingDocument,
    updateDocumentMutate: updateDocumentMutation.mutate,
    createDocumentMutate: createDocumentMutation.mutate,
    onPrivateDownload: (doc) => dispatch({ type: 'openPassword', doc }),
  });

  const handleOpenPrivacy = async (doc: DocumentListItem) => {
    try {
      const detail = await getDocument(doc.id);
      dispatch({ type: 'openPrivacy', doc: detail });
    } catch (error) {
      showError(error);
    }
  };

  const handlePrivacySuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents(selectedSiteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documentDetails() });
  };

  const handleUnlock = (doc: DocumentListItem) => {
    dispatch({ type: 'openUnlock', doc });
  };

  const unlockMutation = useMutation({
    mutationFn: (id: string) => unlockDocumentAccess(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentDetails() });
      dispatch({ type: 'closeUnlock' });
    },
    onError: (error) => showError(error),
  });

  const activeDoc = ui.activeId ? (filteredDocuments?.find((d) => d.id === ui.activeId) ?? null) : null;

  // ------ Render ------

  const isLoading = foldersLoading || documentsLoading;
  const isMutating =
    createDocumentMutation.isPending || updateDocumentMutation.isPending;

  return (
    <Box data-testid="documents.page">
      {!embedded && (
        <PageHeader
          icon="folder"
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
              onPrivacy={handleOpenPrivacy}
              onUnlock={handleUnlock}
              onOpenCreate={handleOpenCreate}
              meta={documentsData?.meta}
              onPageChange={(p) => dispatch({ type: 'setPage', value: p })}
              onPageSizeChange={(pp) => dispatch({ type: 'setPageSize', value: pp })}
              detailError={!!documentDetailsError}
              activeDoc={activeDoc}
              t={t}
              selectedIds={bulk.selectedIds}
              onToggleSelect={bulk.toggle}
            />
            <DocumentFolderSidebar
              folders={folders ?? []}
              selectedFolderId={ui.selectedFolderId}
              onSelectFolder={(id) => dispatch({ type: 'setSelectedFolder', id })}
              onCreateFolder={(name, parentId) => createFolderMutation.mutate({ name, parentId })}
              onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
              onDeleteFolder={(id) => dispatch({ type: 'openDeleteFolder', id })}
              canWrite={canWrite}
            />
          </Box>
        </DndContext>
      )}

      <DocumentDialogs
        formOpen={ui.formOpen}
        editingDocument={ui.editingDocument}
        folders={folders ?? []}
        locales={locales}
        selectedFolderId={ui.selectedFolderId}
        passwordPolicy={passwordPolicy}
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

      <DocumentPasswordDialog
        open={!!ui.passwordDocument}
        onClose={() => dispatch({ type: 'closePassword' })}
        document={ui.passwordDocument}
      />

      <DocumentPrivacyDialog
        open={!!ui.privacyDocument}
        onClose={() => dispatch({ type: 'closePrivacy' })}
        document={ui.privacyDocument}
        onSuccess={handlePrivacySuccess}
        passwordPolicy={passwordPolicy}
      />

      <ConfirmDialog open={bulkDeleteConfirmOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteConfirmOpen(false)} loading={bulkDeleting} />

      <ConfirmDialog
        open={!!ui.unlockingDocument}
        title={t('documents.privacy.unlockTitle')}
        message={t('documents.privacy.unlockConfirm')}
        confirmLabel={t('documents.privacy.unlock')}
        onConfirm={() => ui.unlockingDocument && unlockMutation.mutate(ui.unlockingDocument.id)}
        onCancel={() => dispatch({ type: 'closeUnlock' })}
        loading={unlockMutation.isPending}
      />

      {bulk.count > 0 && (
        <Box
          data-testid="documents-bulk-bar"
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1,
            borderRadius: '999px',
            bgcolor: 'var(--surface-container-highest)',
            border: '1px solid var(--outline-variant)',
            boxShadow: '0 8px 24px -6px rgb(0 0 0 / 0.35)',
            backdropFilter: 'blur(12px)',
            animation: 'var(--motion-fade-in-up)',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'var(--on-surface)',
              px: 1,
              fontVariationSettings: '"wght" 600, "opsz" 14',
            }}
          >
            {t('bulk.selectedCount', { count: bulk.count })}
          </Typography>
          <M3Button variant="filled" size="sm" icon="delete" danger onClick={() => setBulkDeleteConfirmOpen(true)}>
            {t('common.actions.delete')}
          </M3Button>
          <M3Button variant="ghost" size="sm" onClick={bulk.clear}>
            {t('bulk.clearSelection')}
          </M3Button>
        </Box>
      )}
    </Box>
  );
}

export default DocumentsPage;
