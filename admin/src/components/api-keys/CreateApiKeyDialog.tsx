import { useState, useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { requiredString, optionalString, positiveInt } from '@/utils/validation';
import type { CreateApiKeyRequest, CreateApiKeyResponse, Site, ApiKeyPermission } from '@/types/api';
import { useTranslation } from 'react-i18next';

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
  site_id: z.string().min(1, 'Site is required'),
  user_id: z.string().optional(),
  expires_at: z.string().optional(),
  rate_limit_per_second: positiveInt,
  rate_limit_per_minute: positiveInt,
  rate_limit_per_hour: positiveInt,
  rate_limit_per_day: positiveInt,
});

type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;

interface CreateApiKeyDialogProps {
  open: boolean;
  sites: Site[];
  maxPermission?: ApiKeyPermission;
  isSystemAdmin?: boolean;
  onSubmit: (data: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;
  onClose: () => void;
}

export default function CreateApiKeyDialog({ open, sites, maxPermission = 'Admin', isSystemAdmin = false, onSubmit, onClose }: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: '',
      description: '',
      permission: 'Read',
      rate_limit_per_second: 10,
      rate_limit_per_minute: 100,
      rate_limit_per_hour: 1000,
      rate_limit_per_day: 10000,
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
        user_id: data.user_id || undefined,
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
      <Dialog open={open} maxWidth="sm" fullWidth aria-labelledby="create-api-key-title">
        <DialogTitle id="create-api-key-title">{t('apiKeys.createDialog.created.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('apiKeys.createDialog.created.warning')}
          </Alert>
          <Typography variant="subtitle2" gutterBottom>{t('apiKeys.createDialog.fields.name')}</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{createdKey.name}</Typography>
          <Typography variant="subtitle2" gutterBottom>API Key</Typography>
          <TextField
            fullWidth
            value={createdKey.key}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace' },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopy} edge="end" aria-label="Copy API key">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCopy} variant="outlined">{t('apiKeys.createDialog.created.title')}</Button>
          <Button onClick={handleClose} variant="contained">{t('common.actions.close')}</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Phase 1: creation form
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-labelledby="create-api-key-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="create-api-key-title">{t('apiKeys.createDialog.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('apiKeys.createDialog.fields.name')}
              fullWidth
              required
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              autoFocus
            />
            <TextField
              label="Description"
              fullWidth
              multiline
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
              defaultValue="Read"
              {...register('permission')}
              error={!!errors.permission}
              helperText={errors.permission?.message}
            >
              {allowedPermissions.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('apiKeys.createDialog.fields.site')}
              select
              fullWidth
              required
              defaultValue=""
              {...register('site_id')}
              error={!!errors.site_id}
              helperText={errors.site_id?.message}
            >
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('apiKeys.createDialog.fields.expiresAt')}
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              {...register('expires_at')}
            />
            {isSystemAdmin && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Rate Limits</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="/sec"
                    type="number"
                    size="small"
                    {...register('rate_limit_per_second')}
                    error={!!errors.rate_limit_per_second}
                    helperText={errors.rate_limit_per_second?.message}
                  />
                  <TextField
                    label="/min"
                    type="number"
                    size="small"
                    {...register('rate_limit_per_minute')}
                    error={!!errors.rate_limit_per_minute}
                    helperText={errors.rate_limit_per_minute?.message}
                  />
                  <TextField
                    label="/hour"
                    type="number"
                    size="small"
                    {...register('rate_limit_per_hour')}
                    error={!!errors.rate_limit_per_hour}
                    helperText={errors.rate_limit_per_hour?.message}
                  />
                  <TextField
                    label="/day"
                    type="number"
                    size="small"
                    {...register('rate_limit_per_day')}
                    error={!!errors.rate_limit_per_day}
                    helperText={errors.rate_limit_per_day?.message}
                  />
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={submitting || !isValid}>
            {submitting ? t('common.actions.saving') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
