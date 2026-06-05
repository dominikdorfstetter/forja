import { useRef } from 'react';
import {
  TextField,
  FormControlLabel,
  FormHelperText,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { slugField, formResolver} from '@/utils/validation';
import type { Tag, CreateTagRequest, UpdateTagRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';

const tagSchema = z.object({
  slug: slugField,
  is_global: z.boolean(),
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagFormDialogProps {
  open: boolean;
  tag?: Tag | null;
  onSubmitCreate?: (data: CreateTagRequest) => void;
  onSubmitUpdate?: (data: UpdateTagRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function TagFormDialog({
  open,
  tag,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: TagFormDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<TagFormData>({
    resolver: formResolver(tagSchema),
    defaultValues: { slug: '', is_global: false },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    reset(tag ? { slug: tag.slug, is_global: tag.is_global } : { slug: '', is_global: false });
  }
  prevOpenRef.current = open;

  const onFormSubmit = (data: TagFormData) => {
    if (tag && onSubmitUpdate) {
      onSubmitUpdate({
        slug: data.slug || undefined,
        is_global: data.is_global,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        slug: data.slug,
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
      icon="sell"
      title={tag ? t('forms.tag.editTitle') : t('forms.tag.createTitle')}
      submitLabel={tag ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="tag-form.btn.submit"
      cancelTestId="tag-form.btn.cancel"
      loading={loading}
      maxWidth="xs"
      data-testid="tag-form.dialog"
    >
      <TextField
        label={t('forms.tag.fields.slug')}
        fullWidth
        required
        size="small"
        {...register('slug')}
        error={!!errors.slug}
        helperText={errors.slug?.message || t('forms.tag.fields.slugHelper')}
        autoFocus
      />
      <Controller name="is_global" control={control} render={({ field }) => (
        <div>
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label={t('forms.tag.fields.global')}
          />
          <FormHelperText>{t('forms.tag.fields.globalHelper')}</FormHelperText>
        </div>
      )} />
    </FormDialog>
  );
}
