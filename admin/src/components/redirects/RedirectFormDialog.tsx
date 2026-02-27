import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

const redirectSchema = z.object({
  source_path: z.string().min(1, 'Source path is required').max(2000).startsWith('/', 'Must start with /'),
  destination_path: z.string().min(1, 'Destination is required').max(2000),
  status_code: z.union([z.literal(301), z.literal(302)]),
  description: z.string().optional(),
  is_active: z.boolean(),
}).refine((data) => data.source_path !== data.destination_path, {
  message: 'Source and destination must be different',
  path: ['destination_path'],
});

type RedirectFormData = z.infer<typeof redirectSchema>;

interface RedirectFormDialogProps {
  open: boolean;
  redirect?: Redirect | null;
  onSubmitCreate?: (data: CreateRedirectRequest) => void;
  onSubmitUpdate?: (data: UpdateRedirectRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function RedirectFormDialog({
  open,
  redirect,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: RedirectFormDialogProps) {
  const { t } = useTranslation();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<RedirectFormData>({
    resolver: zodResolver(redirectSchema),
    defaultValues: { source_path: '', destination_path: '', status_code: 301, description: '', is_active: true },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(redirect
        ? {
            source_path: redirect.source_path,
            destination_path: redirect.destination_path,
            status_code: redirect.status_code as 301 | 302,
            description: redirect.description || '',
            is_active: redirect.is_active,
          }
        : { source_path: '', destination_path: '', status_code: 301, description: '', is_active: true });
    }
  }, [open, redirect, reset]);

  const onFormSubmit = (data: RedirectFormData) => {
    if (redirect && onSubmitUpdate) {
      onSubmitUpdate({
        source_path: data.source_path,
        destination_path: data.destination_path,
        status_code: data.status_code,
        description: data.description || undefined,
        is_active: data.is_active,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        source_path: data.source_path,
        destination_path: data.destination_path,
        status_code: data.status_code,
        description: data.description || undefined,
        is_active: data.is_active,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="redirect-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="redirect-form-title">
          {redirect ? t('forms.redirect.editTitle') : t('forms.redirect.createTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            label={t('forms.redirect.fields.sourcePath')}
            fullWidth
            required
            {...register('source_path')}
            error={!!errors.source_path}
            helperText={errors.source_path?.message || t('forms.redirect.fields.sourcePathHelper')}
            placeholder="/old-page"
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <TextField
            label={t('forms.redirect.fields.destinationPath')}
            fullWidth
            required
            {...register('destination_path')}
            error={!!errors.destination_path}
            helperText={errors.destination_path?.message || t('forms.redirect.fields.destinationPathHelper')}
            placeholder="/new-page"
            sx={{ mb: 2 }}
          />
          <Controller
            name="status_code"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label={t('forms.redirect.fields.statusCode')}
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                error={!!errors.status_code}
                helperText={errors.status_code?.message}
                sx={{ mb: 2 }}
              >
                <MenuItem value={301}>{t('forms.redirect.fields.permanent')}</MenuItem>
                <MenuItem value={302}>{t('forms.redirect.fields.temporary')}</MenuItem>
              </TextField>
            )}
          />
          <TextField
            label={t('forms.redirect.fields.description')}
            fullWidth
            {...register('description')}
            sx={{ mb: 2 }}
          />
          {redirect && (
            <Controller name="is_active" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={field.onChange} />}
                label={t('forms.redirect.fields.active')}
              />
            )} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isValid}
          >
            {loading ? t('common.actions.saving') : redirect ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
