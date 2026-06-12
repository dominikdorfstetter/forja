import { Stack, TextField, Autocomplete, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { getSkills } from '@/services/skills';
import type { SkillResponse } from '@/types/api';
import type { CvEntryWizardFormData } from './CvEntryWizard';
import { queryKeys } from '@/lib/queryKeys';

interface CvEntryWizardSkillsStepProps {
  watch: UseFormWatch<CvEntryWizardFormData>;
  setValue: UseFormSetValue<CvEntryWizardFormData>;
  siteId: string;
}

export default function CvEntryWizardSkillsStep({
  watch,
  setValue,
  siteId,
}: CvEntryWizardSkillsStepProps) {
  const { t } = useTranslation();
  const skillIds: string[] = watch('skill_ids') ?? [];

  const { data: skillsData } = useQuery({
    queryKey: queryKeys.skills(siteId, 'all'),
    queryFn: () => getSkills(siteId, { page_size: 200 }),
    enabled: !!siteId,
  });
  const allSkills: SkillResponse[] = skillsData?.data ?? [];
  const selectedSkills = allSkills.filter((s) => skillIds.includes(s.id));

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      <Typography variant="subtitle2">
        {t('wizard.cvEntry.fields.skills')}
      </Typography>
      <Autocomplete
        multiple
        options={allSkills}
        getOptionLabel={(option) => option.name}
        value={selectedSkills}
        // eslint-disable-next-line forja/require-read-only-gate -- wizard parent (Portfolio.tsx) opens this dialog only when canWrite is true
        onChange={(_, newValue) =>
          setValue('skill_ids', newValue.map((s) => s.id), { shouldDirty: true })
        }
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderValue={(value, getItemProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getItemProps({ index });
            return <Chip key={key} label={option.name} size="small" {...tagProps} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t('wizard.cvEntry.searchSkills')}
            data-testid="cv-entry-wizard.field.skill_ids"
          />
        )}
        data-testid="cv-entry-wizard.skills-autocomplete"
      />
    </Stack>
  );
}
