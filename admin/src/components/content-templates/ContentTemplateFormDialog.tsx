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
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ContentTemplate, CreateContentTemplateRequest, UpdateContentTemplateRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

const ICON_OPTIONS = [
  'Article',
  'School',
  'NewReleases',
  'RateReview',
  'Campaign',
  'Code',
  'Build',
  'Lightbulb',
  'Star',
  'Announcement',
] as const;

const contentTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  icon: z.string().max(50),
  slug_prefix: z.string().max(100),
  is_featured: z.boolean(),
  allow_comments: z.boolean(),
  is_active: z.boolean(),
  title: z.string().optional().or(z.literal('')),
  subtitle: z.string().optional().or(z.literal('')),
  excerpt: z.string().optional().or(z.literal('')),
  body: z.string().optional().or(z.literal('')),
  meta_title: z.string().max(500).optional().or(z.literal('')),
  meta_description: z.string().max(500).optional().or(z.literal('')),
});

type ContentTemplateFormData = z.infer<typeof contentTemplateSchema>;

interface ContentTemplateFormDialogProps {
  open: boolean;
  template?: ContentTemplate | null;
  onSubmitCreate?: (data: CreateContentTemplateRequest) => void;
  onSubmitUpdate?: (data: UpdateContentTemplateRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ContentTemplateFormDialog({
  open,
  template,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
  loading,
}: ContentTemplateFormDialogProps) {
  const { t } = useTranslation();

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<ContentTemplateFormData>({
    resolver: zodResolver(contentTemplateSchema),
    defaultValues: {
      name: '', description: '', icon: 'Article', slug_prefix: 'post',
      is_featured: false, allow_comments: true, is_active: true,
      title: '', subtitle: '', excerpt: '', body: '',
      meta_title: '', meta_description: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(template
        ? {
            name: template.name,
            description: template.description || '',
            icon: template.icon,
            slug_prefix: template.slug_prefix,
            is_featured: template.is_featured,
            allow_comments: template.allow_comments,
            is_active: template.is_active,
            title: template.title,
            subtitle: template.subtitle,
            excerpt: template.excerpt,
            body: template.body,
            meta_title: template.meta_title,
            meta_description: template.meta_description,
          }
        : {
            name: '', description: '', icon: 'Article', slug_prefix: 'post',
            is_featured: false, allow_comments: true, is_active: true,
            title: '', subtitle: '', excerpt: '', body: '',
            meta_title: '', meta_description: '',
          });
    }
  }, [open, template, reset]);

  const onFormSubmit = (data: ContentTemplateFormData) => {
    if (template && onSubmitUpdate) {
      onSubmitUpdate({
        name: data.name,
        description: data.description || undefined,
        icon: data.icon,
        slug_prefix: data.slug_prefix,
        is_featured: data.is_featured,
        allow_comments: data.allow_comments,
        is_active: data.is_active,
        title: data.title || undefined,
        subtitle: data.subtitle || undefined,
        excerpt: data.excerpt || undefined,
        body: data.body || undefined,
        meta_title: data.meta_title || undefined,
        meta_description: data.meta_description || undefined,
      });
    } else if (onSubmitCreate) {
      onSubmitCreate({
        name: data.name,
        description: data.description || undefined,
        icon: data.icon,
        slug_prefix: data.slug_prefix,
        is_featured: data.is_featured,
        allow_comments: data.allow_comments,
        is_active: data.is_active,
        title: data.title || undefined,
        subtitle: data.subtitle || undefined,
        excerpt: data.excerpt || undefined,
        body: data.body || undefined,
        meta_title: data.meta_title || undefined,
        meta_description: data.meta_description || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="content-template-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="content-template-form-title">
          {template ? t('forms.contentTemplate.editTitle') : t('forms.contentTemplate.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            {t('forms.contentTemplate.sections.metadata')}
          </Typography>

          <TextField
            label={t('forms.contentTemplate.fields.name')}
            fullWidth
            required
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label={t('forms.contentTemplate.fields.description')}
            fullWidth
            multiline
            rows={2}
            {...register('description')}
            error={!!errors.description}
            helperText={errors.description?.message}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label={t('forms.contentTemplate.fields.icon')}
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.icon}
                  helperText={errors.icon?.message}
                >
                  {ICON_OPTIONS.map((icon) => (
                    <MenuItem key={icon} value={icon}>{icon}</MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label={t('forms.contentTemplate.fields.slugPrefix')}
              fullWidth
              {...register('slug_prefix')}
              error={!!errors.slug_prefix}
              helperText={errors.slug_prefix?.message}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            <Controller name="is_featured" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={field.onChange} />}
                label={t('forms.contentTemplate.fields.isFeatured')}
              />
            )} />
            <Controller name="allow_comments" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={field.onChange} />}
                label={t('forms.contentTemplate.fields.allowComments')}
              />
            )} />
            {template && (
              <Controller name="is_active" control={control} render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={field.onChange} />}
                  label={t('forms.contentTemplate.fields.isActive')}
                />
              )} />
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            {t('forms.contentTemplate.sections.content')}
          </Typography>

          <TextField
            label={t('forms.contentTemplate.fields.title')}
            fullWidth
            {...register('title')}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('forms.contentTemplate.fields.subtitle')}
            fullWidth
            {...register('subtitle')}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('forms.contentTemplate.fields.excerpt')}
            fullWidth
            multiline
            rows={2}
            {...register('excerpt')}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('forms.contentTemplate.fields.body')}
            fullWidth
            multiline
            rows={10}
            {...register('body')}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('forms.contentTemplate.fields.metaTitle')}
            fullWidth
            {...register('meta_title')}
            error={!!errors.meta_title}
            helperText={errors.meta_title?.message}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('forms.contentTemplate.fields.metaDescription')}
            fullWidth
            multiline
            rows={2}
            {...register('meta_description')}
            error={!!errors.meta_description}
            helperText={errors.meta_description?.message}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isValid}
          >
            {loading ? t('common.actions.saving') : template ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
