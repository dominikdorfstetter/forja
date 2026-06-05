import { useState } from 'react';
import { Stack, TextField, Tabs, Tab, Box, Typography } from '@mui/material';
import type {
  Control,
  FieldErrors,
  UseFormWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import type { SiteLocaleResponse } from '@/types/api';
import ProjectLinksEditor from './ProjectLinksEditor';
import type { ProjectWizardFormData } from './ProjectWizard';

interface ProjectWizardContentStepProps {
  control: Control<ProjectWizardFormData>;
  errors: FieldErrors<ProjectWizardFormData>;
  watch: UseFormWatch<ProjectWizardFormData>;
  setValue: UseFormSetValue<ProjectWizardFormData>;
  locales: SiteLocaleResponse[];
  siteId: string;
}

export default function ProjectWizardContentStep({
  control,
  errors,
  watch,
  setValue,
  locales,
  siteId,
}: ProjectWizardContentStepProps) {
  const { t } = useTranslation();
  const [localeTab, setLocaleTab] = useState(0);
  const currentLocale = locales[localeTab] ?? locales[0];
  const links = watch('links') ?? [];

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {locales.length > 1 && (
        <Tabs value={localeTab} onChange={(_, v) => setLocaleTab(v)} variant="scrollable" scrollButtons="auto">
          {locales.map((loc) => (
            <Tab key={loc.locale_id} label={loc.name} data-testid={`project-wizard.content-locale-tab.${loc.code}`} />
          ))}
        </Tabs>
      )}
      {currentLocale && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {currentLocale.name}
          </Typography>

          <Controller
            name={`short_descriptions.${currentLocale.locale_id}`}
            control={control}
            render={({ field }) => (
              <TextField
                label={t('wizard.project.fields.shortDescription')}
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                helperText={`${(field.value ?? '').length}/500`}
                error={!!errors.short_descriptions?.[currentLocale.locale_id as keyof typeof errors.short_descriptions]}
                data-testid="project-wizard.field.short_description"
                slotProps={{
                  htmlInput: { maxLength: 500 }
                }}
              />
            )}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('wizard.project.fields.description')}
            </Typography>
            <Controller
              name={`descriptions.${currentLocale.locale_id}`}
              control={control}
              render={({ field }) => (
                <ForjaEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  siteId={siteId}
                  height={300}
                />
              )}
            />
          </Box>
        </Box>
      )}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('wizard.project.fields.links')}
        </Typography>
        <ProjectLinksEditor
          links={links}
          onChange={(newLinks) => setValue('links', newLinks, { shouldDirty: true })}
        />
      </Box>
    </Stack>
  );
}
