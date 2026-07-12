import {
  Stack,
  TextField,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Box,
  Typography,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { slugify } from '@/utils/slugify';
import type { SiteLocaleResponse } from '@/types/api';
import { useState } from 'react';
import type { ProjectWizardFormData } from './ProjectWizard';

interface ProjectWizardBasicsStepProps {
  register: UseFormRegister<ProjectWizardFormData>;
  control: Control<ProjectWizardFormData>;
  errors: FieldErrors<ProjectWizardFormData>;
  watch: UseFormWatch<ProjectWizardFormData>;
  setValue: UseFormSetValue<ProjectWizardFormData>;
  isEdit: boolean;
  locales: SiteLocaleResponse[];
}

export default function ProjectWizardBasicsStep({
  register,
  control,
  errors,
  watch,
  setValue,
  isEdit,
  locales,
}: ProjectWizardBasicsStepProps) {
  const { t } = useTranslation();
  const [localeTab, setLocaleTab] = useState(0);
  const isOngoing = watch('is_ongoing');
  const defaultLocale = locales.find((l) => l.is_default) ?? locales[0];
  const currentLocale = locales[localeTab] ?? defaultLocale;

  const handleTitleChange = (locale: SiteLocaleResponse, value: string) => {
    setValue(`titles.${locale.locale_id}`, value);
    // Auto-generate slug from default locale title
    if (defaultLocale && locale.locale_id === defaultLocale.locale_id) {
      setValue('slug', slugify(value), { shouldValidate: true });
    }
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {locales.length > 1 && (
        <Tabs value={localeTab} onChange={(_, v) => setLocaleTab(v)} variant="scrollable" scrollButtons="auto">
          {locales.map((loc) => (
            <Tab key={loc.locale_id} label={loc.name} data-testid={`project-wizard.locale-tab.${loc.code}`} />
          ))}
        </Tabs>
      )}
      {currentLocale && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {currentLocale.name}
          </Typography>
          <TextField
            label={t('wizard.project.fields.title')}
            fullWidth
            required={currentLocale.locale_id === defaultLocale?.locale_id}
            value={watch(`titles.${currentLocale.locale_id}`) ?? ''}
            onChange={(e) => handleTitleChange(currentLocale, e.target.value)}
            error={!!errors.titles && currentLocale.locale_id === defaultLocale?.locale_id}
            helperText={errors.titles && currentLocale.locale_id === defaultLocale?.locale_id ? String(errors.titles.message) : undefined}
            data-testid="project-wizard.field.title"
          />
        </Box>
      )}
      <TextField
        label={t('wizard.project.fields.slug')}
        fullWidth
        required
        {...register('slug')}
        error={!!errors.slug}
        helperText={errors.slug ? String(errors.slug.message) : t('wizard.project.slugHint')}
        data-testid="project-wizard.field.slug"
      />
      <TextField
        label={t('wizard.project.fields.startDate')}
        type="date"
        fullWidth
        {...register('start_date')}
        error={!!errors.start_date}
        helperText={errors.start_date?.message}
        data-testid="project-wizard.field.start_date"
        slotProps={{
          inputLabel: { shrink: true }
        }} />
      <Controller
        name="is_ongoing"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                checked={field.value}
                onChange={field.onChange}
                data-testid="project-wizard.field.is_ongoing"
              />
            }
            label={t('wizard.project.fields.isOngoing')}
          />
        )}
      />
      {!isOngoing && (
        <TextField
          label={t('wizard.project.fields.endDate')}
          type="date"
          fullWidth
          {...register('end_date')}
          error={!!errors.end_date}
          helperText={errors.end_date?.message}
          data-testid="project-wizard.field.end_date"
          slotProps={{
            inputLabel: { shrink: true }
          }} />
      )}
      <Controller
        name="is_featured"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                checked={field.value}
                onChange={field.onChange}
                data-testid="project-wizard.field.is_featured"
              />
            }
            label={t('wizard.project.fields.isFeatured')}
          />
        )}
      />
      {!isEdit && (
        <Typography variant="body2" color="text.secondary" data-testid="project-wizard.field.site_ids">
          {t('wizard.project.siteNote')}
        </Typography>
      )}
    </Stack>
  );
}
