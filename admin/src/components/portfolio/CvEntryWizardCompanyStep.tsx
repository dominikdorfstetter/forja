import { useState } from 'react';
import {
  Stack,
  TextField,
  MenuItem,
  Typography,
  Button,
  Box,
  CardMedia,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CvEntryType } from '@/types/api';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { getMediaById } from '@/services/media';
import type { CvEntryWizardFormData } from './CvEntryWizard';

interface CvEntryWizardCompanyStepProps {
  register: UseFormRegister<CvEntryWizardFormData>;
  control: Control<CvEntryWizardFormData>;
  errors: FieldErrors<CvEntryWizardFormData>;
  setValue: UseFormSetValue<CvEntryWizardFormData>;
  watch: UseFormWatch<CvEntryWizardFormData>;
  isEdit: boolean;
  siteId: string;
}

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];
const STATUS_OPTIONS = ['Draft', 'InReview', 'Scheduled', 'Published', 'Archived'] as const;

export default function CvEntryWizardCompanyStep({
  register,
  control,
  errors,
  setValue,
  watch,
  isEdit,
  siteId,
}: CvEntryWizardCompanyStepProps) {
  const { t } = useTranslation();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const companyLogoId = watch('company_logo_id');

  const handleLogoSelect = async (mediaId: string | null) => {
    if (mediaId) {
      setValue('company_logo_id', mediaId, { shouldDirty: true });
      try {
        const media = await getMediaById(mediaId);
        setLogoUrl(media.public_url ?? null);
      } catch {
        // Silently fail
      }
    }
    setMediaPickerOpen(false);
  };

  const handleLogoRemove = () => {
    setValue('company_logo_id', '', { shouldDirty: true });
    setLogoUrl(null);
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        label={t('wizard.cvEntry.fields.company')}
        fullWidth
        required
        {...register('company')}
        error={!!errors.company}
        helperText={errors.company?.message}
        autoFocus
        data-testid="cv-entry-wizard.field.company"
      />

      <TextField
        label={t('wizard.cvEntry.fields.companyUrl')}
        fullWidth
        {...register('company_url')}
        error={!!errors.company_url}
        helperText={errors.company_url?.message}
        data-testid="cv-entry-wizard.field.company_url"
      />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('wizard.cvEntry.fields.companyLogo')}
        </Typography>
        {companyLogoId && logoUrl && (
          <CardMedia
            component="img"
            image={logoUrl}
            alt="Company logo"
            sx={{ width: 80, height: 80, objectFit: 'contain', mb: 1, borderRadius: 1 }}
          />
        )}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setMediaPickerOpen(true)}
            data-testid="cv-entry-wizard.field.company_logo_id"
          >
            {companyLogoId ? t('wizard.cvEntry.changeLogo') : t('wizard.cvEntry.selectLogo')}
          </Button>
          {companyLogoId && (
            <Button
              size="small"
              color="error"
              onClick={handleLogoRemove}
              data-testid="cv-entry-wizard.field.company_logo_remove"
            >
              {t('common.actions.remove')}
            </Button>
          )}
        </Stack>
      </Box>

      <TextField
        label={t('wizard.cvEntry.fields.location')}
        fullWidth
        required
        {...register('location')}
        error={!!errors.location}
        helperText={errors.location?.message}
        data-testid="cv-entry-wizard.field.location"
      />

      <Controller
        name="entry_type"
        control={control}
        render={({ field }) => (
          <TextField
            select
            label={t('wizard.cvEntry.fields.entryType')}
            fullWidth
            {...field}
            data-testid="cv-entry-wizard.field.entry_type"
          >
            {ENTRY_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      {!isEdit && (
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <TextField
              select
              label={t('wizard.cvEntry.fields.status')}
              fullWidth
              {...field}
              data-testid="cv-entry-wizard.field.status"
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}

      {!isEdit && (
        <Typography variant="body2" color="text.secondary" data-testid="cv-entry-wizard.field.site_ids">
          {t('wizard.cvEntry.siteNote')}
        </Typography>
      )}

      <MediaPickerDialog
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        siteId={siteId}
        onSelect={handleLogoSelect}
      />
    </Stack>
  );
}
