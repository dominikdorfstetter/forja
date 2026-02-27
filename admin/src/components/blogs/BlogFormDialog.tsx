import { useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { slugField, requiredString, siteIdsField } from '@/utils/validation';
import type { BlogListItem, CreateBlogRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useFormHistory } from '@/hooks/useFormHistory';

const blogSchema = z.object({
  slug: slugField,
  author: requiredString(200),
  published_date: z.string().min(1, 'Date is required'),
  is_featured: z.boolean(),
  allow_comments: z.boolean(),
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
  site_ids: siteIdsField,
});

type BlogFormData = z.infer<typeof blogSchema>;

interface BlogFormDialogProps {
  open: boolean;
  blog?: BlogListItem | null;
  onSubmit: (data: CreateBlogRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function BlogFormDialog({ open, blog, onSubmit, onClose, loading }: BlogFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, getValues, formState: { errors, isValid } } = useForm<BlogFormData>({
    resolver: zodResolver(blogSchema),
    defaultValues: { slug: '', author: '', published_date: new Date().toISOString().split('T')[0], is_featured: false, allow_comments: true, status: 'Draft', site_ids: [] },
    mode: 'onChange',
  });

  const { snapshot, undo, redo, canUndo, canRedo, clear } = useFormHistory(getValues, reset);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  useEffect(() => {
    if (open) {
      clear();
      reset(blog ? {
        slug: blog.slug || '',
        author: blog.author,
        published_date: blog.published_date,
        is_featured: blog.is_featured,
        allow_comments: true,
        status: blog.status,
        site_ids: [],
      } : { slug: '', author: '', published_date: new Date().toISOString().split('T')[0], is_featured: false, allow_comments: true, status: 'Draft' as const, site_ids: [] });
      // snapshot initial state after a tick so reset has applied
      setTimeout(() => snapshot(), 0);
    }
  }, [open, blog, reset, clear, snapshot]);

  const onFormSubmit = (data: BlogFormData) => {
    onSubmit({
      slug: data.slug,
      author: data.author,
      published_date: data.published_date,
      is_featured: data.is_featured,
      allow_comments: data.allow_comments,
      status: data.status,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="blog-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="blog-form-title">{blog ? t('forms.blog.editTitle') : t('forms.blog.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.blog.fields.slug')} fullWidth required {...register('slug')} onBlur={snapshot} error={!!errors.slug} helperText={errors.slug?.message} />
            <TextField label={t('forms.blog.fields.author')} fullWidth required {...register('author')} onBlur={snapshot} error={!!errors.author} helperText={errors.author?.message} />
            <TextField label={t('forms.blog.fields.publishedDate')} type="date" fullWidth required InputLabelProps={{ shrink: true }} {...register('published_date')} onBlur={snapshot} error={!!errors.published_date} helperText={errors.published_date?.message} />
            <Controller name="status" control={control} render={({ field }) => (
              <TextField select label={t('forms.blog.fields.status')} fullWidth {...field} onChange={(e) => { field.onChange(e); snapshot(); }}>
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="InReview">In Review</MenuItem>
                <MenuItem value="Scheduled">Scheduled</MenuItem>
                <MenuItem value="Published">Published</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
              </TextField>
            )} />
            {!blog && (
              <Controller name="site_ids" control={control} render={({ field }) => (
                <TextField select label={t('forms.blog.fields.siteId')} fullWidth required SelectProps={{ multiple: true }} {...field} onChange={(e) => { field.onChange(e); snapshot(); }} error={!!errors.site_ids} helperText={errors.site_ids?.message}>
                  {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              )} />
            )}
            <Controller name="is_featured" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={(e) => { field.onChange(e); snapshot(); }} />} label={t('forms.blog.fields.featured')} />
            )} />
            <Controller name="allow_comments" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={(e) => { field.onChange(e); snapshot(); }} />} label="Allow Comments" />
            )} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Tooltip title={t('forms.undo')}>
            <span>
              <IconButton size="small" onClick={undo} disabled={!canUndo}><UndoIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('forms.redo')}>
            <span>
              <IconButton size="small" onClick={redo} disabled={!canRedo}><RedoIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>{loading ? t('common.actions.saving') : (blog ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
