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
import { requiredString, slugField, optionalString, nonNegativeInt, siteIdsField } from '@/utils/validation';
import type { PageResponse, PageListItem, CreatePageRequest, PageType, ContentStatus } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useFormHistory } from '@/hooks/useFormHistory';

const pageSchema = z.object({
  route: requiredString(255),
  slug: slugField,
  page_type: z.enum(['Static', 'Landing', 'Contact', 'BlogIndex', 'Custom']),
  template: optionalString(100),
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
  is_in_navigation: z.boolean(),
  navigation_order: z.union([nonNegativeInt, z.literal('')]),
  parent_page_id: z.string().optional().or(z.literal('')),
  site_ids: siteIdsField,
});

type PageFormData = z.infer<typeof pageSchema>;

interface PageFormDialogProps {
  open: boolean;
  page?: PageResponse | PageListItem | null;
  onSubmit: (data: CreatePageRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const PAGE_TYPES: PageType[] = ['Static', 'Landing', 'Contact', 'BlogIndex', 'Custom'];
const STATUSES: ContentStatus[] = ['Draft', 'InReview', 'Scheduled', 'Published', 'Archived'];

export default function PageFormDialog({ open, page, onSubmit, onClose, loading }: PageFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, watch, getValues, formState: { errors, isValid } } = useForm<PageFormData>({
    resolver: zodResolver(pageSchema),
    defaultValues: { route: '', slug: '', page_type: 'Static' as PageType, template: '', status: 'Draft' as const, is_in_navigation: false, navigation_order: '', parent_page_id: '', site_ids: [] },
    mode: 'onChange',
  });

  const { snapshot, undo, redo, canUndo, canRedo, clear } = useFormHistory(getValues, reset);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  const isInNavigation = watch('is_in_navigation');

  useEffect(() => {
    if (open) {
      clear();
      reset(page ? {
        route: page.route,
        slug: page.slug || '',
        page_type: page.page_type,
        template: ('template' in page && page.template) || '',
        status: page.status,
        is_in_navigation: page.is_in_navigation,
        navigation_order: ('navigation_order' in page && page.navigation_order != null) ? page.navigation_order : '',
        parent_page_id: ('parent_page_id' in page && page.parent_page_id) || '',
        site_ids: [],
      } : { route: '', slug: '', page_type: 'Static' as PageType, template: '', status: 'Draft' as const, is_in_navigation: false, navigation_order: '', parent_page_id: '', site_ids: [] });
      setTimeout(() => snapshot(), 0);
    }
  }, [open, page, reset, clear, snapshot]);

  const onFormSubmit = (data: PageFormData) => {
    onSubmit({
      route: data.route,
      slug: data.slug,
      page_type: data.page_type,
      template: data.template || undefined,
      status: data.status,
      is_in_navigation: data.is_in_navigation,
      navigation_order: data.is_in_navigation && data.navigation_order !== '' ? Number(data.navigation_order) : undefined,
      parent_page_id: data.parent_page_id || undefined,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="page-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="page-form-title">{page ? t('forms.page.editTitle') : t('forms.page.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.page.fields.route')} fullWidth required {...register('route')} onBlur={snapshot} error={!!errors.route} helperText={errors.route?.message} autoFocus />
            <TextField label={t('forms.blog.fields.slug')} fullWidth required {...register('slug')} onBlur={snapshot} error={!!errors.slug} helperText={errors.slug?.message} />
            <Controller name="page_type" control={control} render={({ field }) => (
              <TextField select label={t('forms.page.fields.pageType')} fullWidth {...field} onChange={(e) => { field.onChange(e); snapshot(); }}>
                {PAGE_TYPES.map((pt) => <MenuItem key={pt} value={pt}>{pt}</MenuItem>)}
              </TextField>
            )} />
            <TextField label="Template" fullWidth {...register('template')} onBlur={snapshot} helperText="Optional template identifier" />
            <Controller name="status" control={control} render={({ field }) => (
              <TextField select label={t('forms.page.fields.status')} fullWidth {...field} onChange={(e) => { field.onChange(e); snapshot(); }}>
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="is_in_navigation" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={(e) => { field.onChange(e); snapshot(); }} />} label={t('forms.page.fields.inNavigation')} />
            )} />
            {isInNavigation && (
              <TextField label={t('forms.page.fields.navOrder')} type="number" fullWidth {...register('navigation_order')} onBlur={snapshot} error={!!errors.navigation_order} helperText={errors.navigation_order?.message} />
            )}
            <TextField label="Parent Page ID" fullWidth {...register('parent_page_id')} onBlur={snapshot} helperText="Optional parent page UUID" />
            {!page && (
              <Controller name="site_ids" control={control} render={({ field }) => (
                <TextField select label={t('forms.page.fields.siteId')} fullWidth required SelectProps={{ multiple: true }} {...field} onChange={(e) => { field.onChange(e); snapshot(); }} error={!!errors.site_ids} helperText={errors.site_ids?.message}>
                  {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              )} />
            )}
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
          <Button type="submit" variant="contained" disabled={loading || !isValid}>{loading ? t('common.actions.saving') : (page ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
