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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { Category, CreateCategoryRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface BlogCategoryCardProps {
  contentId: string;
  categories: Category[];
}

export default function BlogCategoryCard({ contentId, categories }: BlogCategoryCardProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newIsGlobal, setNewIsGlobal] = useState(false);

  // All categories for the site (for autocomplete)
  const { data: siteCategoriesData } = useQuery({
    queryKey: ['categories', selectedSiteId],
    queryFn: () => apiService.getCategories(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const siteCategories = siteCategoriesData?.data ?? [];

  // Categories not yet assigned
  const assignedIds = new Set(categories.map((c) => c.id));
  const availableCategories = siteCategories.filter((c) => !assignedIds.has(c.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blog-detail'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const assignMutation = useMutation({
    mutationFn: (categoryId: string) =>
      apiService.assignCategoryToContent(contentId, { category_id: categoryId }),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category assigned', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Failed to assign category', { variant: 'error' }),
  });

  const removeMutation = useMutation({
    mutationFn: (categoryId: string) =>
      apiService.removeCategoryFromContent(contentId, categoryId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category removed', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Failed to remove category', { variant: 'error' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => apiService.createCategory(data),
    onSuccess: (created) => {
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
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
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
                onDelete={() => removeMutation.mutate(cat.id)}
              />
            ))}
          </Box>

          {/* Autocomplete to assign existing categories */}
          {selectedSiteId && (
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

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            {t('forms.category.createTitle')}
          </Button>
        </CardContent>
      </Card>

      {/* Create category dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('forms.category.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('forms.category.fields.slug')}
              fullWidth
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              helperText="Lowercase with hyphens (e.g. web-development)"
            />
            <FormControlLabel
              control={<Switch checked={newIsGlobal} onChange={(e) => setNewIsGlobal(e.target.checked)} />}
              label={t('forms.category.fields.global')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreateAndAssign}
            disabled={!newSlug.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? t('common.actions.saving') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
