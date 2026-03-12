import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Typography,
  Grid,
} from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useQuery } from '@tanstack/react-query';
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
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TagFormDialog from '@/components/taxonomy/TagFormDialog';
import CategoryFormDialog from '@/components/taxonomy/CategoryFormDialog';
import TagsSection from '@/components/taxonomy/TagsSection';
import CategoriesSection from '@/components/taxonomy/CategoriesSection';
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
    page: tagPage, pageSize: tagPageSize,
    formOpen: tagFormOpen, editing: editingTag, deleting: deletingTag,
    openCreate: openTagCreate, closeForm: closeTagForm,
    openEdit: setEditingTag, closeEdit: closeTagEdit,
    openDelete: setDeletingTag, closeDelete: closeTagDelete,
    handlePageChange: handleTagPageChange, handleRowsPerPageChange: handleTagRowsPerPageChange,
  } = useListPageState<Tag>();

  // Category list state
  const {
    page: catPage, pageSize: catPageSize,
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
    queryKey: ['tags', selectedSiteId, tagPage, tagPageSize],
    queryFn: () => apiService.getTags(selectedSiteId, { page: tagPage, page_size: tagPageSize }),
    enabled: !!selectedSiteId,
  });
  const tags = tagsData?.data;

  const { data: categoriesData, isLoading: catsLoading } = useQuery({
    queryKey: ['categories', selectedSiteId, catPage, catPageSize],
    queryFn: () => apiService.getCategories(selectedSiteId, { page: catPage, page_size: catPageSize }),
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
          <Grid size={{ xs: 12, md: 6 }}>
            <TagsSection
              tags={tags}
              meta={tagsData?.meta}
              loading={tagsLoading}
              page={tagPage}
              rowsPerPage={tagPageSize}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onPageChange={handleTagPageChange}
              onRowsPerPageChange={handleTagRowsPerPageChange}
              onOpenCreate={openTagCreate}
              onEdit={setEditingTag}
              onDelete={setDeletingTag}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <CategoriesSection
              categories={categories}
              meta={categoriesData?.meta}
              loading={catsLoading}
              page={catPage}
              rowsPerPage={catPageSize}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onPageChange={handleCatPageChange}
              onRowsPerPageChange={handleCatRowsPerPageChange}
              onOpenCreate={openCatCreate}
              onEdit={setEditingCat}
              onDelete={setDeletingCat}
            />
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
