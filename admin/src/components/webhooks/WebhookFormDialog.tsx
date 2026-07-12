import { useEffect, useRef, useState } from 'react';
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
import { z } from 'zod';
import type { Webhook, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import WebhookTemplatePicker from './WebhookTemplatePicker';
import { WEBHOOK_TEMPLATES, type WebhookTemplate } from '@/data/webhookTemplates';

const AVAILABLE_EVENTS = [
  'blog.created',
  'blog.updated',
  'blog.deleted',
  'blog.published',
  'page.created',
  'page.updated',
  'page.deleted',
  'page.published',
  'media.created',
  'media.deleted',
  'document.created',
  'document.updated',
  'document.deleted',
  'cv.created',
  'cv.updated',
  'cv.deleted',
  'legal.created',
  'legal.updated',
  'legal.deleted',
  'legal.published',
  'navigation.created',
  'navigation.updated',
  'navigation.deleted',
];

const webhookSchema = z.object({
  url: z.url('Must be a valid URL'),
  description: z.string().optional(),
  events: z.array(z.string()),
  is_active: z.boolean(),
  debounce_seconds: z.number().int().min(0).max(300),
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors, isValid } } = useForm<WebhookFormData>({
    resolver: formResolver(webhookSchema),
    defaultValues: { url: '', description: '', events: [], is_active: true, debounce_seconds: 0 },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(webhook
        ? { url: webhook.url, description: webhook.description || '', events: webhook.events, is_active: webhook.is_active, debounce_seconds: webhook.debounce_seconds ?? 0 }
        : { url: '', description: '', events: [], is_active: true, debounce_seconds: 0 });
      setSelectedTemplate(null);
    }
    prevOpenRef.current = open;
  }, [open, reset, webhook]);

  const handleTemplateSelect = (template: WebhookTemplate | null) => {
    if (template) {
      setSelectedTemplate(template.id);
      setValue('events', template.defaultEvents, { shouldValidate: true });
      setValue('description', template.defaultDescription, { shouldValidate: true });
      setValue('debounce_seconds', template.defaultDebounceSeconds, { shouldValidate: true });
    } else {
      setSelectedTemplate(null);
      setValue('events', [], { shouldValidate: true });
      setValue('description', '', { shouldValidate: true });
      setValue('debounce_seconds', 0, { shouldValidate: true });
    }
  };

  const descriptionValue = watch('description');
  const debounceValue = watch('debounce_seconds');

  const urlPlaceholder = selectedTemplate
    ? WEBHOOK_TEMPLATES.find((tpl) => tpl.id === selectedTemplate)?.urlPlaceholder
    : undefined;

  const onFormSubmit = (data: WebhookFormData) => {
    if (webhook && onSubmitUpdate) {
      onSubmitUpdate({
        url: data.url,
        description: data.description || undefined,
        events: data.events,
        is_active: data.is_active,
        debounce_seconds: data.debounce_seconds,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        url: data.url,
        description: data.description || undefined,
        events: data.events.length > 0 ? data.events : undefined,
        debounce_seconds: data.debounce_seconds,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="webhook-form-title" data-testid="webhook-form.dialog">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="webhook-form-title">
          {webhook ? t('forms.webhook.editTitle') : t('forms.webhook.createTitle')}
        </DialogTitle>
        <DialogContent>
          {!webhook && (
            <WebhookTemplatePicker
              onSelect={handleTemplateSelect}
              selected={selectedTemplate}
            />
          )}
          <TextField
            label={t('forms.webhook.fields.url')}
            fullWidth
            required
            {...register('url')}
            error={!!errors.url}
            helperText={errors.url?.message || t('forms.webhook.fields.urlHelper')}
            placeholder={urlPlaceholder}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <TextField
            label={t('forms.webhook.fields.description')}
            fullWidth
            {...register('description')}
            slotProps={{ inputLabel: { shrink: !!descriptionValue } }}
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
                // eslint-disable-next-line forja/require-read-only-gate -- dialog opened only from isAdmin actions on Webhooks page
                onChange={(_, newValue) => field.onChange(newValue)}
                renderValue={(value, getItemProps) =>
                  value.map((option, index) => {
                    const { key, ...itemProps } = getItemProps({ index });
                    return (
                      <Chip variant="outlined" label={option} size="small" key={key} {...itemProps} />
                    );
                  })
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
          <TextField
            label={t('forms.webhook.fields.debounce')}
            type="number"
            fullWidth
            {...register('debounce_seconds', { valueAsNumber: true })}
            error={!!errors.debounce_seconds}
            helperText={errors.debounce_seconds?.message || t('forms.webhook.fields.debounceHelper')}
            slotProps={{ htmlInput: { min: 0, max: 300 }, inputLabel: { shrink: debounceValue != null && debounceValue !== undefined } }}
            sx={{ mb: 2 }}
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
          <Button onClick={onClose} data-testid="webhook-form.btn.cancel">{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isValid}
            data-testid="webhook-form.btn.submit"
          >
            {loading ? t('common.actions.saving') : webhook ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
