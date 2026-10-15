import { TextField, Stack, Box, Typography } from '@mui/material';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

type QuotaField = 'quota_hourly' | 'quota_daily' | 'quota_monthly';

const QUOTA_FIELDS: readonly { name: QuotaField; labelKey: string; testId: string }[] = [
  { name: 'quota_hourly', labelKey: 'apiKeys.createDialog.quotas.hourly', testId: 'field-quota-hourly' },
  { name: 'quota_daily', labelKey: 'apiKeys.createDialog.quotas.daily', testId: 'field-quota-daily' },
  { name: 'quota_monthly', labelKey: 'apiKeys.createDialog.quotas.monthly', testId: 'field-quota-monthly' },
];

interface ApiKeyQuotaFieldsProps {
  register: (name: QuotaField) => UseFormRegisterReturn;
  errors: Partial<Record<QuotaField, FieldError>>;
}

/** Hourly / daily / monthly request quota inputs shared by the create and edit key dialogs. */
export default function ApiKeyQuotaFields({ register, errors }: ApiKeyQuotaFieldsProps) {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('apiKeys.createDialog.quotas.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('apiKeys.createDialog.quotas.hint')}
      </Typography>
      <Stack direction="row" spacing={1}>
        {QUOTA_FIELDS.map(({ name, labelKey, testId }) => (
          <TextField
            key={name}
            label={t(labelKey)}
            type="number"
            size="small"
            data-testid={testId}
            {...register(name)}
            error={!!errors[name]}
            helperText={errors[name]?.message}
          />
        ))}
      </Stack>
    </Box>
  );
}
