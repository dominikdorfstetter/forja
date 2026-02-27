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
import { requiredString, slugField, optionalString, siteIdsField } from '@/utils/validation';
import type { SkillResponse, CreateSkillRequest, SkillCategory } from '@/types/api';
import { useTranslation } from 'react-i18next';

const skillSchema = z.object({
  name: requiredString(100),
  slug: slugField,
  category: z.enum(['Programming', 'Framework', 'Database', 'Devops', 'Language', 'SoftSkill', 'Tool', 'Other', '' as const]).optional(),
  icon: optionalString(100),
  proficiency_level: z.union([z.coerce.number().int().min(0, 'Min 0').max(100, 'Max 100'), z.literal('')]),
  is_global: z.boolean(),
  site_ids: siteIdsField,
});

type SkillFormData = z.infer<typeof skillSchema>;

interface SkillFormDialogProps {
  open: boolean;
  skill?: SkillResponse | null;
  onSubmit: (data: CreateSkillRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const SKILL_CATEGORIES: SkillCategory[] = [
  'Programming',
  'Framework',
  'Database',
  'Devops',
  'Language',
  'SoftSkill',
  'Tool',
  'Other',
];

export default function SkillFormDialog({ open, skill, onSubmit, onClose, loading }: SkillFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: { name: '', slug: '', category: '', icon: '', proficiency_level: '', is_global: false, site_ids: [] },
    mode: 'onChange',
  });

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  useEffect(() => {
    if (open) {
      reset(skill ? {
        name: skill.name,
        slug: skill.slug,
        category: skill.category || '',
        icon: skill.icon || '',
        proficiency_level: skill.proficiency_level ?? '',
        is_global: false,
        site_ids: [],
      } : { name: '', slug: '', category: '', icon: '', proficiency_level: '', is_global: false, site_ids: [] });
    }
  }, [open, skill, reset]);

  const onFormSubmit = (data: SkillFormData) => {
    onSubmit({
      name: data.name,
      slug: data.slug,
      category: data.category || undefined,
      icon: data.icon || undefined,
      proficiency_level: data.proficiency_level === '' ? undefined : Number(data.proficiency_level),
      is_global: data.is_global,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="skill-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="skill-form-title">{skill ? t('forms.skill.editTitle') : t('forms.skill.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.skill.fields.name')} fullWidth required {...register('name')} error={!!errors.name} helperText={errors.name?.message} autoFocus />
            <TextField label={t('forms.skill.fields.slug')} fullWidth required {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
            <Controller name="category" control={control} render={({ field }) => (
              <TextField select label={t('forms.skill.fields.category')} fullWidth {...field}>
                <MenuItem value="">{t('common.labels.none')}</MenuItem>
                {SKILL_CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
              </TextField>
            )} />
            <TextField label={t('forms.skill.fields.icon')} fullWidth {...register('icon')} helperText="Optional icon name or class" />
            <TextField label={t('forms.skill.fields.proficiency')} type="number" fullWidth {...register('proficiency_level')} error={!!errors.proficiency_level} helperText={errors.proficiency_level?.message || '0-100, optional'} />
            <Controller name="is_global" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('common.labels.global')} />
            )} />
            {!skill && (
              <Controller name="site_ids" control={control} render={({ field }) => (
                <TextField select label={t('forms.skill.fields.siteId')} fullWidth required SelectProps={{ multiple: true }} {...field} error={!!errors.site_ids} helperText={errors.site_ids?.message}>
                  {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              )} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>{loading ? t('common.actions.saving') : (skill ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
