import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import {
  Box,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import { Icon } from '@/components/design-system';
import { pageTabsSx } from '@/components/shared/listPageV2';
import { LibraryBulkBar, LibraryFolderSidebar } from '@/components/shared/library';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MediaUploadDialog from '@/components/media/MediaUploadDialog';
import MediaDetailDialog from '@/components/media/MediaDetailDialog';
import DocumentsPage from '@/pages/Documents';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import MediaGrid from '@/components/media/MediaGrid';
import MediaDragOverlay from '@/components/media/MediaDragOverlay';
import MediaFilterChips from '@/components/media/MediaFilterChips';
import MediaTagFilter from '@/components/media/MediaTagFilter';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useMediaMutations } from '@/pages/useMediaMutations';
import {
  hasActiveMediaFilters,
  initialMediaPageState,
  mediaReducer,
  needsMediaTabRedirect,
  resolveMediaTab,
  type MediaTabSlug,
} from './media-library/mediaLibraryState';
import { useMediaLibraryQueries } from './media-library/useMediaLibraryQueries';
import MediaLibraryStatus from './media-library/MediaLibraryStatus';
import MediaLibraryToolbar from './media-library/MediaLibraryToolbar';
import MediaDeleteFileDialog from './media-library/MediaDeleteFileDialog';

