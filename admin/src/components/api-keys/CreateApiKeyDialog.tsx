import { useState, useMemo } from 'react';
import {
  TextField,
  Stack,
  MenuItem,
  Alert,
  Typography,
  Box,
  IconButton,
  InputAdornment,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { requiredString, optionalString, positiveInt, formResolver} from '@/utils/validation';
import type { CreateApiKeyRequest, CreateApiKeyResponse, ApiKeyPermission } from '@/types/api';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

const ALL_PERMISSIONS: { value: ApiKeyPermission; label: string; rank: number }[] = [
  { value: 'Read', label: 'Read', rank: 1 },
  { value: 'Write', label: 'Write', rank: 2 },
  { value: 'Admin', label: 'Admin', rank: 3 },
];

const PERMISSION_RANK: Record<ApiKeyPermission, number> = {
  Read: 1,
  Write: 2,
  Admin: 3,
  Master: 4,
};

const createApiKeySchema = z.object({
  name: requiredString(100),
  description: optionalString(500),
  permission: z.enum(['Read', 'Write', 'Admin']),
  expires_at: z.string().optional(),
  quota_hourly: positiveInt,
  quota_daily: positiveInt,
  quota_monthly: positiveInt,
});

type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;

interface CreateApiKeyDialogProps {
  open: boolean;
  /** Site the key is created for — taken from the current site context, not chosen in the form. */
  siteId: string;
  maxPermission?: ApiKeyPermission;
  onSubmit: (data: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;
  onClose: () => void;
}

export default function CreateApiKeyDialog({ open, siteId, maxPermission = 'Admin', onSubmit, onClose }: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<CreateApiKeyFormData>({
    resolver: formResolver(createApiKeySchema),
    defaultValues: {
      name: '',
      description: '',
      permission: 'Read',
      quota_hourly: 1000,
      quota_daily: 10000,
      quota_monthly: 100000,
    },
    mode: 'onChange',
  });

  const allowedPermissions = useMemo(
    () => ALL_PERMISSIONS.filter((p) => p.rank <= PERMISSION_RANK[maxPermission]),
    [maxPermission],
  );

  const handleClose = () => {
    if (createdKey) {
      setCreatedKey(null);
      reset();
    }
    onClose();
  };

  const onFormSubmit = async (data: CreateApiKeyFormData) => {
    setSubmitting(true);
    try {
      const result = await onSubmit({
        ...data,
        site_id: siteId,
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : undefined,
      });
      setCreatedKey(result);
    } catch {
      enqueueSnackbar('Failed to create API key', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key);
      enqueueSnackbar('API key copied to clipboard', { variant: 'success' });
    }
  };

  // Phase 2: show the created key
  if (createdKey) {
    return (
      <FormDialog
        open={open}
        onClose={handleClose}
        icon="vpn_key"
        title={t('apiKeys.createDialog.created.title')}
        data-testid="create-api-key.dialog"
        actions={
          <>
            <M3Button variant="ghost" size="sm" onClick={handleCopy}>
              {t('common.actions.copy', 'Copy')}
            </M3Button>
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleClose}
              data-testid="create-api-key.btn.close"
            >
              {t('common.actions.close')}
            </M3Button>
          </>
        }
      >
        <Alert severity="warning">{t('apiKeys.createDialog.created.warning')}</Alert>
        <Typography variant="subtitle2">{t('apiKeys.createDialog.fields.name')}</Typography>
        <Typography variant="body1">{createdKey.name}</Typography>
        <Typography variant="subtitle2">API Key</Typography>
        <TextField
          fullWidth
          size="small"
          value={createdKey.key}
          data-testid="generated-api-key"
          slotProps={{
            input: {
              readOnly: true,
              sx: { fontFamily: 'var(--font-mono)' },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopy} edge="end" aria-label="Copy API key">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }
          }}
        />
      </FormDialog>
    );
  }

  // Phase 1: creation form
  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="vpn_key"
      title={t('apiKeys.createDialog.title')}
      submitLabel={t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="create-api-key.btn.submit"
      cancelTestId="create-api-key.btn.cancel"
      loading={submitting}
      data-testid="create-api-key.dialog"
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
        label="Description"
        fullWidth
        multiline
        size="small"
        rows={2}
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
      />
      <TextField
        label={t('apiKeys.createDialog.fields.permission')}
        select
        fullWidth
        required
        size="small"
        defaultValue="Read"
        {...register('permission')}
        error={!!errors.permission}
        helperText={errors.permission?.message}
        data-testid="field-permission"
      >
        {allowedPermissions.map((p) => (
          <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('apiKeys.createDialog.fields.expiresAt')}
        type="datetime-local"
        fullWidth
        size="small"
        {...register('expires_at')}
        slotProps={{ inputLabel: { shrink: true } }}
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
