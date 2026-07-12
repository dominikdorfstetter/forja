import { useEffect, useRef } from 'react';
import {
  Box,
  Rating,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { getSites } from '@/services/sites';
import { requiredString, slugField, optionalString, siteIdsField, formResolver} from '@/utils/validation';
import type { SkillResponse, CreateSkillRequest, SkillCategory } from '@/types/api';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { queryKeys } from '@/lib/queryKeys';

const skillSchema = z.object({
  name: requiredString(100),
  slug: slugField,
  category: z.enum(['Programming', 'Framework', 'Database', 'Devops', 'Language', 'SoftSkill', 'Tool', 'Other', '' as const]).optional(),
  icon: optionalString(100),
  proficiency_level: z.union([z.coerce.number().int().min(1, 'Min 1').max(5, 'Max 5'), z.literal(0), z.literal('')]),
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
    resolver: formResolver(skillSchema),
    defaultValues: { name: '', slug: '', category: '', icon: '', proficiency_level: '', is_global: false, site_ids: [] },
    mode: 'onChange',
  });

  const { data: sites } = useQuery({ queryKey: queryKeys.sites(), queryFn: () => getSites() });

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
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
    prevOpenRef.current = open;
  });

  const onFormSubmit = (data: SkillFormData) => {
    onSubmit({
      name: data.name,
      slug: data.slug,
      category: data.category || undefined,
      icon: data.icon || undefined,
      proficiency_level: data.proficiency_level === '' || data.proficiency_level === 0 ? undefined : Number(data.proficiency_level),
      is_global: data.is_global,
      site_ids: data.site_ids,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="school"
      title={skill ? t('forms.skill.editTitle') : t('forms.skill.createTitle')}
      submitLabel={skill ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="skill-form.btn.submit"
      cancelTestId="skill-form.btn.cancel"
      loading={loading}
      data-testid="skill-form.dialog"
    >
      <TextField label={t('forms.skill.fields.name')} fullWidth required size="small" {...register('name')} error={!!errors.name} helperText={errors.name?.message} autoFocus />
      <TextField label={t('forms.skill.fields.slug')} fullWidth required size="small" {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
      <Controller name="category" control={control} render={({ field }) => (
        <TextField select label={t('forms.skill.fields.category')} fullWidth size="small" {...field}>
          <MenuItem value="">{t('common.labels.none')}</MenuItem>
          {SKILL_CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
        </TextField>
      )} />
      <TextField label={t('forms.skill.fields.icon')} fullWidth size="small" {...register('icon')} helperText="Optional icon name or class" />
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('forms.skill.fields.proficiency')}</Typography>
        <Controller name="proficiency_level" control={control} render={({ field }) => (
          <Rating
            value={field.value === '' || field.value === 0 ? 0 : Number(field.value)}
            max={5}
            size="large"
            onChange={(_, newValue) => field.onChange(newValue ?? 0)}
            getLabelText={(value) => `${value} ${value === 1 ? 'Star' : 'Stars'}`}
          />
        )} />
      </Box>
      <Controller name="is_global" control={control} render={({ field }) => (
        <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('common.labels.global')} />
      )} />
      {!skill && (
        <Controller name="site_ids" control={control} render={({ field }) => (
          <TextField
            select
            label={t('forms.skill.fields.siteId')}
            fullWidth
            required
            size="small"
            {...field}
            error={!!errors.site_ids}
            helperText={errors.site_ids?.message}
            slotProps={{
              select: { multiple: true }
            }}>
            {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        )} />
      )}
    </FormDialog>
  );
}
