import { Stack, TextField, FormControlLabel, Switch } from '@mui/material';
import { Controller } from 'react-hook-form';
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CvEntryWizardFormData } from './CvEntryWizard';

interface CvEntryWizardTimelineStepProps {
  register: UseFormRegister<CvEntryWizardFormData>;
  control: Control<CvEntryWizardFormData>;
  errors: FieldErrors<CvEntryWizardFormData>;
  watch: UseFormWatch<CvEntryWizardFormData>;
}

export default function CvEntryWizardTimelineStep({
  register,
  control,
  errors,
  watch,
}: CvEntryWizardTimelineStepProps) {
  const { t } = useTranslation();
  const isCurrent = watch('is_current');

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        label={t('wizard.cvEntry.fields.startDate')}
        type="date"
        fullWidth
        required
        {...register('start_date')}
        error={!!errors.start_date}
        helperText={errors.start_date?.message}
        data-testid="cv-entry-wizard.field.start_date"
        slotProps={{
          inputLabel: { shrink: true }
        }} />
      <Controller
        name="is_current"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                checked={field.value}
                onChange={field.onChange}
                data-testid="cv-entry-wizard.field.is_current"
              />
            }
            label={t('wizard.cvEntry.fields.isCurrent')}
          />
        )}
      />
      {!isCurrent && (
        <TextField
          label={t('wizard.cvEntry.fields.endDate')}
          type="date"
          fullWidth
          {...register('end_date')}
          error={!!errors.end_date}
          helperText={errors.end_date?.message}
          data-testid="cv-entry-wizard.field.end_date"
          slotProps={{
            inputLabel: { shrink: true }
          }} />
      )}
    </Stack>
  );
}
