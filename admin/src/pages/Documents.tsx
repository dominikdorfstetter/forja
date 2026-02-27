import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import LinkIcon from '@mui/icons-material/Link';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ArticleIcon from '@mui/icons-material/Article';
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
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  DocumentListItem,
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import FolderTree from '@/components/shared/FolderTree';
import DocumentFormDialog from '@/components/documents/DocumentFormDialog';
import DraggableDocumentCard from '@/components/documents/DraggableDocumentCard';

function getDocTypeIcon(documentType: string) {
  switch (documentType) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ fontSize: 48 }} color="error" />;
    case 'doc':
      return <DescriptionIcon sx={{ fontSize: 48 }} color="primary" />;
    case 'xlsx':
      return <TableChartIcon sx={{ fontSize: 48 }} color="success" />;
    case 'zip':
      return <FolderZipIcon sx={{ fontSize: 48 }} color="warning" />;
    case 'link':
      return <LinkIcon sx={{ fontSize: 48 }} color="info" />;
    default:
      return <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />;
  }
}

function getDocTypeColor(documentType: string): 'error' | 'primary' | 'success' | 'warning' | 'info' | 'default' {
  switch (documentType) {
    case 'pdf':
      return 'error';
    case 'doc':
      return 'primary';
    case 'xlsx':
      return 'success';
    case 'zip':
      return 'warning';
    case 'link':
      return 'info';
    default:
      return 'default';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentDisplayName(doc: DocumentListItem, detailMap: Map<string, DocumentResponse>): string {
  const detail = detailMap.get(doc.id);
  if (detail && detail.localizations.length > 0) {
    return detail.localizations[0].name;
  }
  // For uploaded files, prefer file_name
  if (doc.has_file && doc.file_name) {
    return doc.file_name;
  }
  // Fallback: use the URL filename or the URL itself
  if (doc.url) {
    try {
      const url = new URL(doc.url);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      if (filename && filename.length > 0) return filename;
    } catch {
      // Not a valid URL, use as-is
    }
    return doc.url;
  }
  return 'Untitled'; // Note: this is in a standalone function outside the component, not localized
}

export interface DocumentsPageHandle {
  openCreate: () => void;
}

const DocumentsPage = forwardRef<DocumentsPageHandle, { embedded?: boolean }>(function DocumentsPage({ embedded = false }, ref) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentResponse | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<DocumentListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

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
    queryKey: ['documents', selectedSiteId, selectedFolderId, page, perPage],
    queryFn: () =>
      apiService.getDocuments(selectedSiteId, {
        folder_id: selectedFolderId ?? undefined,
        page,
        per_page: perPage,
      }),
    enabled: !!selectedSiteId,
  });
  const documents = documentsData?.data;

  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = (siteLocalesRaw || [])
    .filter((sl) => sl.is_active)
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
    if (!documents || !searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const displayName = getDocumentDisplayName(doc, detailMap).toLowerCase();
      const fileName = (doc.file_name || '').toLowerCase();
      const url = (doc.url || '').toLowerCase();
      const docType = doc.document_type.toLowerCase();
      return displayName.includes(q) || fileName.includes(q) || url.includes(q) || docType.includes(q);
    });
  }, [documents, searchQuery, detailMap]);

  // ------ Folder Mutations ------

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string }) =>
      apiService.createDocumentFolder(selectedSiteId, {
        name,
        parent_id: parentId,
        display_order: (folders?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      enqueueSnackbar(t('media.messages.folderCreated'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiService.updateDocumentFolder(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      enqueueSnackbar(t('media.messages.folderRenamed'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteDocumentFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      if (selectedFolderId) setSelectedFolderId(null);
      enqueueSnackbar(t('media.messages.folderDeleted'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  // ------ Document Mutations ------

  const createDocumentMutation = useMutation({
    mutationFn: async ({
      data,
      localizations,
    }: {
      data: CreateDocumentRequest;
      localizations: CreateDocumentLocalizationRequest[];
    }) => {
      const created = await apiService.createDocument(selectedSiteId, data);
      // Create localizations in parallel
      if (localizations.length > 0) {
        await Promise.all(
          localizations.map((loc) => apiService.createDocumentLocalization(created.id, loc)),
        );
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      setFormOpen(false);
      enqueueSnackbar(t('documents.messages.created'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      localizations,
    }: {
      id: string;
      data: CreateDocumentRequest;
      localizations: CreateDocumentLocalizationRequest[];
    }) => {
      const updated = await apiService.updateDocument(id, {
        url: data.url,
        file_data: data.file_data,
        file_name: data.file_name,
        file_size: data.file_size,
        mime_type: data.mime_type,
        document_type: data.document_type,
        folder_id: data.folder_id,
        display_order: data.display_order,
      });

      // Get existing localizations from the detail we already have
      const existingDetail = detailMap.get(id);
      const existingLocs = existingDetail?.localizations ?? [];

      // For each submitted localization, update or create
      for (const loc of localizations) {
        const existing = existingLocs.find((el) => el.locale_id === loc.locale_id);
        if (existing) {
          await apiService.updateDocumentLocalization(existing.id, {
            name: loc.name,
            description: loc.description,
          });
        } else {
          await apiService.createDocumentLocalization(id, loc);
        }
      }

      // Delete localizations that are no longer present
      const submittedLocaleIds = new Set(localizations.map((l) => l.locale_id));
      for (const existing of existingLocs) {
        if (!submittedLocaleIds.has(existing.locale_id)) {
          await apiService.deleteDocumentLocalization(existing.id);
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      setEditingDocument(null);
      enqueueSnackbar(t('documents.messages.updated'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-details'] });
      setDeletingDocument(null);
      enqueueSnackbar(t('documents.messages.deleted'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | undefined }) =>
      apiService.updateDocument(id, { folder_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      enqueueSnackbar(t('media.messages.moved'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  // ------ Handlers ------

  const handleOpenCreate = () => {
    setEditingDocument(null);
    setFormOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCreate: handleOpenCreate,
  }));

  const handleOpenEdit = async (doc: DocumentListItem) => {
    // Fetch the full detail with localizations
    try {
      const detail = await apiService.getDocument(doc.id);
      setEditingDocument(detail);
      setFormOpen(true);
    } catch (error) {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    }
  };

  const handleFormSubmit = (
    data: CreateDocumentRequest,
    localizations: CreateDocumentLocalizationRequest[],
  ) => {
    if (editingDocument) {
      updateDocumentMutation.mutate({ id: editingDocument.id, data, localizations });
    } else {
      createDocumentMutation.mutate({ data, localizations });
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingDocument(null);
  };

  const handleDownload = async (doc: DocumentListItem) => {
    try {
      const blob = await apiService.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    }
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const folderId = over.data.current?.folderId as string | null;
    const docId = active.id as string;

    // Don't move if dropped on the same folder it's already in
    const doc = filteredDocuments?.find((d) => d.id === docId);
    if (!doc) return;
    if (folderId === (doc.folder_id ?? null)) return;

    moveToFolderMutation.mutate({
      id: docId,
      folder_id: folderId ?? undefined,
    });
  }, [filteredDocuments, moveToFolderMutation]);

  const activeDoc = activeId ? filteredDocuments?.find((d) => d.id === activeId) : null;

  // ------ Render ------

  const isLoading = foldersLoading || documentsLoading;
  const isMutating =
    createDocumentMutation.isPending || updateDocumentMutation.isPending;

  return (
    <Box>
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
            {/* Left sidebar: Folder tree */}
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
                folders={folders ?? []}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => { setSelectedFolderId(id); setPage(1); }}
                onCreateFolder={(name, parentId) => createFolderMutation.mutate({ name, parentId })}
                onRenameFolder={(id, name) => renameFolderMutation.mutate({ id, name })}
                onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
                canWrite={canWrite}
                droppable={canWrite}
              />
            </Paper>

            {/* Main area: Document grid */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Search bar */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name, filename, URL, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ mb: 2 }}
              />

              {!filteredDocuments || filteredDocuments.length === 0 ? (
                <EmptyState
                  icon={<ArticleIcon sx={{ fontSize: 64 }} />}
                  title={searchQuery ? t('documents.empty.title') : t('documents.empty.title')}
                  description={
                    searchQuery
                      ? t('documents.empty.description')
                      : selectedFolderId
                        ? t('documents.empty.description')
                        : t('documents.empty.description')
                  }
                  action={
                    !searchQuery && canWrite
                      ? { label: t('documents.createButton'), onClick: handleOpenCreate }
                      : undefined
                  }
                />
              ) : (
                <Grid container spacing={2}>
                  {filteredDocuments.map((doc) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                      <DraggableDocumentCard document={doc}>
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
                            '&:hover .doc-actions': { opacity: 1 },
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
                            {doc.has_file ? (
                              <UploadFileIcon sx={{ fontSize: 48 }} color="secondary" />
                            ) : (
                              getDocTypeIcon(doc.document_type)
                            )}
                          </Box>
                          <CardContent sx={{ pb: 0, flexGrow: 1 }}>
                            <Typography variant="body2" noWrap title={getDocumentDisplayName(doc, detailMap)}>
                              {getDocumentDisplayName(doc, detailMap)}
                            </Typography>
                            {doc.has_file ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                noWrap
                                sx={{ mt: 0.5 }}
                              >
                                {doc.file_name}
                                {doc.file_size != null && ` (${formatFileSize(doc.file_size)})`}
                              </Typography>
                            ) : doc.url ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                noWrap
                                title={doc.url}
                                sx={{ mt: 0.5 }}
                              >
                                {doc.url}
                              </Typography>
                            ) : null}
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                              <Chip
                                label={doc.document_type.toUpperCase()}
                                size="small"
                                color={getDocTypeColor(doc.document_type)}
                                variant="outlined"
                              />
                              {doc.has_file && (
                                <Chip
                                  label="Uploaded"
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </CardContent>
                          {(canWrite || isAdmin) && (
                            <CardActions
                              className="doc-actions"
                              sx={{
                                justifyContent: 'flex-end',
                                pt: 0,
                                opacity: 0,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              {doc.has_file && (
                                <Tooltip title={t('common.actions.view')}>
                                  <IconButton
                                    size="small"
                                    aria-label={t('common.actions.view')}
                                    color="primary"
                                    onClick={() => handleDownload(doc)}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title={t('common.actions.edit')}>
                                <IconButton
                                  size="small"
                                  aria-label={t('common.actions.edit')}
                                  onClick={() => handleOpenEdit(doc)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('common.actions.delete')}>
                                <IconButton
                                  size="small"
                                  aria-label={t('common.actions.delete')}
                                  color="error"
                                  onClick={() => setDeletingDocument(doc)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </CardActions>
                          )}
                        </Card>
                      </DraggableDocumentCard>
                    </Grid>
                  ))}
                </Grid>
              )}

              {documentsData?.meta && (
                <TablePagination
                  component="div"
                  count={documentsData.meta.total_items}
                  page={documentsData.meta.page - 1}
                  onPageChange={(_, p) => setPage(p + 1)}
                  rowsPerPage={documentsData.meta.page_size}
                  onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}

              {documentDetailQueries.error && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Some document details could not be loaded.
                </Alert>
              )}
            </Box>
          </Box>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDoc ? (
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
                <ArticleIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500} noWrap>{getDocumentDisplayName(activeDoc, detailMap)}</Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Form Dialog */}
      <DocumentFormDialog
        open={formOpen}
        document={editingDocument}
        folders={folders ?? []}
        locales={locales ?? []}
        onSubmit={handleFormSubmit}
        onClose={handleFormClose}
        loading={isMutating}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingDocument}
        title={t('documents.deleteDialog.title')}
        message={t('documents.deleteDialog.message', { title: '' })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingDocument && deleteDocumentMutation.mutate(deletingDocument.id)}
        onCancel={() => setDeletingDocument(null)}
        loading={deleteDocumentMutation.isPending}
      />
    </Box>
  );
});

export default DocumentsPage;
