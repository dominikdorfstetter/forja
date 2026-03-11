import { useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  FormHelperText,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { slugField } from '@/utils/validation';
import type { Tag, CreateTagRequest, UpdateTagRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useTranslation } from 'react-i18next';

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
    resolver: zodResolver(tagSchema),
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="tag-form-title" data-testid="tag-form.dialog">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="tag-form-title">{tag ? t('forms.tag.editTitle') : t('forms.tag.createTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('forms.tag.fields.slug')}
            fullWidth
            required
            {...register('slug')}
            error={!!errors.slug}
            helperText={errors.slug?.message || t('forms.tag.fields.slugHelper')}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <Controller name="is_global" control={control} render={({ field }) => (<>
            <FormControlLabel
              control={<Switch checked={field.value} onChange={field.onChange} />}
              label={t('forms.tag.fields.global')}
            />
            <FormHelperText>{t('forms.tag.fields.globalHelper')}</FormHelperText>
          </>)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} data-testid="tag-form.btn.cancel">{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isValid}
            data-testid="tag-form.btn.submit"
          >
            {loading ? t('common.actions.saving') : tag ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
