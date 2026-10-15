import type { ReactNode } from 'react';
import { Button, CircularProgress, Stack, TextField } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { MAX, isAiSectionLocked, type RegenerateField } from './blogWizardAiFields';
import { AiRegenerableSection, CharCountHelper } from './BlogWizardAiControls';

interface BlogWizardAiPostPhaseProps {
  aiTitle: string;
  aiExcerpt: string;
  aiMetaTitle: string;
  aiMetaDescription: string;
  busy: boolean;
  regeneratingField: RegenerateField | null;
  onTitleChange: (value: string) => void;
  onExcerptChange: (value: string) => void;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onRegenerate: (field: RegenerateField) => void;
  /** Editor for the body section: the wizard edits raw markdown, quick post uses the rich editor. */
  body: ReactNode;
}

export default function BlogWizardAiPostPhase({
  aiTitle,
  aiExcerpt,
  aiMetaTitle,
  aiMetaDescription,
  busy,
  regeneratingField,
  onTitleChange,
  onExcerptChange,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onRegenerate,
  body,
}: BlogWizardAiPostPhaseProps) {
  const { t } = useTranslation();
  const control = { regeneratingField, busy, onRegenerate };
  const seoLocked = isAiSectionLocked('seo', busy, regeneratingField);

  return (
    <>
      <TextField
        label={t('quickPost.ai.titleLabel')}
        fullWidth
        value={aiTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        disabled={busy}
        slotProps={{ htmlInput: { maxLength: MAX.title } }}
        helperText={<CharCountHelper value={aiTitle} max={MAX.title} />}
      />

      <AiRegenerableSection label={t('blogDetail.fields.body')} field="body" {...control}>
        {body}
      </AiRegenerableSection>

      <AiRegenerableSection label={t('blogDetail.fields.excerpt')} field="excerpt" {...control}>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={aiExcerpt}
          onChange={(e) => onExcerptChange(e.target.value)}
          disabled={isAiSectionLocked('excerpt', busy, regeneratingField)}
          slotProps={{ htmlInput: { maxLength: MAX.excerpt } }}
          helperText={<CharCountHelper value={aiExcerpt} max={MAX.excerpt} />}
        />
      </AiRegenerableSection>

      <AiRegenerableSection label={t('blogDetail.fields.seo', 'SEO')} field="seo" {...control}>
        <Stack spacing={2}>
          <TextField
            label={t('blogDetail.fields.metaTitle')}
            fullWidth
            value={aiMetaTitle}
            onChange={(e) => onMetaTitleChange(e.target.value)}
            disabled={seoLocked}
            slotProps={{ htmlInput: { maxLength: MAX.metaTitle } }}
            helperText={<CharCountHelper value={aiMetaTitle} max={MAX.metaTitle} />}
          />
          <TextField
            label={t('blogDetail.fields.metaDescription')}
            fullWidth
            multiline
            rows={2}
            value={aiMetaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            disabled={seoLocked}
            slotProps={{ htmlInput: { maxLength: MAX.metaDescription } }}
            helperText={<CharCountHelper value={aiMetaDescription} max={MAX.metaDescription} />}
          />
        </Stack>
      </AiRegenerableSection>

      <Button
        variant="outlined"
        size="small"
        startIcon={regeneratingField === 'all' ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
        onClick={() => onRegenerate('all')}
        disabled={busy}
      >
        {t('quickPost.ai.regenerateAll', 'Regenerate All')}
      </Button>
    </>
  );
}
