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
  Autocomplete,
  Chip,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Webhook, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

const AVAILABLE_EVENTS = [
  'blog.created',
  'blog.updated',
  'blog.deleted',
  'page.created',
  'page.updated',
  'page.deleted',
  'document.created',
  'document.updated',
  'document.deleted',
];

const webhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  description: z.string().optional(),
  events: z.array(z.string()),
  is_active: z.boolean(),
});

type WebhookFormData = z.infer<typeof webhookSchema>;

interface WebhookFormDialogProps {
  open: boolean;
  webhook?: Webhook | null;
  onSubmitCreate?: (data: CreateWebhookRequest) => void;
  onSubmitUpdate?: (data: UpdateWebhookRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function WebhookFormDialog({
  open,
  webhook,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: WebhookFormDialogProps) {
  const { t } = useTranslation();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { url: '', description: '', events: [], is_active: true },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(webhook
        ? { url: webhook.url, description: webhook.description || '', events: webhook.events, is_active: webhook.is_active }
        : { url: '', description: '', events: [], is_active: true });
    }
  }, [open, webhook, reset]);

  const onFormSubmit = (data: WebhookFormData) => {
    if (webhook && onSubmitUpdate) {
      onSubmitUpdate({
        url: data.url,
        description: data.description || undefined,
        events: data.events,
        is_active: data.is_active,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        url: data.url,
        description: data.description || undefined,
        events: data.events.length > 0 ? data.events : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="webhook-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="webhook-form-title">
          {webhook ? t('forms.webhook.editTitle') : t('forms.webhook.createTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            label={t('forms.webhook.fields.url')}
            fullWidth
            required
            {...register('url')}
            error={!!errors.url}
            helperText={errors.url?.message || t('forms.webhook.fields.urlHelper')}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <TextField
            label={t('forms.webhook.fields.description')}
            fullWidth
            {...register('description')}
            sx={{ mb: 2 }}
          />
          <Controller
            name="events"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                options={AVAILABLE_EVENTS}
                value={field.value}
                onChange={(_, newValue) => field.onChange(newValue)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('forms.webhook.fields.events')}
                    helperText={t('forms.webhook.fields.eventsHelper')}
                  />
                )}
                sx={{ mb: 2 }}
              />
            )}
          />
          {webhook && (
            <Controller name="is_active" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={field.onChange} />}
                label={t('forms.webhook.fields.active')}
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
            {loading ? t('common.actions.saving') : webhook ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
