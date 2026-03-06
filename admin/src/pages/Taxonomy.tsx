import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CategoryIcon from '@mui/icons-material/Category';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
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
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';

export default function TaxonomyPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  // Info banner state
  const [showInfo, setShowInfo] = useState(true);

  // Tag list state
  const {
    page: tagPage, perPage: tagPerPage,
    formOpen: tagFormOpen, editing: editingTag, deleting: deletingTag,
    openCreate: openTagCreate, closeForm: closeTagForm,
    openEdit: setEditingTag, closeEdit: closeTagEdit,
    openDelete: setDeletingTag, closeDelete: closeTagDelete,
    handlePageChange: handleTagPageChange, handleRowsPerPageChange: handleTagRowsPerPageChange,
  } = useListPageState<Tag>();

  // Category list state
  const {
    page: catPage, perPage: catPerPage,
    formOpen: catFormOpen, editing: editingCat, deleting: deletingCat,
    openCreate: openCatCreate, closeForm: closeCatForm,
    openEdit: setEditingCat, closeEdit: closeCatEdit,
    openDelete: setDeletingCat, closeDelete: closeCatDelete,
    handlePageChange: handleCatPageChange, handleRowsPerPageChange: handleCatRowsPerPageChange,
  } = useListPageState<Category>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'create-tag') openTagCreate();
      else if (detail === 'create-category') openCatCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openTagCreate, openCatCreate]);

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
  const { createMutation: createTagMutation, updateMutation: updateTagMutation, deleteMutation: deleteTagMutation } = useCrudMutations<CreateTagRequest, UpdateTagRequest>({
    queryKey: 'tags',
    create: {
      mutationFn: (data) => apiService.createTag(data),
      successMessage: t('taxonomy.tags.messages.created'),
      onSuccess: () => { closeTagForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateTag(id, data),
      successMessage: t('taxonomy.tags.messages.updated'),
      onSuccess: () => { closeTagEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deleteTag(id),
      successMessage: t('taxonomy.tags.messages.deleted'),
      onSuccess: () => { closeTagDelete(); },
    },
  });

  // Category mutations
  const { createMutation: createCatMutation, updateMutation: updateCatMutation, deleteMutation: deleteCatMutation } = useCrudMutations<CreateCategoryRequest, UpdateCategoryRequest>({
    queryKey: 'categories',
    create: {
      mutationFn: (data) => apiService.createCategory(data),
      successMessage: t('taxonomy.categories.messages.created'),
      onSuccess: () => { closeCatForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateCategory(id, data),
      successMessage: t('taxonomy.categories.messages.updated'),
      onSuccess: () => { closeCatEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deleteCategory(id),
      successMessage: t('taxonomy.categories.messages.deleted'),
      onSuccess: () => { closeCatDelete(); },
    },
  });

  const tagColumns: DataTableColumn<Tag>[] = [
    {
      header: t('taxonomy.tags.table.slug'),
      scope: 'col',
      render: (tag) => <Typography variant="body2" fontFamily="monospace">{tag.slug}</Typography>,
    },
    {
      header: t('taxonomy.tags.table.scope'),
      scope: 'col',
      render: (tag) => tag.is_global
        ? <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        : <Chip label={t('common.labels.site')} size="small" variant="outlined" />,
    },
    {
      header: t('taxonomy.tags.table.created'),
      scope: 'col',
      render: (tag) => format(new Date(tag.created_at), 'PP'),
    },
    {
      header: t('taxonomy.tags.table.actions'),
      scope: 'col',
      align: 'right',
      render: (tag) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingTag(tag)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingTag(tag)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  const catColumns: DataTableColumn<Category>[] = [
    {
      header: t('taxonomy.categories.table.slug'),
      scope: 'col',
      render: (cat) => <Typography variant="body2" fontFamily="monospace">{cat.slug}</Typography>,
    },
    {
      header: t('taxonomy.categories.table.parent'),
      scope: 'col',
      render: (cat) => cat.parent_id
        ? <Chip label={t('common.labels.child')} size="small" variant="outlined" />
        : '\u2014',
    },
    {
      header: t('taxonomy.categories.table.scope'),
      scope: 'col',
      render: (cat) => cat.is_global
        ? <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        : <Chip label={t('common.labels.site')} size="small" variant="outlined" />,
    },
    {
      header: t('taxonomy.categories.table.created'),
      scope: 'col',
      render: (cat) => format(new Date(cat.created_at), 'PP'),
    },
    {
      header: t('taxonomy.categories.table.actions'),
      scope: 'col',
      align: 'right',
      render: (cat) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingCat(cat)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingCat(cat)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box data-testid="taxonomy.page">
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
                  onClick={openTagCreate}
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
                  action={{ label: t('taxonomy.tags.addTag'), onClick: openTagCreate }}
                />
              ) : (
                <DataTable<Tag>
                  data={tags}
                  columns={tagColumns}
                  getRowKey={(tag) => tag.id}
                  meta={tagsData?.meta}
                  page={tagPage}
                  onPageChange={handleTagPageChange}
                  rowsPerPage={tagPerPage}
                  onRowsPerPageChange={handleTagRowsPerPageChange}
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
                  onClick={openCatCreate}
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
                  action={{ label: t('taxonomy.categories.addCategory'), onClick: openCatCreate }}
                />
              ) : (
                <DataTable<Category>
                  data={categories}
                  columns={catColumns}
                  getRowKey={(cat) => cat.id}
                  meta={categoriesData?.meta}
                  page={catPage}
                  onPageChange={handleCatPageChange}
                  rowsPerPage={catPerPage}
                  onRowsPerPageChange={handleCatRowsPerPageChange}
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
        onClose={closeTagForm}
        loading={createTagMutation.isPending}
      />
      <TagFormDialog
        open={!!editingTag}
        tag={editingTag}
        onSubmitUpdate={(data) => editingTag && updateTagMutation.mutate({ id: editingTag.id, data })}
        onClose={closeTagEdit}
        loading={updateTagMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingTag}
        title={t('taxonomy.tags.deleteDialog.title')}
        message={t('taxonomy.tags.deleteDialog.message', { slug: deletingTag?.slug })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingTag && deleteTagMutation.mutate(deletingTag.id)}
        onCancel={closeTagDelete}
        loading={deleteTagMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />

      {/* Category Dialogs */}
      <CategoryFormDialog
        open={catFormOpen}
        categories={categories || []}
        onSubmitCreate={(data) => createCatMutation.mutate(data)}
        onClose={closeCatForm}
        loading={createCatMutation.isPending}
      />
      <CategoryFormDialog
        open={!!editingCat}
        category={editingCat}
        categories={categories || []}
        onSubmitUpdate={(data) => editingCat && updateCatMutation.mutate({ id: editingCat.id, data })}
        onClose={closeCatEdit}
        loading={updateCatMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingCat}
        title={t('taxonomy.categories.deleteDialog.title')}
        message={t('taxonomy.categories.deleteDialog.message', { slug: deletingCat?.slug })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingCat && deleteCatMutation.mutate(deletingCat.id)}
        onCancel={closeCatDelete}
        loading={deleteCatMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
