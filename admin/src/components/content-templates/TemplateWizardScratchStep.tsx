import { Box, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface TemplateWizardScratchStepProps {
  name: string;
  slugPrefix: string;
  body: string;
  onNameChange: (value: string) => void;
  onSlugPrefixChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}

export default function TemplateWizardScratchStep({
  name,
  slugPrefix,
  body,
  onNameChange,
  onSlugPrefixChange,
  onBodyChange,
}: TemplateWizardScratchStepProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField autoFocus label={t('forms.contentTemplate.fields.name')} fullWidth required value={name} onChange={(e) => onNameChange(e.target.value)} />
      <TextField label={t('forms.contentTemplate.fields.slugPrefix')} fullWidth value={slugPrefix} onChange={(e) => onSlugPrefixChange(e.target.value)} helperText={t('contentTemplates.wizard.slugPrefixHint')} />
      <TextField label={t('forms.contentTemplate.fields.body')} fullWidth multiline rows={6} value={body} onChange={(e) => onBodyChange(e.target.value)} />
    </Box>
  );
}
