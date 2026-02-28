import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Button,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CategoryIcon from '@mui/icons-material/Category';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  Tag,
  Category,
  CreateTagRequest,
  UpdateTagRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TagFormDialog from '@/components/taxonomy/TagFormDialog';
import CategoryFormDialog from '@/components/taxonomy/CategoryFormDialog';

export default function TaxonomyPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  // Info banner state
  const [showInfo, setShowInfo] = useState(true);

  // Pagination state
  const [tagPage, setTagPage] = useState(1);
  const [tagPerPage, setTagPerPage] = useState(25);
  const [catPage, setCatPage] = useState(1);
  const [catPerPage, setCatPerPage] = useState(25);

  // Tag state
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  // Category state
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['tags', selectedSiteId, tagPage, tagPerPage],
    queryFn: () => apiService.getTags(selectedSiteId, { page: tagPage, per_page: tagPerPage }),
    enabled: !!selectedSiteId,
  });
  const tags = tagsData?.data;

  const { data: categoriesData, isLoading: catsLoading } = useQuery({
    queryKey: ['categories', selectedSiteId, catPage, catPerPage],
    queryFn: () => apiService.getCategories(selectedSiteId, { page: catPage, per_page: catPerPage }),
    enabled: !!selectedSiteId,
  });
  const categories = categoriesData?.data;

  // Tag mutations
  const createTagMutation = useMutation({
    mutationFn: (data: CreateTagRequest) => apiService.createTag(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setTagFormOpen(false); enqueueSnackbar(t('taxonomy.tags.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) => apiService.updateTag(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setEditingTag(null); enqueueSnackbar(t('taxonomy.tags.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteTag(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setDeletingTag(null); enqueueSnackbar(t('taxonomy.tags.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  // Category mutations
  const createCatMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => apiService.createCategory(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setCatFormOpen(false); enqueueSnackbar(t('taxonomy.categories.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) => apiService.updateCategory(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditingCat(null); enqueueSnackbar(t('taxonomy.categories.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeletingCat(null); enqueueSnackbar(t('taxonomy.categories.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box>
      <PageHeader title={t('taxonomy.title')} subtitle={t('taxonomy.subtitle')} />

      {!selectedSiteId ? (
        <EmptyState
          icon={<LocalOfferIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('taxonomy.empty.noSite')}
        />
      ) : (<>
        {showInfo && (
          <Alert severity="info" onClose={() => setShowInfo(false)} sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom><strong>{t('taxonomy.tags.title')}:</strong> {t('taxonomy.info.tags')}</Typography>
            <Typography variant="body2"><strong>{t('taxonomy.categories.title')}:</strong> {t('taxonomy.info.categories')}</Typography>
          </Alert>
        )}
        <Grid container spacing={3}>
          {/* Tags */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" component="h2">
                  {t('taxonomy.tags.title')} {tagsData?.meta && `(${tagsData.meta.total_items})`}
                </Typography>
                {canWrite && <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setTagFormOpen(true)}
                >
                  {t('taxonomy.tags.addTag')}
                </Button>}
              </Box>
              <Divider sx={{ mb: 2 }} />

              {tagsLoading ? (
                <LoadingState label={t('taxonomy.tags.loading')} />
              ) : !tags || tags.length === 0 ? (
                <EmptyState
                  icon={<LocalOfferIcon sx={{ fontSize: 48 }} />}
                  title={t('taxonomy.tags.empty.title')}
                  description={t('taxonomy.tags.empty.description')}
                  action={{ label: t('taxonomy.tags.addTag'), onClick: () => setTagFormOpen(true) }}
                />
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell scope="col">{t('taxonomy.tags.table.slug')}</TableCell>
                        <TableCell scope="col">{t('taxonomy.tags.table.scope')}</TableCell>
                        <TableCell scope="col">{t('taxonomy.tags.table.created')}</TableCell>
                        <TableCell scope="col" align="right">{t('taxonomy.tags.table.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tags.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">{tag.slug}</Typography>
                          </TableCell>
                          <TableCell>
                            {tag.is_global ? (
                              <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
                            ) : (
                              <Chip label={t('common.labels.site')} size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(tag.created_at), 'PP')}</TableCell>
                          <TableCell align="right">
                            {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingTag(tag)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                            {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingTag(tag)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {tagsData?.meta && (
                <TablePagination
                  component="div"
                  count={tagsData.meta.total_items}
                  page={tagsData.meta.page - 1}
                  onPageChange={(_, p) => setTagPage(p + 1)}
                  rowsPerPage={tagsData.meta.page_size}
                  onRowsPerPageChange={(e) => { setTagPerPage(+e.target.value); setTagPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Paper>
          </Grid>

          {/* Categories */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" component="h2">
                  {t('taxonomy.categories.title')} {categoriesData?.meta && `(${categoriesData.meta.total_items})`}
                </Typography>
                {canWrite && <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCatFormOpen(true)}
                >
                  {t('taxonomy.categories.addCategory')}
                </Button>}
              </Box>
              <Divider sx={{ mb: 2 }} />

              {catsLoading ? (
                <LoadingState label={t('taxonomy.categories.loading')} />
              ) : !categories || categories.length === 0 ? (
                <EmptyState
                  icon={<CategoryIcon sx={{ fontSize: 48 }} />}
                  title={t('taxonomy.categories.empty.title')}
                  description={t('taxonomy.categories.empty.description')}
                  action={{ label: t('taxonomy.categories.addCategory'), onClick: () => setCatFormOpen(true) }}
                />
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell scope="col">{t('taxonomy.categories.table.slug')}</TableCell>
                        <TableCell scope="col">{t('taxonomy.categories.table.parent')}</TableCell>
                        <TableCell scope="col">{t('taxonomy.categories.table.scope')}</TableCell>
                        <TableCell scope="col">{t('taxonomy.categories.table.created')}</TableCell>
                        <TableCell scope="col" align="right">{t('taxonomy.categories.table.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">{cat.slug}</Typography>
                          </TableCell>
                          <TableCell>
                            {cat.parent_id ? (
                              <Chip label={t('common.labels.child')} size="small" variant="outlined" />
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {cat.is_global ? (
                              <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
                            ) : (
                              <Chip label={t('common.labels.site')} size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(cat.created_at), 'PP')}</TableCell>
                          <TableCell align="right">
                            {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingCat(cat)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                            {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingCat(cat)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {categoriesData?.meta && (
                <TablePagination
                  component="div"
                  count={categoriesData.meta.total_items}
                  page={categoriesData.meta.page - 1}
                  onPageChange={(_, p) => setCatPage(p + 1)}
                  rowsPerPage={categoriesData.meta.page_size}
                  onRowsPerPageChange={(e) => { setCatPerPage(+e.target.value); setCatPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      </>)}

      {/* Tag Dialogs */}
      <TagFormDialog
        open={tagFormOpen}
        onSubmitCreate={(data) => createTagMutation.mutate(data)}
        onClose={() => setTagFormOpen(false)}
        loading={createTagMutation.isPending}
      />
      <TagFormDialog
        open={!!editingTag}
        tag={editingTag}
        onSubmitUpdate={(data) => editingTag && updateTagMutation.mutate({ id: editingTag.id, data })}
        onClose={() => setEditingTag(null)}
        loading={updateTagMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingTag}
        title={t('taxonomy.tags.deleteDialog.title')}
        message={t('taxonomy.tags.deleteDialog.message', { slug: deletingTag?.slug })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingTag && deleteTagMutation.mutate(deletingTag.id)}
        onCancel={() => setDeletingTag(null)}
        loading={deleteTagMutation.isPending}
      />

      {/* Category Dialogs */}
      <CategoryFormDialog
        open={catFormOpen}
        categories={categories || []}
        onSubmitCreate={(data) => createCatMutation.mutate(data)}
        onClose={() => setCatFormOpen(false)}
        loading={createCatMutation.isPending}
      />
      <CategoryFormDialog
        open={!!editingCat}
        category={editingCat}
        categories={categories || []}
        onSubmitUpdate={(data) => editingCat && updateCatMutation.mutate({ id: editingCat.id, data })}
        onClose={() => setEditingCat(null)}
        loading={updateCatMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingCat}
        title={t('taxonomy.categories.deleteDialog.title')}
        message={t('taxonomy.categories.deleteDialog.message', { slug: deletingCat?.slug })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingCat && deleteCatMutation.mutate(deletingCat.id)}
        onCancel={() => setDeletingCat(null)}
        loading={deleteCatMutation.isPending}
      />
    </Box>
  );
}
