import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Box,
  Autocomplete,
  TextField,
  Button,
  FormControlLabel,
  Switch,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { assignCategoryToContent, createCategory, getCategories, removeCategoryFromContent } from '@/services/taxonomy';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import type { Category, CreateCategoryRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';

interface BlogCategoryCardProps {
  contentId: string;
  categories: Category[];
}

export default function BlogCategoryCard({ contentId, categories }: BlogCategoryCardProps) {
  const { t } = useTranslation();
  const { canWrite } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newIsGlobal, setNewIsGlobal] = useState(false);

  // All categories for the site (for autocomplete)
  const { data: siteCategoriesData } = useQuery({
    queryKey: queryKeys.categories(selectedSiteId),
    queryFn: () => getCategories(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const siteCategories = siteCategoriesData?.data ?? [];

  // Categories not yet assigned
  const assignedIds = new Set(categories.map((c) => c.id));
  const availableCategories = siteCategories.filter((c) => !assignedIds.has(c.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogDetail(contentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories(selectedSiteId) });
  };

  const assignMutation = useMutation({
    mutationFn: (categoryId: string) =>
      assignCategoryToContent(contentId, { category_id: categoryId }),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category assigned', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Failed to assign category', { variant: 'error' }),
  });

  const removeMutation = useMutation({
    mutationFn: (categoryId: string) =>
      removeCategoryFromContent(contentId, categoryId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category removed', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Failed to remove category', { variant: 'error' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => createCategory(data),
    onSuccess: (created) => {
      // The category now exists at the site level even before assignment,
      // so invalidate the categories query directly instead of relying on
      // the downstream assignMutation (which may be delayed or fail).
      queryClient.invalidateQueries({ queryKey: queryKeys.categories(selectedSiteId) });
      assignMutation.mutate(created.id);
      setCreateOpen(false);
      setNewSlug('');
      setNewIsGlobal(false);
    },
    onError: () => enqueueSnackbar('Failed to create category', { variant: 'error' }),
  });

  const handleCreateAndAssign = () => {
    if (!newSlug.trim()) return;
    createMutation.mutate({
      slug: newSlug.trim(),
      is_global: newIsGlobal,
      site_id: newIsGlobal ? undefined : selectedSiteId,
    });
  };

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            {t('blogDetail.fields.categories')}
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {/* Assigned categories */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {categories.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No categories assigned
              </Typography>
            )}
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.slug}
                size="small"
                onDelete={canWrite ? () => removeMutation.mutate(cat.id) : undefined}
              />
            ))}
          </Box>

          {/* Autocomplete to assign existing categories */}
          {selectedSiteId && canWrite && (
            <Autocomplete
              options={availableCategories}
              getOptionLabel={(opt) => opt.slug}
              size="small"
              onChange={(_, value) => {
                if (value) {
                  assignMutation.mutate(value.id);
                }
              }}
              value={null}
              renderInput={(params) => (
                <TextField {...params} label={t('common.actions.add')} placeholder={t('common.actions.search')} />
              )}
              sx={{ mb: 1 }}
            />
          )}

          {canWrite && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              {t('forms.category.createTitle')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Create category dialog */}
      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateAndAssign}
        icon="category"
        title={t('forms.category.createTitle')}
        submitLabel={t('common.actions.create')}
        submitDisabled={!newSlug.trim()}
        submitTestId="blog-category-create.btn.submit"
        cancelTestId="blog-category-create.btn.cancel"
        loading={createMutation.isPending}
        maxWidth="xs"
        data-testid="blog-category-create.dialog"
      >
        <TextField
          label={t('forms.category.fields.slug')}
          fullWidth
          size="small"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          helperText="Lowercase with hyphens (e.g. web-development)"
        />
        <FormControlLabel
          control={<Switch checked={newIsGlobal} onChange={(e) => setNewIsGlobal(e.target.checked)} />}
          label={t('forms.category.fields.global')}
        />
      </FormDialog>
    </>
  );
}
