import { useEffect, useRef } from 'react';
import {
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';
import {
  REDIRECT_STATUS_CODES,
  redirectFormLabel,
  type RedirectStatusCode,
} from '@/utils/redirectStatus';

const redirectSchema = z.object({
  source_path: z.string().min(1, 'Source path is required').max(2000).startsWith('/', 'Must start with /'),
  destination_path: z.string().min(1, 'Destination is required').max(2000),
  status_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
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
  onSubmitCreate?: (data: Omit<CreateRedirectRequest, 'site_id'>) => void;
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
    resolver: formResolver(redirectSchema),
    defaultValues: { source_path: '', destination_path: '', status_code: 301, description: '', is_active: true },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(redirect
        ? {
            source_path: redirect.source_path,
            destination_path: redirect.destination_path,
            status_code: redirect.status_code as RedirectStatusCode,
            description: redirect.description || '',
            is_active: redirect.is_active,
          }
        : { source_path: '', destination_path: '', status_code: 301, description: '', is_active: true });
    }
    prevOpenRef.current = open;
  });

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
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="alt_route"
      title={redirect ? t('forms.redirect.editTitle') : t('forms.redirect.createTitle')}
      submitLabel={redirect ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="redirect-form.btn.submit"
      cancelTestId="redirect-form.btn.cancel"
      loading={loading}
      data-testid="redirect-form.dialog"
    >
      <TextField
        label={t('forms.redirect.fields.sourcePath')}
        fullWidth
        required
        size="small"
        {...register('source_path')}
        error={!!errors.source_path}
        helperText={errors.source_path?.message || t('forms.redirect.fields.sourcePathHelper')}
        placeholder="/old-page"
        autoFocus
      />
      <TextField
        label={t('forms.redirect.fields.destinationPath')}
        fullWidth
        required
        size="small"
        {...register('destination_path')}
        error={!!errors.destination_path}
        helperText={errors.destination_path?.message || t('forms.redirect.fields.destinationPathHelper')}
        placeholder="/new-page"
      />
      <Controller
        name="status_code"
        control={control}
        render={({ field }) => (
          <TextField
            select
            label={t('forms.redirect.fields.statusCode')}
            fullWidth
            size="small"
            value={field.value}
            onChange={(e) => field.onChange(Number(e.target.value))}
            error={!!errors.status_code}
            helperText={errors.status_code?.message}
          >
            {REDIRECT_STATUS_CODES.map((code) => (
              <MenuItem key={code} value={code}>
                {redirectFormLabel(code, t)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <TextField
        label={t('forms.redirect.fields.description')}
        fullWidth
        size="small"
        {...register('description')}
      />
      {redirect && (
        <Controller name="is_active" control={control} render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label={t('forms.redirect.fields.active')}
          />
        )} />
      )}
    </FormDialog>
  );
}