export default function MediaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { modules } = useSiteContextData();

  const [state, dispatch] = useReducer(mediaReducer, initialMediaPageState);
  const [forceDelete, setForceDelete] = useState(false);

  const activeTab = resolveMediaTab(urlTab, modules.documents);

  useEffect(() => {
    if (needsMediaTabRedirect(urlTab, modules.documents)) {
      navigate('/media/library', { replace: true });
    }
  }, [urlTab, modules.documents, navigate]);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'upload-media') dispatch({ type: 'SET_UPLOAD_OPEN', payload: true });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  // 300ms debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: state.searchInput }), 300);
    return () => clearTimeout(timer);
  }, [state.searchInput]);

  // Reset page when search query changes
  const prevSearchRef = useRef(state.debouncedSearch);
  useEffect(() => {
    if (prevSearchRef.current !== state.debouncedSearch) {
      prevSearchRef.current = state.debouncedSearch;
      dispatch({ type: 'SET_PAGE', payload: 1 });
    }
  });

  const {
    mediaFiles, pageMeta, isLoading, error,
    mediaCategoryCounts, siteTags, siteTagsLoading, folders,
  } = useMediaLibraryQueries(selectedSiteId, state);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Bulk selection
  const bulk = useBulkSelection([state.page, state.pageSize, state.debouncedSearch, state.mimeCategory, state.selectedFolderId]);

  const {
    uploadMutation, deleteMutation, moveToFolderMutation,
    createFolderMutation, renameFolderMutation, deleteFolderMutation,
    bulkDeleting, bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen, handleBulkDelete,
  } = useMediaMutations({ selectedSiteId, selectedFolderId: state.selectedFolderId, dispatch, bulk });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: event.active.id as string });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: null });
    const { active, over } = event;
    if (!over) return;

    const folderId = over.data.current?.folderId as string | null;
    const mediaId = active.id as string;

    // Don't move if dropped on the same folder it's already in
    const file = mediaFiles.find((f) => f.id === mediaId);
    if (!file) return;
    if (folderId === (file.folder_id ?? null)) return;

    moveToFolderMutation.mutate({
      id: mediaId,
      folder_id: folderId ?? undefined,
    });
  }, [mediaFiles, moveToFolderMutation]);

  const activeFile = mediaFiles.find((f) => f.id === state.activeId);

  const activeTabLabel = t(
    activeTab === 'documents' ? 'layout.sidebar.documents' : 'layout.sidebar.media',
  );

  return (
    <Box data-testid="media.page">
      <PageHeader
        icon="perm_media"
        title={t('layout.sidebar.assets')}
        subtitle={activeTab === 'library' ? t('media.subtitle') : t('documents.subtitle')}
        breadcrumbs={[
          { label: t('layout.sidebar.content') },
          { label: t('layout.sidebar.assets') },
          { label: activeTabLabel },
        ]}
      />

      {modules.documents && (
        <Tabs
          value={activeTab}
          onChange={(_, v: MediaTabSlug) => navigate(`/media/${v}`)}
          sx={pageTabsSx}
        >
          <Tab
            icon={<Icon name="perm_media" size={20} />}
            iconPosition="start"
            label={t('layout.sidebar.media')}
            value="library"
          />
          <Tab
            icon={<Icon name="article" size={20} />}
            iconPosition="start"
            label={t('layout.sidebar.documents')}
            value="documents"
          />
        </Tabs>
      )}

      {activeTab === 'documents' && <DocumentsPage embedded />}

      {activeTab === 'library' && (<>

      <MediaLibraryStatus hasSite={!!selectedSiteId} isLoading={isLoading} hasError={!!error}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box data-testid="media-library" sx={{ display: 'flex', gap: 3 }}>
            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MediaLibraryToolbar
                searchInput={state.searchInput}
                onSearchChange={(value) => dispatch({ type: 'SET_SEARCH_INPUT', payload: value })}
                canWrite={canWrite}
                onUploadClick={() => dispatch({ type: 'SET_UPLOAD_OPEN', payload: true })}
              />

              <MediaTagFilter
                tags={siteTags}
                activeTags={state.filterTags}
                loading={siteTagsLoading}
                onToggle={(tag) => dispatch({ type: 'TOGGLE_FILTER_TAG', payload: tag })}
              />

              <MediaFilterChips
                mimeCategory={state.mimeCategory}
                counts={mediaCategoryCounts}
                onToggleCategory={(key) => dispatch({ type: 'TOGGLE_MIME_CATEGORY', payload: key })}
              />

              <MediaGrid
                mediaFiles={mediaFiles}
                hasActiveFilters={hasActiveMediaFilters(state)}
                selectedFolderId={state.selectedFolderId}
                canWrite={canWrite}
                isAdmin={isAdmin}
                onUploadClick={() => dispatch({ type: 'SET_UPLOAD_OPEN', payload: true })}
                onEditFile={(file) => dispatch({ type: 'SET_DETAIL_FILE', payload: file })}
                onDeleteFile={(file) => dispatch({ type: 'SET_DELETING_FILE', payload: file })}
                selected={bulk.selectedIds}
                onToggleSelect={bulk.toggle}
                selectionMode={bulk.count > 0}
              />

              {pageMeta && (
                <TablePagination
                  component="div"
                  count={pageMeta.total_items}
                  page={pageMeta.page - 1}
                  onPageChange={(_, p) => dispatch({ type: 'SET_PAGE', payload: p + 1 })}
                  rowsPerPage={pageMeta.page_size}
                  onRowsPerPageChange={(e) => dispatch({ type: 'SET_PER_PAGE', payload: +e.target.value })}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Box>

            {/* Folder sidebar (right) */}
            <LibraryFolderSidebar
              folders={folders}
              selectedFolderId={state.selectedFolderId}
              canWrite={canWrite}
              onSelectFolder={(id) => dispatch({ type: 'SELECT_FOLDER', payload: id })}
              onCreateFolder={(name) => createFolderMutation.mutate(name)}
              onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
              onDeleteFolder={(id) => dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: id })}
            />
          </Box>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeFile ? <MediaDragOverlay file={activeFile} /> : null}
          </DragOverlay>
        </DndContext>
      </MediaLibraryStatus>

      <MediaUploadDialog
        open={state.uploadOpen}
        onSubmit={async (file, isGlobal) => {
          await uploadMutation.mutateAsync({ file, isGlobal });
        }}
        onClose={() => dispatch({ type: 'SET_UPLOAD_OPEN', payload: false })}
        loading={uploadMutation.isPending}
      />
      <MediaDetailDialog open={!!state.detailFile} media={state.detailFile} folders={folders} onClose={() => dispatch({ type: 'SET_DETAIL_FILE', payload: null })} />
      <MediaDeleteFileDialog
        file={state.deletingFile}
        isAdmin={isAdmin}
        forceDelete={forceDelete}
        onForceDeleteChange={setForceDelete}
        loading={deleteMutation.isPending}
        onConfirm={(file) => deleteMutation.mutate({ id: file.id, force: forceDelete })}
        onCancel={() => { dispatch({ type: 'SET_DELETING_FILE', payload: null }); setForceDelete(false); }}
      />
      <ConfirmDialog open={!!state.deletingFolderId} title={t('media.deleteFolderDialog.title')} message={t('media.deleteFolderDialog.message')} confirmLabel={t('common.actions.delete')} onConfirm={() => { if (state.deletingFolderId) { deleteFolderMutation.mutate(state.deletingFolderId); dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null }); } }} onCancel={() => dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null })} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkDeleteConfirmOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteConfirmOpen(false)} loading={bulkDeleting} />

      <LibraryBulkBar count={bulk.count} onDelete={() => setBulkDeleteConfirmOpen(true)} onClear={bulk.clear} testId="media-bulk-bar" />
      </>)}
    </Box>
  );
}
