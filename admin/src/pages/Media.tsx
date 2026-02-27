import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  TextField,
  InputAdornment,
  Stack,
  TablePagination,
  Tabs,
  Tab,
} from '@mui/material';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
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
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
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
import DraggableMediaCard from '@/components/media/DraggableMediaCard';
import DocumentsPage, { type DocumentsPageHandle } from '@/pages/Documents';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon sx={{ fontSize: 48 }} color="primary" />;
  if (mimeType.startsWith('video/')) return <VideoFileIcon sx={{ fontSize: 48 }} color="secondary" />;
  if (mimeType.startsWith('audio/')) return <AudioFileIcon sx={{ fontSize: 48 }} color="info" />;
  return <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />;
}

function getMimeChipColor(mimeType: string): 'primary' | 'secondary' | 'info' | 'warning' | 'default' {
  if (mimeType.startsWith('image/')) return 'primary';
  if (mimeType.startsWith('video/')) return 'secondary';
  if (mimeType.startsWith('audio/')) return 'info';
  if (mimeType.startsWith('application/')) return 'warning';
  return 'default';
}

function getMimeSmallIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon fontSize="small" color="primary" />;
  if (mimeType.startsWith('video/')) return <VideoFileIcon fontSize="small" color="secondary" />;
  if (mimeType.startsWith('audio/')) return <AudioFileIcon fontSize="small" color="info" />;
  return <InsertDriveFileIcon fontSize="small" color="action" />;
}

const MIME_CATEGORIES = [
  { key: 'image', labelKey: 'media.categories.images', icon: <ImageIcon fontSize="small" /> },
  { key: 'video', labelKey: 'media.categories.videos', icon: <VideoFileIcon fontSize="small" /> },
  { key: 'audio', labelKey: 'media.categories.audio', icon: <AudioFileIcon fontSize="small" /> },
  { key: 'document', labelKey: 'media.categories.documents', icon: <InsertDriveFileIcon fontSize="small" /> },
] as const;

