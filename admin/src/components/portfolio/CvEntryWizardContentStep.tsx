import { useState } from 'react';
import {
  Stack,
  TextField,
  Tabs,
  Tab,
  Box,
  Typography,
  IconButton,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type {
  UseFormWatch,
  UseFormSetValue,
  UseFormRegister,
  FieldErrors,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { SiteLocaleResponse } from '@/types/api';
import type { CvEntryWizardFormData } from './CvEntryWizard';

interface CvEntryWizardContentStepProps {
  register: UseFormRegister<CvEntryWizardFormData>;
  errors: FieldErrors<CvEntryWizardFormData>;
  watch: UseFormWatch<CvEntryWizardFormData>;
  setValue: UseFormSetValue<CvEntryWizardFormData>;
  locales: SiteLocaleResponse[];
}

export default function CvEntryWizardContentStep({
  watch,
  setValue,
  locales,
}: CvEntryWizardContentStepProps) {
  const { t } = useTranslation();
  const [localeTab, setLocaleTab] = useState(0);
  const currentLocale = locales[localeTab] ?? locales[0];

  const positions = watch('positions') ?? {};
  const descriptions = watch('descriptions') ?? {};
  const achievements = watch('achievements') ?? {};

  const currentAchievements: string[] = currentLocale
    ? (achievements[currentLocale.locale_id] ?? [])
    : [];

  const handleAddAchievement = () => {
    if (!currentLocale) return;
    const updated = { ...achievements };
    updated[currentLocale.locale_id] = [...currentAchievements, ''];
    setValue('achievements', updated, { shouldDirty: true });
  };

  const handleRemoveAchievement = (index: number) => {
    if (!currentLocale) return;
    const updated = { ...achievements };
    updated[currentLocale.locale_id] = currentAchievements.filter((_, i) => i !== index);
    setValue('achievements', updated, { shouldDirty: true });
  };

  const handleAchievementChange = (index: number, value: string) => {
    if (!currentLocale) return;
    const updated = { ...achievements };
    const arr = [...currentAchievements];
    arr[index] = value;
    updated[currentLocale.locale_id] = arr;
    setValue('achievements', updated, { shouldDirty: true });
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {locales.length > 1 && (
        <Tabs value={localeTab} onChange={(_, v) => setLocaleTab(v)} variant="scrollable" scrollButtons="auto">
          {locales.map((loc) => (
            <Tab key={loc.locale_id} label={loc.name} data-testid={`cv-entry-wizard.content-locale-tab.${loc.code}`} />
          ))}
        </Tabs>
      )}

      {currentLocale && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {currentLocale.name}
          </Typography>

          <TextField
            label={t('wizard.cvEntry.fields.position')}
            fullWidth
            value={positions[currentLocale.locale_id] ?? ''}
            onChange={(e) => {
              const updated = { ...positions };
              updated[currentLocale.locale_id] = e.target.value;
              setValue('positions', updated, { shouldDirty: true });
            }}
            data-testid="cv-entry-wizard.field.position"
            sx={{ mb: 2 }}
          />

          <TextField
            label={t('wizard.cvEntry.fields.description')}
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            value={descriptions[currentLocale.locale_id] ?? ''}
            onChange={(e) => {
              const updated = { ...descriptions };
              updated[currentLocale.locale_id] = e.target.value;
              setValue('descriptions', updated, { shouldDirty: true });
            }}
            data-testid="cv-entry-wizard.field.description"
            sx={{ mb: 2 }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('wizard.cvEntry.fields.achievements')}
            </Typography>
            <Stack spacing={1}>
              {currentAchievements.map((achievement, index) => (
                // Achievement strings have no stable ID; they're free-text
                // inputs the user edits in place. Reorder isn't supported.
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                <Stack key={index} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={achievement}
                    onChange={(e) => handleAchievementChange(index, e.target.value)}
                    placeholder={t('wizard.cvEntry.achievementPlaceholder')}
                    data-testid={`cv-entry-wizard.field.achievement.${index}`}
                  />
                  <IconButton
                    onClick={() => handleRemoveAchievement(index)}
                    color="error"
                    size="small"
                    aria-label={t('common.actions.delete')}
                    data-testid={`cv-entry-wizard.field.achievement.delete.${index}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddAchievement}
              size="small"
              sx={{ mt: 1 }}
              data-testid="cv-entry-wizard.field.achievement.add"
            >
              {t('wizard.cvEntry.addAchievement')}
            </Button>
          </Box>
        </Box>
      )}
    </Stack>
  );
}
