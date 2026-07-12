import { useReducer, useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import {
  Box,
  Alert,
  Typography,
  Tabs,
  Tab,
  TablePagination,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { M3Button, Icon } from '@/components/design-system';
import { pageTabsSx } from '@/components/shared/listPageV2';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { getMedia, getMediaCategoryCounts, getMediaFolders, getSiteTags } from '@/services/media';
import type { MediaListItem, MediaFolder } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MediaUploadDialog from '@/components/media/MediaUploadDialog';
import MediaDetailDialog from '@/components/media/MediaDetailDialog';
import FolderTree from '@/components/shared/FolderTree';
import DocumentsPage from '@/pages/Documents';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import MediaGrid from '@/components/media/MediaGrid';
import MediaDragOverlay from '@/components/media/MediaDragOverlay';
import MediaSearchBar from '@/components/media/MediaSearchBar';
import MediaFilterChips from '@/components/media/MediaFilterChips';
import MediaTagFilter from '@/components/media/MediaTagFilter';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useMediaMutations } from '@/pages/useMediaMutations';
import { queryKeys } from '@/lib/queryKeys';

// --- Reducer ---

interface MediaPageState {
  page: number;
  pageSize: number;
  uploadOpen: boolean;
  deletingFile: MediaListItem | null;
  deletingFolderId: string | null;
  detailFile: MediaListItem | null;
  selectedFolderId: string | null;
  activeId: string | null;
  searchInput: string;
  debouncedSearch: string;
  mimeCategory: string | null;
  filterTags: string[];
}

type MediaPageAction =
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PER_PAGE'; payload: number }
  | { type: 'SET_UPLOAD_OPEN'; payload: boolean }
  | { type: 'SET_DELETING_FILE'; payload: MediaListItem | null }
  | { type: 'SET_DELETING_FOLDER_ID'; payload: string | null }
  | { type: 'SET_DETAIL_FILE'; payload: MediaListItem | null }
  | { type: 'SET_SELECTED_FOLDER'; payload: string | null }
  | { type: 'SET_ACTIVE_ID'; payload: string | null }
  | { type: 'SET_SEARCH_INPUT'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_MIME_CATEGORY'; payload: string | null }
  | { type: 'SELECT_FOLDER'; payload: string | null }
  | { type: 'TOGGLE_MIME_CATEGORY'; payload: string }
  | { type: 'TOGGLE_FILTER_TAG'; payload: string }
  | { type: 'CLEAR_FILTER_TAGS' };

const initialState: MediaPageState = {
  page: 1,
  pageSize: 25,
  uploadOpen: false,
  deletingFile: null,
  deletingFolderId: null,
  detailFile: null,
  selectedFolderId: null,
  activeId: null,
  searchInput: '',
  debouncedSearch: '',
  mimeCategory: null,
  filterTags: [],
};

function mediaReducer(state: MediaPageState, action: MediaPageAction): MediaPageState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_PER_PAGE':
      return { ...state, pageSize: action.payload, page: 1 };
    case 'SET_UPLOAD_OPEN':
      return { ...state, uploadOpen: action.payload };
    case 'SET_DELETING_FILE':
      return { ...state, deletingFile: action.payload };
    case 'SET_DELETING_FOLDER_ID':
      return { ...state, deletingFolderId: action.payload };
    case 'SET_DETAIL_FILE':
      return { ...state, detailFile: action.payload };
    case 'SET_SELECTED_FOLDER':
      return { ...state, selectedFolderId: action.payload };
    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload };
    case 'SET_SEARCH_INPUT':
      return { ...state, searchInput: action.payload };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearch: action.payload };
    case 'SET_MIME_CATEGORY':
      return { ...state, mimeCategory: action.payload };
    case 'SELECT_FOLDER':
      return { ...state, selectedFolderId: action.payload, page: 1 };
    case 'TOGGLE_MIME_CATEGORY':
      return {
        ...state,
        mimeCategory: state.mimeCategory === action.payload ? null : action.payload,
        page: 1,
      };
    case 'TOGGLE_FILTER_TAG': {
      const tag = action.payload;
      const tags = state.filterTags.includes(tag)
        ? state.filterTags.filter((t) => t !== tag)
        : [...state.filterTags, tag];
      return { ...state, filterTags: tags, page: 1 };
    }
    case 'CLEAR_FILTER_TAGS':
      return { ...state, filterTags: [], page: 1 };
    default:
      return state;
  }
}