export default function MediaPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const documentsRef = useRef<DocumentsPageHandle>(null);
  const [assetsTab, setAssetsTab] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<MediaListItem | null>(null);
  const [detailFile, setDetailFile] = useState<MediaListItem | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Search & filter state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mimeCategory, setMimeCategory] = useState<string | null>(null);

  // 300ms debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build query params for server-side filtering
  const queryParams: Record<string, string | number> = { page, per_page: perPage };
  if (debouncedSearch) queryParams.search = debouncedSearch;
  if (mimeCategory) queryParams.mime_category = mimeCategory;
  if (selectedFolderId) queryParams.folder_id = selectedFolderId;

  const { data: mediaData, isLoading, error } = useQuery({
    queryKey: ['media', selectedSiteId, debouncedSearch, mimeCategory, selectedFolderId, page, perPage],
    queryFn: () => apiService.getMedia(selectedSiteId, queryParams),
    enabled: !!selectedSiteId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['media-folders', selectedSiteId],
    queryFn: () => apiService.getMediaFolders(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const mediaFiles = mediaData?.data || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const uploadMutation = useMutation({
    mutationFn: ({ file, isGlobal }: { file: File; isGlobal: boolean }) =>
      apiService.uploadMediaFile(
        file,
        [selectedSiteId],
        selectedFolderId ?? undefined,
        isGlobal,
      ),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media'] }); setUploadOpen(false); enqueueSnackbar(t('media.upload.success'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMedia(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media'] }); setDeletingFile(null); enqueueSnackbar(t('media.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      apiService.updateMedia(id, { folder_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      enqueueSnackbar(t('media.messages.moved'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => apiService.createMediaFolder(selectedSiteId, { name, display_order: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); enqueueSnackbar(t('media.messages.folderCreated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiService.updateMediaFolder(id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['media-folders'] }); enqueueSnackbar(t('media.messages.folderRenamed'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMediaFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      if (selectedFolderId) setSelectedFolderId(null);
      enqueueSnackbar(t('media.messages.folderDeleted'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const folderItems = folders.map((f: MediaFolder) => ({
    id: f.id,
    parent_id: f.parent_id,
    name: f.name,
    display_order: f.display_order,
  }));

  const hasActiveFilters = !!debouncedSearch || !!mimeCategory || !!selectedFolderId;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
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

  const activeFile = activeId ? mediaFiles.find((f) => f.id === activeId) : null;

  // Determine the PageHeader action based on which tab is active
  const headerAction = selectedSiteId && canWrite
    ? assetsTab === 0
      ? { label: t('media.uploadButton'), icon: <AddIcon />, onClick: () => setUploadOpen(true) }
      : { label: t('documents.createButton'), icon: <AddIcon />, onClick: () => documentsRef.current?.openCreate() }
    : undefined;

  return (
    <Box>
      <PageHeader
        title={t('layout.sidebar.assets')}
        subtitle={assetsTab === 0 ? t('media.subtitle') : t('documents.subtitle')}
        action={headerAction}
      />

      <Tabs value={assetsTab} onChange={(_, v) => setAssetsTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<PermMediaIcon />} iconPosition="start" label={t('layout.sidebar.media')} />
        <Tab icon={<ArticleIcon />} iconPosition="start" label={t('layout.sidebar.documents')} />
      </Tabs>

      {assetsTab === 1 && <DocumentsPage ref={documentsRef} embedded />}

      {assetsTab === 0 && (<>

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
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => { setSelectedFolderId(id); setPage(1); }}
                onCreateFolder={(name) => createFolderMutation.mutate(name)}
                onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
                onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
                canWrite={canWrite}
                droppable={canWrite}
              />
            </Paper>

            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Search bar */}
              <TextField
                fullWidth
                size="small"
                placeholder={t('media.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchInput ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchInput('')} edge="end">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ mb: 2 }}
              />

              {/* MIME category filter chips */}
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {MIME_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.key}
                    icon={cat.icon}
                    label={t(cat.labelKey)}
                    variant={mimeCategory === cat.key ? 'filled' : 'outlined'}
                    color={mimeCategory === cat.key ? 'primary' : 'default'}
                    onClick={() => { setMimeCategory(mimeCategory === cat.key ? null : cat.key); setPage(1); }}
                    size="small"
                  />
                ))}
              </Stack>

              {/* Media grid */}
              {mediaFiles.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon sx={{ fontSize: 64 }} />}
                  title={hasActiveFilters ? t('media.empty.noMatch') : t('media.empty.title')}
                  description={
                    hasActiveFilters
                      ? t('media.empty.noMatchDescription')
                      : selectedFolderId
                        ? t('media.empty.noFilesInFolder')
                        : t('media.empty.description')
                  }
                  action={!hasActiveFilters && !selectedFolderId && canWrite ? { label: t('media.uploadButton'), onClick: () => setUploadOpen(true) } : undefined}
                />
              ) : (
                <Grid container spacing={2}>
                  {mediaFiles.map((file) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                      <DraggableMediaCard file={file}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'box-shadow 0.2s, transform 0.2s',
                            '&:hover': {
                              boxShadow: 6,
                              transform: 'translateY(-2px)',
                            },
                            '&:hover .media-actions': { opacity: 1 },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              pt: 2,
                            }}
                          >
                            {file.public_url && file.mime_type.startsWith('image/') ? (
                              <Box component="img" src={file.public_url} alt={file.filename} sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }} />
                            ) : (
                              getMimeIcon(file.mime_type)
                            )}
                          </Box>
                          <CardContent sx={{ pb: 0, flexGrow: 1 }}>
                            <Typography variant="body2" noWrap title={file.original_filename}>{file.original_filename}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mt: 0.5 }}>
                              {formatFileSize(file.file_size)}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                              <Chip
                                label={file.mime_type.split('/')[1]}
                                size="small"
                                variant="outlined"
                                color={getMimeChipColor(file.mime_type)}
                              />
                              {file.width && file.height && (
                                <Chip
                                  label={`${file.width}x${file.height}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>{format(new Date(file.created_at), 'PP')}</Typography>
                          </CardContent>
                          {(canWrite || isAdmin) && (
                            <CardActions
                              className="media-actions"
                              sx={{
                                justifyContent: 'flex-end',
                                pt: 0,
                                opacity: 0,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              <Tooltip title={t('common.actions.edit')}>
                                <IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setDetailFile(file)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {file.public_url && (
                                <Tooltip title={t('media.openUrl')}>
                                  <IconButton size="small" aria-label={t('media.openUrl')} color="primary" onClick={() => window.open(file.public_url!, '_blank')}>
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isAdmin && (
                                <Tooltip title={t('common.actions.delete')}>
                                  <IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingFile(file)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </CardActions>
                          )}
                        </Card>
                      </DraggableMediaCard>
                    </Grid>
                  ))}
                </Grid>
              )}
              {mediaData?.meta && (
                <TablePagination
                  component="div"
                  count={mediaData.meta.total_items}
                  page={mediaData.meta.page - 1}
                  onPageChange={(_, p) => setPage(p + 1)}
                  rowsPerPage={mediaData.meta.page_size}
                  onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Box>
          </Box>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeFile ? (
              <Paper
                elevation={12}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  maxWidth: 220,
                  pointerEvents: 'none',
                }}
              >
                {getMimeSmallIcon(activeFile.mime_type)}
                <Typography variant="body2" fontWeight={500} noWrap>{activeFile.original_filename}</Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <MediaUploadDialog
        open={uploadOpen}
        onSubmit={async (file, isGlobal) => {
          await uploadMutation.mutateAsync({ file, isGlobal });
        }}
        onClose={() => setUploadOpen(false)}
        loading={uploadMutation.isPending}
      />
      <MediaDetailDialog open={!!detailFile} media={detailFile} folders={folders} onClose={() => setDetailFile(null)} />
      <ConfirmDialog open={!!deletingFile} title={t('media.deleteDialog.title')} message={t('media.deleteDialog.message', { filename: deletingFile?.original_filename })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingFile && deleteMutation.mutate(deletingFile.id)} onCancel={() => setDeletingFile(null)} loading={deleteMutation.isPending} />
      </>)}
    </Box>
  );
}
