import { TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import MarkdownImportStep, { ImportBodyPreview, MONOSPACE_INPUT_SLOT_PROPS } from '@/components/shared/contentWizard/MarkdownImportStep';
import type { MarkdownUploadBindings } from '@/components/shared/contentWizard/wizardSourceState';

interface BlogWizardImportStepProps {
  importPhase: 'upload' | 'preview';
  upload: MarkdownUploadBindings;
  parsed: MarkdownParseResult | null;
  importTitle: string;
  importExcerpt: string;
  importSlug: string;
  onImportTitleChange: (value: string) => void;
  onImportExcerptChange: (value: string) => void;
  onImportSlugChange: (value: string) => void;
}

export default function BlogWizardImportStep({
  importPhase,
  upload,
  parsed,
  importTitle,
  importExcerpt,
  importSlug,
  onImportTitleChange,
  onImportExcerptChange,
  onImportSlugChange,
}: BlogWizardImportStepProps) {
  const { t } = useTranslation();

  return (
    <MarkdownImportStep showPreview={importPhase === 'preview'} upload={upload}>
      <TextField label={t('markdownImport.titleLabel')} value={importTitle} onChange={(e) => onImportTitleChange(e.target.value)} fullWidth />
      <TextField label={t('markdownImport.excerptLabel')} value={importExcerpt} onChange={(e) => onImportExcerptChange(e.target.value)} fullWidth multiline rows={2} />
      <TextField label={t('markdownImport.slugLabel')} value={importSlug} onChange={(e) => onImportSlugChange(e.target.value)} fullWidth slotProps={MONOSPACE_INPUT_SLOT_PROPS} />
      <ImportBodyPreview label={t('markdownImport.bodyPreview')} value={parsed?.body || ''} />
    </MarkdownImportStep>
  );
}