const TAB_SLUGS = ['library', 'documents'] as const;
type TabSlug = (typeof TAB_SLUGS)[number];

export default function MediaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { modules } = useSiteContextData();

  const [state, dispatch] = useReducer(mediaReducer, initialState);
  const [forceDelete, setForceDelete] = useState(false);

  const activeTab: TabSlug =
    urlTab === 'documents' && modules.documents ? 'documents' : 'library';

  useEffect(() => {
    if (!urlTab) {
      navigate('/media/library', { replace: true });
      return;
    }
    if (!TAB_SLUGS.includes(urlTab as TabSlug)) {
      navigate('/media/library', { replace: true });
      return;
    }
    if (urlTab === 'documents' && !modules.documents) {
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

  // Build query params for server-side filtering
  const queryParams: Record<string, string | number> = { page: state.page, page_size: state.pageSize };
  if (state.debouncedSearch) queryParams.search = state.debouncedSearch;
  if (state.mimeCategory) queryParams.mime_category = state.mimeCategory;
  if (state.selectedFolderId) queryParams.folder_id = state.selectedFolderId;
  if (state.filterTags.length > 0) queryParams.tags = state.filterTags.join(',');

  const { data: mediaData, isLoading, error } = useQuery({
    queryKey: queryKeys.media(selectedSiteId, state.debouncedSearch, state.mimeCategory, state.selectedFolderId, state.filterTags, state.page, state.pageSize),
    queryFn: () => getMedia(selectedSiteId, queryParams),
    enabled: !!selectedSiteId,
  });

  const { data: mediaCategoryCounts } = useQuery({
    queryKey: queryKeys.mediaCategoryCounts(selectedSiteId),
    queryFn: () => getMediaCategoryCounts(selectedSiteId),
    enabled: !!selectedSiteId,
    placeholderData: (prev) => prev,
  });

  const { data: siteTagsData, isLoading: siteTagsLoading } = useQuery({
    queryKey: queryKeys.siteTags(selectedSiteId),
    queryFn: () => getSiteTags(selectedSiteId, { limit: 10 }),
    enabled: !!selectedSiteId,
    // Keep the previous tag list visible while a refetch runs so the
    // filter strip doesn't flash empty between site switches / tag
    // refreshes — the user was seeing the chips "sometimes not
    // loading" because every refetch momentarily emptied the data.
    placeholderData: (prev) => prev,
  });

  const { data: folders = [] } = useQuery({
    queryKey: queryKeys.mediaFolders(selectedSiteId),
    queryFn: () => getMediaFolders(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const mediaFiles = useMemo(() => mediaData?.data || [], [mediaData?.data]);

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

  const folderItems = folders.map((f: MediaFolder) => ({
    id: f.id,
    parent_id: f.parent_id,
    name: f.name,
    display_order: f.display_order,
  }));

  const hasActiveFilters = !!state.debouncedSearch || !!state.mimeCategory || !!state.selectedFolderId || state.filterTags.length > 0;

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

  const activeFile = state.activeId ? mediaFiles.find((f) => f.id === state.activeId) : null;

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
          onChange={(_, v: TabSlug) => navigate(`/media/${v}`)}
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

      {activeTab === 'documents' && modules.documents && <DocumentsPage embedded />}

      {activeTab === 'library' && (<>

      {!selectedSiteId ? (
        <EmptyState icon={<ImageIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('media.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('media.loading')} />
      ) : error ? (
        <Alert severity="error">{t('media.loadError')}</Alert>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box data-testid="media-library" sx={{ display: 'flex', gap: 3 }}>
            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <Box sx={{ flex: '1 1 auto', maxWidth: 520 }}>
                  <MediaSearchBar
                    searchInput={state.searchInput}
                    onSearchChange={(value) => dispatch({ type: 'SET_SEARCH_INPUT', payload: value })}
                  />
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                {canWrite && (
                  <M3Button
                    variant="filled"
                    icon="add"
                    onClick={() => dispatch({ type: 'SET_UPLOAD_OPEN', payload: true })}
                  >
                    {t('media.uploadButton')}
                  </M3Button>
                )}
              </Box>

              <MediaTagFilter
                tags={siteTagsData?.tags ?? []}
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
                hasActiveFilters={hasActiveFilters}
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

              {mediaData?.meta && (
                <TablePagination
                  component="div"
                  count={mediaData.meta.total_items}
                  page={mediaData.meta.page - 1}
                  onPageChange={(_, p) => dispatch({ type: 'SET_PAGE', payload: p + 1 })}
                  rowsPerPage={mediaData.meta.page_size}
                  onRowsPerPageChange={(e) => dispatch({ type: 'SET_PER_PAGE', payload: +e.target.value })}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Box>

            {/* Folder sidebar (right) */}
            <Box
              sx={{
                width: 260,
                minWidth: 260,
                flexShrink: 0,
                alignSelf: 'flex-start',
                bgcolor: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '20px',
                overflow: 'hidden',
                py: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  px: 2,
                  py: 1,
                  color: 'var(--on-surface-variant)',
                  fontVariationSettings: '"wght" 600, "opsz" 14',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontSize: 11,
                }}
              >
                {t('media.folders')}
              </Typography>
              <FolderTree
                folders={folderItems}
                selectedFolderId={state.selectedFolderId}
                onSelectFolder={(id) => dispatch({ type: 'SELECT_FOLDER', payload: id })}
                onCreateFolder={(name) => createFolderMutation.mutate(name)}
                onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
                onDeleteFolder={(id) => dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: id })}
                canWrite={canWrite}
                droppable={canWrite}
              />
            </Box>
          </Box>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeFile ? <MediaDragOverlay file={activeFile} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <MediaUploadDialog
        open={state.uploadOpen}
        onSubmit={async (file, isGlobal) => {
          await uploadMutation.mutateAsync({ file, isGlobal });
        }}
        onClose={() => dispatch({ type: 'SET_UPLOAD_OPEN', payload: false })}
        loading={uploadMutation.isPending}
      />
      <MediaDetailDialog open={!!state.detailFile} media={state.detailFile} folders={folders} onClose={() => dispatch({ type: 'SET_DETAIL_FILE', payload: null })} />
      <ConfirmDialog
        open={!!state.deletingFile}
        title={t('media.deleteDialog.title')}
        message={t('media.deleteDialog.message', { filename: state.deletingFile?.original_filename })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => state.deletingFile && deleteMutation.mutate({ id: state.deletingFile.id, force: forceDelete })}
        onCancel={() => { dispatch({ type: 'SET_DELETING_FILE', payload: null }); setForceDelete(false); }}
        loading={deleteMutation.isPending}
      >
        {isAdmin && (
          <FormControlLabel
            control={<Checkbox checked={forceDelete} onChange={(e) => setForceDelete(e.target.checked)} size="small" />}
            label={t('media.deleteDialog.forceDelete', 'Force delete (even if in use)')}
            sx={{ mt: 1 }}
          />
        )}
      </ConfirmDialog>
      <ConfirmDialog open={!!state.deletingFolderId} title={t('media.deleteFolderDialog.title')} message={t('media.deleteFolderDialog.message')} confirmLabel={t('common.actions.delete')} onConfirm={() => { if (state.deletingFolderId) { deleteFolderMutation.mutate(state.deletingFolderId); dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null }); } }} onCancel={() => dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null })} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkDeleteConfirmOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteConfirmOpen(false)} loading={bulkDeleting} />

      {/* Bulk action bar */}
      {bulk.count > 0 && (
        <Box
          data-testid="media-bulk-bar"
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
      </>)}
    </Box>
  );
}
