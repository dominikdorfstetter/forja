import { Box, TextField } from '@mui/material';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface SiteWizardBasicsStepProps {
  register: UseFormRegister<never>;
  errors: FieldErrors;
}

export default function SiteWizardBasicsStep({ register, errors }: SiteWizardBasicsStepProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        autoFocus
        label={t('forms.site.fields.name')}
        fullWidth
        required
        {...register('name' as never)}
        error={!!errors.name}
        helperText={(errors.name?.message as string) ?? undefined}
        data-testid="site-wizard.input.name"
      />
      <TextField
        label={t('forms.site.fields.slug')}
        fullWidth
        required
        {...register('slug' as never)}
        error={!!errors.slug}
        helperText={(errors.slug?.message as string) ?? undefined}
        data-testid="site-wizard.input.slug"
      />
      <TextField
        label={t('forms.site.fields.description')}
        fullWidth
        multiline
        rows={3}
        {...register('description' as never)}
        error={!!errors.description}
        helperText={(errors.description?.message as string) ?? undefined}
      />
      <TextField
        label="Timezone"
        fullWidth
        {...register('timezone' as never)}
        error={!!errors.timezone}
        helperText={(errors.timezone?.message as string) || 'e.g. Europe/Vienna, UTC'}
      />
    </Box>
  );
}
