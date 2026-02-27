import { useEffect } from 'react';
import {
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
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { requiredString, nonNegativeInt, siteIdsField } from '@/utils/validation';
import type { CvEntryResponse, CreateCvEntryRequest, CvEntryType } from '@/types/api';
import { useTranslation } from 'react-i18next';

const cvEntrySchema = z.object({
  company: requiredString(200),
  company_url: z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional(),
  location: requiredString(200),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().or(z.literal('')),
  is_current: z.boolean(),
  entry_type: z.enum(['Work', 'Education', 'Volunteer', 'Certification', 'Project']),
  display_order: nonNegativeInt,
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
  site_ids: siteIdsField,
}).refine(
  (data) => {
    if (data.end_date && data.start_date) return data.end_date >= data.start_date;
    return true;
  },
  { message: 'End date must be after start date', path: ['end_date'] },
);

type CvEntryFormData = z.infer<typeof cvEntrySchema>;

interface CvEntryFormDialogProps {
  open: boolean;
  entry?: CvEntryResponse | null;
  onSubmit: (data: CreateCvEntryRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

export default function CvEntryFormDialog({ open, entry, onSubmit, onClose, loading }: CvEntryFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, watch, formState: { errors, isValid } } = useForm<CvEntryFormData>({
    resolver: zodResolver(cvEntrySchema),
    defaultValues: { company: '', company_url: '', location: '', start_date: '', end_date: '', is_current: false, entry_type: 'Work' as CvEntryType, display_order: 0, status: 'Draft' as const, site_ids: [] },
    mode: 'onChange',
  });

  const isCurrent = watch('is_current');

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  useEffect(() => {
    if (open) {
      reset(entry ? {
        company: entry.company,
        company_url: entry.company_url || '',
        location: entry.location,
        start_date: entry.start_date,
        end_date: entry.end_date || '',
        is_current: entry.is_current,
        entry_type: entry.entry_type,
        display_order: entry.display_order,
        status: 'Draft' as const,
        site_ids: [],
      } : { company: '', company_url: '', location: '', start_date: '', end_date: '', is_current: false, entry_type: 'Work' as CvEntryType, display_order: 0, status: 'Draft' as const, site_ids: [] });
    }
  }, [open, entry, reset]);

  const onFormSubmit = (data: CvEntryFormData) => {
    onSubmit({
      company: data.company,
      company_url: data.company_url || undefined,
      location: data.location,
      start_date: data.start_date,
      end_date: data.is_current ? undefined : (data.end_date || undefined),
      is_current: data.is_current,
      entry_type: data.entry_type,
      display_order: data.display_order,
      status: data.status,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="cv-entry-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="cv-entry-form-title">{entry ? t('forms.cvEntry.editTitle') : t('forms.cvEntry.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.cvEntry.fields.company')} fullWidth required {...register('company')} error={!!errors.company} helperText={errors.company?.message} autoFocus />
            <TextField label="Company URL" fullWidth {...register('company_url')} error={!!errors.company_url} helperText={errors.company_url?.message || 'Optional website URL'} />
            <TextField label={t('forms.cvEntry.fields.location')} fullWidth required {...register('location')} error={!!errors.location} helperText={errors.location?.message} />
            <Controller name="entry_type" control={control} render={({ field }) => (
              <TextField select label={t('forms.cvEntry.fields.entryType')} fullWidth {...field}>
                {ENTRY_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </TextField>
            )} />
            <TextField label={t('forms.cvEntry.fields.startDate')} type="date" fullWidth required InputLabelProps={{ shrink: true }} {...register('start_date')} error={!!errors.start_date} helperText={errors.start_date?.message} />
            <Controller name="is_current" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('forms.cvEntry.fields.isCurrent')} />
            )} />
            {!isCurrent && (
              <TextField label={t('forms.cvEntry.fields.endDate')} type="date" fullWidth InputLabelProps={{ shrink: true }} {...register('end_date')} error={!!errors.end_date} helperText={errors.end_date?.message} />
            )}
            <TextField label={t('forms.cvEntry.fields.displayOrder')} type="number" fullWidth {...register('display_order')} error={!!errors.display_order} helperText={errors.display_order?.message} />
            {!entry && (
              <Controller name="status" control={control} render={({ field }) => (
                <TextField select label={t('forms.blog.fields.status')} fullWidth {...field}>
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="InReview">In Review</MenuItem>
                  <MenuItem value="Scheduled">Scheduled</MenuItem>
                  <MenuItem value="Published">Published</MenuItem>
                  <MenuItem value="Archived">Archived</MenuItem>
                </TextField>
              )} />
            )}
            {!entry && (
              <Controller name="site_ids" control={control} render={({ field }) => (
                <TextField select label={t('forms.cvEntry.fields.siteId')} fullWidth required SelectProps={{ multiple: true }} {...field} error={!!errors.site_ids} helperText={errors.site_ids?.message}>
                  {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              )} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>{loading ? t('common.actions.saving') : (entry ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
