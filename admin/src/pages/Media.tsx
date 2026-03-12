import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Typography,
  Divider,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
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
import DocumentsPage, { type DocumentsPageHandle } from '@/pages/Documents';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import MediaGrid from '@/components/media/MediaGrid';
import MediaDragOverlay from '@/components/media/MediaDragOverlay';
import MediaSearchBar from '@/components/media/MediaSearchBar';
import MediaFilterChips from '@/components/media/MediaFilterChips';

// --- Reducer ---

interface MediaPageState {
  assetsTab: number;
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
}

type MediaPageAction =
  | { type: 'SET_ASSETS_TAB'; payload: number }
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
  | { type: 'TOGGLE_MIME_CATEGORY'; payload: string };

const initialState: MediaPageState = {
  assetsTab: 0,
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
};

function mediaReducer(state: MediaPageState, action: MediaPageAction): MediaPageState {
  switch (action.type) {
    case 'SET_ASSETS_TAB':
      return { ...state, assetsTab: action.payload };
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
    default:
      return state;
  }
}

export default function MediaPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { modules } = useSiteContextData();

  const documentsRef = useRef<DocumentsPageHandle>(null);
  const [state, dispatch] = useReducer(mediaReducer, initialState);

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
  if (prevSearchRef.current !== state.debouncedSearch) {
    prevSearchRef.current = state.debouncedSearch;
    dispatch({ type: 'SET_PAGE', payload: 1 });
  }

  // Build query params for server-side filtering
  const queryParams: Record<string, string | number> = { page: state.page, page_size: state.pageSize };
  if (state.debouncedSearch) queryParams.search = state.debouncedSearch;
  if (state.mimeCategory) queryParams.mime_category = state.mimeCategory;
  if (state.selectedFolderId) queryParams.folder_id = state.selectedFolderId;

  const { data: mediaData, isLoading, error } = useQuery({
    queryKey: ['media', selectedSiteId, state.debouncedSearch, state.mimeCategory, state.selectedFolderId, state.page, state.pageSize],
    queryFn: () => apiService.getMedia(selectedSiteId, queryParams),
    enabled: !!selectedSiteId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['media-folders', selectedSiteId],
    queryFn: () => apiService.getMediaFolders(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const mediaFiles = useMemo(() => mediaData?.data || [], [mediaData?.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const uploadMutation = useMutation({
    mutationFn: ({ file, isGlobal }: { file: File; isGlobal: boolean }) =>
      apiService.uploadMediaFile(
        file,
        [selectedSiteId],
        state.selectedFolderId ?? undefined,
        isGlobal,
      ),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media'] }); dispatch({ type: 'SET_UPLOAD_OPEN', payload: false }); showSuccess(t('media.upload.success')); },
    onError: (error) => { showError(error); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMedia(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media'] }); dispatch({ type: 'SET_DELETING_FILE', payload: null }); showSuccess(t('media.messages.deleted')); },
    onError: (error) => { showError(error); },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      apiService.updateMedia(id, { folder_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      showSuccess(t('media.messages.moved'));
    },
    onError: (error) => { showError(error); },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => apiService.createMediaFolder(selectedSiteId, { name, display_order: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); showSuccess(t('media.messages.folderCreated')); },
    onError: (error) => { showError(error); },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiService.updateMediaFolder(id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); showSuccess(t('media.messages.folderRenamed')); },
    onError: (error) => { showError(error); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMediaFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      if (state.selectedFolderId) dispatch({ type: 'SET_SELECTED_FOLDER', payload: null });
      showSuccess(t('media.messages.folderDeleted'));
    },
    onError: (error) => { showError(error); },
  });

  const folderItems = folders.map((f: MediaFolder) => ({
    id: f.id,
    parent_id: f.parent_id,
    name: f.name,
    display_order: f.display_order,
  }));

  const hasActiveFilters = !!state.debouncedSearch || !!state.mimeCategory || !!state.selectedFolderId;

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

  // Determine the PageHeader action based on which tab is active
  const headerAction = selectedSiteId && canWrite
    ? state.assetsTab === 0
      ? { label: t('media.uploadButton'), icon: <AddIcon />, onClick: () => dispatch({ type: 'SET_UPLOAD_OPEN', payload: true }) }
      : { label: t('documents.createButton'), icon: <AddIcon />, onClick: () => documentsRef.current?.openCreate() }
    : undefined;

  return (
    <Box data-testid="media.page">
      <PageHeader
        title={t('layout.sidebar.assets')}
        subtitle={state.assetsTab === 0 ? t('media.subtitle') : t('documents.subtitle')}
        action={headerAction}
      />

      {modules.documents && (
        <Tabs value={state.assetsTab} onChange={(_, v) => dispatch({ type: 'SET_ASSETS_TAB', payload: v })} sx={{ mb: 3 }}>
          <Tab icon={<PermMediaIcon />} iconPosition="start" label={t('layout.sidebar.media')} />
          <Tab icon={<ArticleIcon />} iconPosition="start" label={t('layout.sidebar.documents')} />
        </Tabs>
      )}

      {modules.documents && state.assetsTab === 1 && <DocumentsPage ref={documentsRef} embedded />}

      {state.assetsTab === 0 && (<>

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
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Folder sidebar */}
            <Paper
              variant="outlined"
              sx={{
                width: 260,
                minWidth: 260,
                flexShrink: 0,
                alignSelf: 'flex-start',
                py: 1,
              }}
            >
              <Typography variant="subtitle2" sx={{ px: 2, py: 1 }} color="text.secondary">
                {t('media.folders')}
              </Typography>
              <Divider />
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
            </Paper>

            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MediaSearchBar
                searchInput={state.searchInput}
                onSearchChange={(value) => dispatch({ type: 'SET_SEARCH_INPUT', payload: value })}
              />

              <MediaFilterChips
                mimeCategory={state.mimeCategory}
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
      <ConfirmDialog open={!!state.deletingFile} title={t('media.deleteDialog.title')} message={t('media.deleteDialog.message', { filename: state.deletingFile?.original_filename })} confirmLabel={t('common.actions.delete')} onConfirm={() => state.deletingFile && deleteMutation.mutate(state.deletingFile.id)} onCancel={() => dispatch({ type: 'SET_DELETING_FILE', payload: null })} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={!!state.deletingFolderId} title={t('media.deleteFolderDialog.title')} message={t('media.deleteFolderDialog.message')} confirmLabel={t('common.actions.delete')} onConfirm={() => { if (state.deletingFolderId) { deleteFolderMutation.mutate(state.deletingFolderId); dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null }); } }} onCancel={() => dispatch({ type: 'SET_DELETING_FOLDER_ID', payload: null })} confirmationText={t('common.actions.delete')} />
      </>)}
    </Box>
  );
}
