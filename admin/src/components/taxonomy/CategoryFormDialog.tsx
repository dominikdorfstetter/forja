import { useEffect, useRef } from 'react';
import {
  TextField,
  MenuItem,
  FormControlLabel,
  FormHelperText,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { slugField, formResolver} from '@/utils/validation';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';

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
    resolver: formResolver(categorySchema),
    defaultValues: { slug: '', parent_id: '', is_global: false },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(category
        ? { slug: category.slug, parent_id: category.parent_id || '', is_global: category.is_global }
        : { slug: '', parent_id: '', is_global: false });
    }
    prevOpenRef.current = open;
  });

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
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="category"
      title={category ? t('forms.category.editTitle') : t('forms.category.createTitle')}
      submitLabel={category ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="category-form.btn.submit"
      cancelTestId="category-form.btn.cancel"
      loading={loading}
      maxWidth="xs"
      data-testid="category-form.dialog"
    >
      <TextField
        label={t('forms.category.fields.slug')}
        fullWidth
        required
        size="small"
        {...register('slug')}
        error={!!errors.slug}
        helperText={errors.slug?.message || t('forms.category.fields.slugHelper')}
        autoFocus
      />
      <Controller name="parent_id" control={control} render={({ field }) => (
        <TextField
          select
          label={t('forms.category.fields.parent')}
          fullWidth
          size="small"
          {...field}
          helperText={t('forms.category.fields.parentHelper')}
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
      <Controller name="is_global" control={control} render={({ field }) => (
        <div>
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label={t('forms.category.fields.global')}
          />
          <FormHelperText>{t('forms.category.fields.globalHelper')}</FormHelperText>
        </div>
      )} />
    </FormDialog>
  );
}
