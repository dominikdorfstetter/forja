import { useEffect } from 'react';
import { TextField, Stack, Box, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { requiredString, optionalString, positiveInt, formResolver } from '@/utils/validation';
import type { ApiKeyListItem, UpdateApiKeyRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';

const editApiKeySchema = z.object({
  name: requiredString(100),
  description: optionalString(500),
  quota_hourly: positiveInt,
  quota_daily: positiveInt,
  quota_monthly: positiveInt,
});

type EditApiKeyFormData = z.infer<typeof editApiKeySchema>;

interface EditApiKeyDialogProps {
  open: boolean;
  apiKey: ApiKeyListItem | null;
  onSubmit: (id: string, data: UpdateApiKeyRequest) => Promise<void>;
  onClose: () => void;
}

export default function EditApiKeyDialog({ open, apiKey, onSubmit, onClose }: EditApiKeyDialogProps) {
  const { t } = useTranslation();

  const { register, handleSubmit, reset, trigger, formState: { errors, isValid, isSubmitting } } =
    useForm<EditApiKeyFormData>({
      resolver: formResolver(editApiKeySchema),
      mode: 'onChange',
    });

  // Prefill from the selected key whenever it changes (list item carries quotas).
  // Validate after reset so a valid prefill enables Save without requiring an edit.
  useEffect(() => {
    if (apiKey) {
      reset({
        name: apiKey.name,
        description: '',
        quota_hourly: apiKey.quota_hourly,
        quota_daily: apiKey.quota_daily,
        quota_monthly: apiKey.quota_monthly,
      });
      void trigger();
    }
  }, [apiKey, reset, trigger]);

  const onFormSubmit = async (data: EditApiKeyFormData) => {
    if (!apiKey) return;
    await onSubmit(apiKey.id, {
      name: data.name,
      description: data.description || undefined,
      quota_hourly: data.quota_hourly,
      quota_daily: data.quota_daily,
      quota_monthly: data.quota_monthly,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="vpn_key"
      title={t('apiKeys.editDialog.title')}
      submitLabel={t('common.actions.save')}
      submitDisabled={!isValid}
      submitTestId="edit-api-key.btn.submit"
      cancelTestId="edit-api-key.btn.cancel"
      loading={isSubmitting}
      data-testid="edit-api-key.dialog"
    >
      <TextField
        label={t('apiKeys.createDialog.fields.name')}
        fullWidth
        required
        size="small"
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        autoFocus
      />
      <TextField
        label={t('apiKeys.editDialog.fields.description')}
        fullWidth
        multiline
        size="small"
        rows={2}
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
      />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('apiKeys.createDialog.quotas.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('apiKeys.createDialog.quotas.hint')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            label={t('apiKeys.createDialog.quotas.hourly')}
            type="number"
            size="small"
            data-testid="field-quota-hourly"
            {...register('quota_hourly')}
            error={!!errors.quota_hourly}
            helperText={errors.quota_hourly?.message}
          />
          <TextField
            label={t('apiKeys.createDialog.quotas.daily')}
            type="number"
            size="small"
            data-testid="field-quota-daily"
            {...register('quota_daily')}
            error={!!errors.quota_daily}
            helperText={errors.quota_daily?.message}
          />
          <TextField
            label={t('apiKeys.createDialog.quotas.monthly')}
            type="number"
            size="small"
            data-testid="field-quota-monthly"
            {...register('quota_monthly')}
            error={!!errors.quota_monthly}
            helperText={errors.quota_monthly?.message}
          />
        </Stack>
      </Box>
    </FormDialog>
  );
}
