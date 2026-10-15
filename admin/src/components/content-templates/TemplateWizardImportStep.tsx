import { TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import MarkdownImportStep, { ImportBodyPreview, MONOSPACE_INPUT_SLOT_PROPS } from '@/components/shared/contentWizard/MarkdownImportStep';
import type { MarkdownUploadBindings } from '@/components/shared/contentWizard/wizardSourceState';

interface TemplateWizardImportStepProps {
  upload: MarkdownUploadBindings;
  parsed: MarkdownParseResult | null;
  editName: string;
  editSlugPrefix: string;
  editBody: string;
  onEditNameChange: (value: string) => void;
  onEditSlugPrefixChange: (value: string) => void;
}

export default function TemplateWizardImportStep({
  upload,
  parsed,
  editName,
  editSlugPrefix,
  editBody,
  onEditNameChange,
  onEditSlugPrefixChange,
}: TemplateWizardImportStepProps) {
  const { t } = useTranslation();

  return (
    <MarkdownImportStep showPreview={!!parsed} upload={upload}>
      <TextField autoFocus label={t('forms.contentTemplate.fields.name')} value={editName} onChange={(e) => onEditNameChange(e.target.value)} fullWidth required />
      <TextField label={t('forms.contentTemplate.fields.slugPrefix')} value={editSlugPrefix} onChange={(e) => onEditSlugPrefixChange(e.target.value)} fullWidth slotProps={MONOSPACE_INPUT_SLOT_PROPS} />
      <ImportBodyPreview label={t('forms.contentTemplate.fields.body')} value={editBody} />
    </MarkdownImportStep>
  );
}
