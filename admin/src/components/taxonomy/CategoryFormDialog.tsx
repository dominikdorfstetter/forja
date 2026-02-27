import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  FormHelperText,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { slugField } from '@/utils/validation';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useTranslation } from 'react-i18next';

const categorySchema = z.object({
  slug: slugField,
  parent_id: z.string().optional().or(z.literal('')),
  is_global: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  category?: Category | null;
  categories: Category[];
  onSubmitCreate?: (data: CreateCategoryRequest) => void;
  onSubmitUpdate?: (data: UpdateCategoryRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function CategoryFormDialog({
  open,
  category,
  categories,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: CategoryFormDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { slug: '', parent_id: '', is_global: false },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(category
        ? { slug: category.slug, parent_id: category.parent_id || '', is_global: category.is_global }
        : { slug: '', parent_id: '', is_global: false });
    }
  }, [open, category, reset]);

  // Filter out current category from parent options to prevent circular references
  const parentOptions = categories.filter((c) => !category || c.id !== category.id);

  const onFormSubmit = (data: CategoryFormData) => {
    if (category && onSubmitUpdate) {
      onSubmitUpdate({
        slug: data.slug || undefined,
        parent_id: data.parent_id || undefined,
        is_global: data.is_global,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        slug: data.slug,
        parent_id: data.parent_id || undefined,
        is_global: data.is_global,
        site_id: data.is_global ? undefined : selectedSiteId || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="category-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="category-form-title">{category ? t('forms.category.editTitle') : t('forms.category.createTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('forms.category.fields.slug')}
            fullWidth
            required
            {...register('slug')}
            error={!!errors.slug}
            helperText={errors.slug?.message || t('forms.category.fields.slugHelper')}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <Controller name="parent_id" control={control} render={({ field }) => (
            <TextField
              select
              label={t('forms.category.fields.parent')}
              fullWidth
              {...field}
              helperText={t('forms.category.fields.parentHelper')}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">
                <em>{t('forms.category.fields.noParent')}</em>
              </MenuItem>
              {parentOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.slug}
                </MenuItem>
              ))}
            </TextField>
          )} />
          <Controller name="is_global" control={control} render={({ field }) => (<>
            <FormControlLabel
              control={<Switch checked={field.value} onChange={field.onChange} />}
              label={t('forms.category.fields.global')}
            />
            <FormHelperText>{t('forms.category.fields.globalHelper')}</FormHelperText>
          </>)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isValid}
          >
            {loading ? t('common.actions.saving') : category ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
