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
import { useTranslation } from 'react-i18next';
import type { Locale, CreateLocaleRequest, UpdateLocaleRequest, TextDirection } from '@/types/api';

const localeSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code must be at most 10 characters')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Must be format "en" or "en-US"'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  native_name: z
    .string()
    .max(100, 'Native name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  direction: z.enum(['Ltr', 'Rtl'] as const),
  is_active: z.boolean(),
});

type LocaleFormData = z.infer<typeof localeSchema>;

interface LocaleFormDialogProps {
  open: boolean;
  locale?: Locale | null;
  onSubmitCreate?: (data: CreateLocaleRequest) => void;
  onSubmitUpdate?: (data: UpdateLocaleRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function LocaleFormDialog({
  open,
  locale,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: LocaleFormDialogProps) {
  const { t } = useTranslation();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<LocaleFormData>({
    resolver: zodResolver(localeSchema),
    defaultValues: { code: '', name: '', native_name: '', direction: 'Ltr', is_active: true },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(
        locale
          ? {
              code: locale.code,
              name: locale.name,
              native_name: locale.native_name || '',
              direction: locale.direction,
              is_active: locale.is_active,
            }
          : { code: '', name: '', native_name: '', direction: 'Ltr', is_active: true },
      );
    }
  }, [open, locale, reset]);

  const onFormSubmit = (data: LocaleFormData) => {
    if (locale && onSubmitUpdate) {
      onSubmitUpdate({
        name: data.name,
        native_name: data.native_name || undefined,
        direction: data.direction as TextDirection,
        is_active: data.is_active,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        code: data.code,
        name: data.name,
        native_name: data.native_name || undefined,
        direction: data.direction as TextDirection,
        is_active: data.is_active,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="locale-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="locale-form-title">
          {locale ? t('forms.locale.editTitle') : t('forms.locale.createTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            label={t('forms.locale.fields.code')}
            fullWidth
            required
            {...register('code')}
            error={!!errors.code}
            helperText={errors.code?.message || t('forms.locale.validation.codeFormat')}
            sx={{ mt: 1, mb: 2 }}
            autoFocus={!locale}
            disabled={!!locale}
          />
          <TextField
            label={t('forms.locale.fields.name')}
            fullWidth
            required
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={{ mb: 2 }}
            autoFocus={!!locale}
          />
          <TextField
            label={t('forms.locale.fields.nativeName')}
            fullWidth
            {...register('native_name')}
            error={!!errors.native_name}
            helperText={errors.native_name?.message}
            sx={{ mb: 2 }}
          />
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label={t('forms.locale.fields.direction')}
                fullWidth
                {...field}
                sx={{ mb: 2 }}
              >
                <MenuItem value="Ltr">LTR (Left to Right)</MenuItem>
                <MenuItem value="Rtl">RTL (Right to Left)</MenuItem>
              </TextField>
            )}
          />
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={field.onChange} />}
                label={t('forms.locale.fields.active')}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>
            {loading
              ? t('common.actions.saving')
              : locale
                ? t('common.actions.save')
                : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
